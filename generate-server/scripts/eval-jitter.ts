/**
 * JITTER EVAL HARNESS
 *
 * Composes a fixed set of briefs and prints a deterministic QUALITY SCORE for
 * each (from jitterAudit). Run it before and after a prompt / model / fixer
 * change and diff the scores — that's how you tell whether a change actually
 * helped, instead of eyeballing one render.
 *
 *   tsx generate-server/scripts/eval-jitter.ts                 # run all cases
 *   tsx generate-server/scripts/eval-jitter.ts --json          # machine-readable
 *   tsx generate-server/scripts/eval-jitter.ts --baseline f.json   # diff vs saved run
 *   tsx generate-server/scripts/eval-jitter.ts --save f.json        # save this run
 *
 * Env: needs GOOGLE_AI_API_KEY (real composer calls). JITTER_* overrides apply.
 */

import { writeFileSync, readFileSync, existsSync } from "fs";
import { resolve } from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), "../.env") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

import { generateJitterDoc, type JitterBrief } from "../lib/agents/jitterComposer";
import { auditDoc, summarizeAudit, type QualityReport } from "../lib/agents/jitterAudit";

interface EvalCase {
  name: string;
  brief: JitterBrief;
}

const CASES: EvalCase[] = [
  {
    name: "saas-hero-5s",
    brief: {
      brief:
        'Hero animation for productivity SaaS "Flowdeck". Hook with the wordmark + tagline "Plan less. Ship more.", then three feature pills: AI tasks, Auto-roadmap, Zero meetings.',
      durationMs: 5000,
      brand: {
        primary: "#ff2d95",
        background: "#0b1020",
        textColor: "#ffffff",
        fontFamily: "Inter",
      },
      copy: {
        productName: "Flowdeck",
        tagline: "Plan less. Ship more.",
        features: [
          { title: "AI tasks" },
          { title: "Auto-roadmap" },
          { title: "Zero meetings" },
        ],
        cta: "Start free",
      },
    },
  },
  {
    name: "ecommerce-promo-8s",
    brief: {
      brief:
        'Promo for an eco water bottle brand "Hydra". Open on the product name, show two benefits (Keeps cold 24h, 100% recycled), close on the CTA "Shop now — $29".',
      durationMs: 8000,
      brand: {
        primary: "#1fb6a6",
        background: "#0a1f1c",
        textColor: "#f0fdfa",
        fontFamily: "Sora",
      },
      copy: {
        productName: "Hydra",
        tagline: "Cold all day. Kind to the planet.",
        features: [
          { title: "Keeps cold 24h" },
          { title: "100% recycled" },
        ],
        cta: "Shop now",
        price: "$29",
      },
    },
  },
  {
    name: "minimal-text-4s",
    brief: {
      brief:
        'Minimal typographic title card for a newsletter "Signal". Just the name and the line "Tech that matters, weekly."',
      durationMs: 4000,
      brand: {
        primary: "#e2e8f0",
        background: "#0f172a",
        textColor: "#f8fafc",
        fontFamily: "Space Grotesk",
      },
      copy: {
        productName: "Signal",
        tagline: "Tech that matters, weekly.",
      },
    },
  },
];

interface CaseResult {
  name: string;
  ok: boolean;
  attempts?: number;
  report?: QualityReport;
  error?: string;
}

async function runCase(c: EvalCase): Promise<CaseResult> {
  try {
    const res = await generateJitterDoc(c.brief, { maxAttempts: 3 });
    const report = auditDoc(res.doc, { targetDurationMs: c.brief.durationMs });
    return { name: c.name, ok: true, attempts: res.attempts, report };
  } catch (err) {
    return {
      name: c.name,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const jsonOut = process.argv.includes("--json");
  const baselinePath = arg("--baseline");
  const savePath = arg("--save");

  const results: CaseResult[] = [];
  for (const c of CASES) {
    if (!jsonOut) console.log(`\n=== ${c.name} ===`);
    const r = await runCase(c);
    results.push(r);
    if (!jsonOut) {
      if (r.ok && r.report) {
        console.log(`attempts=${r.attempts}  ${summarizeAudit(r.report)}`);
      } else {
        console.log(`FAILED: ${r.error}`);
      }
    }
  }

  const scored = results.filter((r) => r.ok && r.report);
  const avg =
    scored.length > 0
      ? Math.round(
          scored.reduce((s, r) => s + (r.report?.score ?? 0), 0) / scored.length,
        )
      : 0;

  if (jsonOut) {
    console.log(JSON.stringify({ avg, results }, null, 2));
  } else {
    console.log(
      `\n=== SUMMARY: avg score ${avg} over ${scored.length}/${results.length} cases ===`,
    );
  }

  if (savePath) {
    writeFileSync(savePath, JSON.stringify({ avg, results }, null, 2));
    console.log(`saved run → ${savePath}`);
  }

  if (baselinePath && existsSync(baselinePath)) {
    const base = JSON.parse(readFileSync(baselinePath, "utf8"));
    console.log(`\n=== DIFF vs ${baselinePath} (avg ${base.avg} → ${avg}, Δ${avg - base.avg >= 0 ? "+" : ""}${avg - base.avg}) ===`);
    for (const r of results) {
      const b = (base.results || []).find((x: CaseResult) => x.name === r.name);
      const before = b?.report?.score ?? "—";
      const after = r.report?.score ?? "FAIL";
      const delta =
        typeof before === "number" && typeof after === "number"
          ? ` (Δ${after - before >= 0 ? "+" : ""}${after - before})`
          : "";
      console.log(`  ${r.name}: ${before} → ${after}${delta}`);
    }
  }

  // Non-zero exit if any case failed outright — handy in CI.
  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
