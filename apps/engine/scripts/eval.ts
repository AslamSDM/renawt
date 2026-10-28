/**
 * Compose-robustness eval: live Claude script + plan, then hf-kit compose (with the repair path) + lint. No render.
 *
 *   pnpm --filter @remawt/engine exec tsx scripts/eval.ts --offline [--legacy] [--label name] [--only did-you-know] [--concurrency 4]
 *
 * 6 FORMATS × 2 skins (ledger, paper) × 2 niches (science, personal-finance) = 24 cases. Scripts are cached per
 * (format, niche) in $TMPDIR/remawt-eval/scripts so reruns pay only for planning. `--legacy` plans with the
 * pre-2026-10-28 planner prompt (own instructions, no block catalogue) to measure the baseline.
 * Per case: strict-valid (old compose would pass) / coerced / LLM-repaired / failed, lint errors, USD.
 * Writes docs/status/eval-2026-10-28.md (all runs recorded in the cache's runs.json + the latest run's table).
 */
import "./_offline-env.js"; // must stay first: strips DB URLs in --offline mode
import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FORMATS, IdentityKitSchema, SKIN_PRESETS, type FormatTemplate, type IdentityKit, type Script } from "@remawt/shared";
import { has } from "../src/lib/env.js";
import { hfkit } from "../src/lib/hfkit.js";
import { withCallContext } from "../src/lib/context.js";
import { composeWithRepair, ComposeRepairError } from "../src/lib/planning/repair.js";
import { onLlmCall } from "../src/mastra/usage.js";
import { writeScript } from "../src/mastra/agents/scriptwriter.js";
import { planScenes, PlannerOutputSchema, type PlannerOutput } from "../src/mastra/agents/planner.js";
import { repairScene } from "../src/mastra/agents/repair.js";
import { generateStructured, type AgentSpec } from "../src/mastra/llm.js";
import { SFX_CUES } from "../src/lib/audio/sfx.js";
import { estimatedVoice, alignDraft } from "./_offline-pipeline.js";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
if (!process.argv.includes("--offline")) throw new Error("eval only runs with --offline (never against a DB)");
if (!has.anthropic()) throw new Error("ANTHROPIC_API_KEY required");
const legacy = process.argv.includes("--legacy");
const label = arg("--label") ?? (legacy ? "before (legacy planner prompt)" : "after");
const only = arg("--only");
const concurrency = Number(arg("--concurrency") ?? 4);
const cacheDir = arg("--cache") ?? join(tmpdir(), "remawt-eval");
mkdirSync(join(cacheDir, "scripts"), { recursive: true });
mkdirSync(join(cacheDir, "plans"), { recursive: true });
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const reportPath = join(repoRoot, "docs/status/eval-2026-10-28.md");

const SKINS = ["ledger", "paper"] as const;
const NICHES = ["science", "personal-finance"] as const;
const IDEAS: Record<string, Record<(typeof NICHES)[number], { title: string; hook: string; angle: string }>> = {
  "did-you-know": {
    science: { title: "Why the sky is blue", hook: "The sky isn't blue for the reason you think", angle: "Rayleigh scattering in 30 seconds" },
    "personal-finance": { title: "Your savings account loses money", hook: "Your 'safe' savings are shrinking every year", angle: "Inflation vs savings interest" },
  },
  "chart-explains": {
    science: { title: "CO2 and temperature since 1960", hook: "This line has only gone one way", angle: "Keeling curve vs global temperature anomaly" },
    "personal-finance": { title: "S&P 500 vs inflation", hook: "A dollar under your mattress lost 40% since 2000", angle: "Index returns vs CPI over 25 years" },
  },
  "x-vs-y": {
    science: { title: "Solar vs nuclear", hook: "Solar or nuclear: which actually powers more?", angle: "Cost, land use, capacity factor, CO2 per kWh" },
    "personal-finance": { title: "Renting vs buying", hook: "Renting isn't throwing money away. Here's the math.", angle: "Upfront cost, monthly cost, 10-year wealth" },
  },
  "wish-i-knew": {
    science: { title: "Sleep science I wish I knew", hook: "I wasted years sleeping wrong", angle: "Evidence-based sleep tips" },
    "personal-finance": { title: "Money things I wish I knew at 22", hook: "Nobody told me this about money at 22", angle: "Compound interest, emergency fund, index funds" },
  },
  mythbust: {
    science: { title: "We only use 10% of our brain", hook: "Stop believing you only use 10% of your brain", angle: "fMRI evidence" },
    "personal-finance": { title: "You need perfect credit to buy a house", hook: "Stop believing you need an 800 credit score", angle: "Minimum scores for FHA/conventional loans" },
  },
  "headline-reaction": {
    science: { title: "Water ice confirmed on the Moon", hook: "NASA confirms water on the sunlit Moon", angle: "SOFIA 2020 detection and what it means for Artemis" },
    "personal-finance": { title: "Fed holds rates steady", hook: "The Fed just held rates. Here's what it means for you.", angle: "Savings, mortgages, credit cards" },
  },
};

// The planner as it was before 2026-10-28 (own instructions, user prompt only, no block catalogue) — the baseline.
const LEGACY_PLANNER: AgentSpec = {
  id: "planner-legacy", name: "Visual planner (legacy)", role: "plan",
  instructions: `You plan the visuals of a vertical 1080x1920 faceless explainer built from HyperFrames registry blocks.
- Produce scenes in narration order. Every scene has a beatId from the format, and uses the beat's suggested block family unless a different family clearly serves the line better.
- One idea per scene; 1–3 scenes per beat; a new scene roughly every 2–5 seconds of narration.
- headline ≤ 7 words; body ≤ 14 words. Put structured data in "data" (e.g. chart series {labels:[], values:[], unit, source}, stats {left:{label,value}, right:{...}}, list items, map points, source {title,url}).
- Charts and evidence scenes MUST include the source name in data.source.
- asset: choose "none" when typography/diagram/chart is enough (preferred); "icon" for a simple pictogram (prompt); "image" for an illustrative AI image (prompt, no text, no real people); "stock"/"stock-video" for real-world footage (short search query). At most one asset per scene, and at most 4 non-"none" assets per video.
- sfx: optional cue name for a scene's entrance, only on 20–40% of scenes. Allowed cues: ${Object.keys(SFX_CUES).join(", ")}.
- musicMood: one of upbeat, calm, dramatic, curious, serious, playful.
- Scene ids: "s1", "s2", ... Return JSON only.`,
};

function kitFor(skin: string, niche: string): IdentityKit {
  return IdentityKitSchema.parse({
    audience: niche === "science" ? "curious adults who like quick science facts" : "beginners in their 20s who want to get better with money",
    promise: niche === "science" ? "one surprising science fact explained visually per video" : "one money concept explained visually per video",
    skin: SKIN_PRESETS.find((s) => s.id === skin),
    voice: { provider: "elevenlabs", voiceId: "rachel", name: "Rachel" },
    persona: { tone: { formal: 0.3, energy: 0.7, humor: 0.3, density: 0.6 }, pov: "second" },
    defaultDurationSec: 40,
  });
}

// Cost accounting per case through the call context label.
const spend = new Map<string, number>();
onLlmCall((r) => { const k = currentCase.get(); spend.set(k, (spend.get(k) ?? 0) + r.usd); spend.set("__total", (spend.get("__total") ?? 0) + r.usd); });
const caseStore = new AsyncLocalStorage<string>();
const currentCase = { get: () => caseStore.getStore() ?? "__none" };

async function scriptFor(format: FormatTemplate, niche: string): Promise<{ script: Script; usd: number; cached: boolean }> {
  const f = join(cacheDir, "scripts", `${format.id}__${niche}.json`);
  if (existsSync(f)) return { ...(JSON.parse(readFileSync(f, "utf8")) as { script: Script; usd: number }), cached: true };
  const key = `script:${format.id}:${niche}`;
  const script = await caseStore.run(key, () => withCallContext({ step: "script" }, () => writeScript({ kit: kitFor("ledger", niche), format, niche, targetSec: 40, idea: IDEAS[format.id][niche as (typeof NICHES)[number]] }, "standard")));
  const usd = spend.get(key) ?? 0;
  writeFileSync(f, JSON.stringify({ script, usd }, null, 2));
  return { script, usd, cached: false };
}

async function legacyPlan(opts: { script: Script; format: FormatTemplate; kit: IdentityKit }): Promise<PlannerOutput> {
  const voice = estimatedVoice(opts.script);
  return generateStructured({ spec: LEGACY_PLANNER, quality: "standard", label: "plan", schema: PlannerOutputSchema, prompt: hfkit.buildScenePlanPrompt({ ...opts, voice }), maxOutputTokens: 12000 });
}

interface CaseResult {
  id: string; format: string; skin: string; niche: string; scenes: number;
  strictValid: boolean; outcome: "clean" | "coerced" | "llm" | "failed";
  category: "no-repair" | "coercion" | "llm-repair" | "failed";
  coercions: number; llmRepairs: number; firstIssue?: string; lintErrors: number; lintFirst?: string; usd: number; scriptUsd: number; error?: string; sec: number;
}

async function runCase(format: FormatTemplate, skin: string, niche: string): Promise<CaseResult> {
  const id = `${format.id}/${skin}/${niche}`;
  const t0 = Date.now();
  const kit = kitFor(skin, niche);
  const base = { id, format: format.id, skin, niche };
  try {
    const { script, usd: scriptUsd } = await scriptFor(format, niche);
    return await caseStore.run(id, async () => {
      const voice = estimatedVoice(script);
      const draft = legacy ? await legacyPlan({ script, format, kit }) : await planScenes({ script, voice, format, kit }, "standard");
      const plan = alignDraft(draft, script, voice, format);
      writeFileSync(join(cacheDir, "plans", `${label.replace(/\W+/g, "_")}__${id.replace(/\//g, "__")}.json`), JSON.stringify(plan, null, 2));
      // Strict validity = would the pre-change composeVideo have accepted this plan?
      const issues = plan.scenes.map((s, i) => hfkit.sceneIssue(s, i, new Set())).filter(Boolean);
      const strictValid = issues.length === 0;
      const common = { ...base, scenes: plan.scenes.length, strictValid, firstIssue: issues[0] ? `${issues[0]!.path.replace(/^plan\./, "")}: ${issues[0]!.message} (${issues[0]!.block})` : undefined, scriptUsd: scriptUsd / 2 };
      try {
        const res = await composeWithRepair({ script, voice, plan, kit, assets: [], music: null, sfx: [], watermark: false }, { repairScene });
        const lint = hfkit.lintComposition(res.comp);
        const llmRepairs = res.repairs.filter((r) => r.stage === "llm").length;
        const coercions = strictValid ? 0 : hfkit.coercePlan(plan).changes.length;
        const category = strictValid ? "no-repair" : res.outcome === "llm" ? "llm-repair" : "coercion";
        return { ...common, outcome: res.outcome, category, coercions, llmRepairs, lintErrors: lint.errors.length, lintFirst: lint.errors[0], usd: (spend.get(id) ?? 0) + common.scriptUsd, sec: Math.round((Date.now() - t0) / 1000) } satisfies CaseResult;
      } catch (e) {
        const repairs = e instanceof ComposeRepairError ? e.repairs : [];
        return { ...common, outcome: "failed", category: "failed", coercions: repairs.filter((r) => r.stage === "coerce").length, llmRepairs: repairs.filter((r) => r.stage === "llm").length, lintErrors: 0, usd: (spend.get(id) ?? 0) + common.scriptUsd, error: (e as Error).message.slice(0, 300), sec: Math.round((Date.now() - t0) / 1000) } satisfies CaseResult;
      }
    });
  } catch (e) {
    return { ...base, scenes: 0, strictValid: false, outcome: "failed", category: "failed", coercions: 0, llmRepairs: 0, lintErrors: 0, usd: spend.get(id) ?? 0, scriptUsd: 0, error: `script/plan: ${(e as Error).message.slice(0, 300)}`, sec: Math.round((Date.now() - t0) / 1000) };
  }
}

interface RunSummary { label: string; at: string; legacy: boolean; cases: number; noRepair: number; coercion: number; llm: number; failed: number; lintClean: number; usd: number; results: CaseResult[] }

function pct(n: number, d: number) { return d ? `${Math.round((n / d) * 100)}%` : "–"; }

function report(runs: RunSummary[]): string {
  const last = runs[runs.length - 1];
  const row = (r: RunSummary) => `| ${r.label} | ${r.at.slice(0, 16).replace("T", " ")} | ${r.cases} | ${r.noRepair} (${pct(r.noRepair, r.cases)}) | ${r.coercion} (${pct(r.coercion, r.cases)}) | **${pct(r.noRepair + r.coercion, r.cases)}** | ${r.llm} | ${r.failed} | ${r.lintClean}/${r.cases - r.failed} | $${r.usd.toFixed(2)} |`;
  const total = runs.reduce((a, r) => a + r.usd, 0);
  return `# Compose-robustness eval (2026-10-28)

Generated by \`apps/engine/scripts/eval.ts --offline\`. Live Claude (Sonnet 5.5 script + plan, Haiku 5.5 repair), estimated voice timings, hf-kit compose + lint, no render, no DB.
Cases: 6 formats × 2 skins (ledger, paper) × 2 niches (science, personal-finance) = 24. Scripts are cached per (format, niche) and shared by both skins, so script cost is split across the two skin cases.

Categories:
- **no repair**: the planner's plan passes the strict block schemas as-is (what the old \`composeVideo\` accepted).
- **coercion**: needed the deterministic lenient schemas / \`coercePlan\` (no LLM).
- **LLM repair**: at least one scene needed the Haiku \`repairScene\` agent.
- **failed**: still invalid after 2 LLM attempts per scene (or the script/plan call failed).
Target: ≥ 90% compose without LLM repair (no repair + coercion).

## Runs

| run | at (UTC) | cases | no repair | coercion | without LLM | LLM repair | failed | lint clean | cost |
|---|---|---|---|---|---|---|---|---|---|
${runs.map(row).join("\n")}

Total eval spend across runs: **$${total.toFixed(2)}**.

## Latest run: ${last.label}

| case | scenes | category | first strict issue | coercions | LLM repairs | lint errors | cost |
|---|---|---|---|---|---|---|---|
${last.results.map((r) => `| ${r.id} | ${r.scenes} | ${r.category} | ${(r.firstIssue ?? r.error ?? "").replace(/\|/g, "/").slice(0, 110)} | ${r.coercions} | ${r.llmRepairs} | ${r.lintErrors}${r.lintFirst ? ` (${r.lintFirst.replace(/\|/g, "/").slice(0, 60)})` : ""} | $${r.usd.toFixed(3)} |`).join("\n")}
`;
}

async function main() {
  const cases: Array<[FormatTemplate, string, string]> = [];
  for (const f of FORMATS) if (!only || f.id === only) for (const sk of SKINS) for (const n of NICHES) cases.push([f, sk, n]);
  console.log(`[eval] ${label}: ${cases.length} cases, concurrency ${concurrency}, cache ${cacheDir}`);
  // Warm the script cache serially per (format, niche) so both skins share one script.
  const results: CaseResult[] = new Array(cases.length);
  let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    for (let k = next++; k < cases.length; k = next++) {
      const [f, sk, n] = cases[k];
      // Skin "paper" waits for the "ledger" script of the same (format, niche) when both run concurrently.
      if (sk === "paper") while (!existsSync(join(cacheDir, "scripts", `${f.id}__${n}.json`)) && results.findIndex((r, i) => !r && cases[i][0] === f && cases[i][2] === n && cases[i][1] === "ledger") >= 0) await new Promise((r) => setTimeout(r, 500));
      results[k] = await runCase(f, sk, n);
      const r = results[k];
      console.log(`[eval] ${r.id}: ${r.category}${r.firstIssue ? ` — ${r.firstIssue}` : ""}${r.error ? ` — ${r.error}` : ""} | lint ${r.lintErrors} | $${r.usd.toFixed(3)} | ${r.sec}s`);
    }
  }));
  const count = (c: CaseResult["category"]) => results.filter((r) => r.category === c).length;
  const summary: RunSummary = {
    label, at: new Date().toISOString(), legacy, cases: results.length,
    noRepair: count("no-repair"), coercion: count("coercion"), llm: count("llm-repair"), failed: count("failed"),
    lintClean: results.filter((r) => r.category !== "failed" && r.lintErrors === 0).length,
    usd: results.reduce((a, r) => a + r.usd, 0), results,
  };
  const runsFile = join(cacheDir, "runs.json");
  const runs: RunSummary[] = existsSync(runsFile) ? JSON.parse(readFileSync(runsFile, "utf8")) : [];
  if (!only) runs.push(summary);
  writeFileSync(runsFile, JSON.stringify(runs, null, 2));
  if (!only) writeFileSync(reportPath, report(runs));
  console.log(`[eval] ${label}: no-repair ${summary.noRepair}, coercion ${summary.coercion}, llm ${summary.llm}, failed ${summary.failed}; without LLM ${pct(summary.noRepair + summary.coercion, summary.cases)}; spend $${(spend.get("__total") ?? 0).toFixed(3)} (this process)`);
  if (!only) console.log(`[eval] wrote ${reportPath}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error("[eval] FAILED", e); process.exit(1); });
