/**
 * End-to-end smoke test for one sample idea.
 *
 *   pnpm --filter @remawt/engine exec tsx scripts/smoke.ts            # full: needs DATABASE_URL (v2 schema) + R2; RENDER_PROVIDER=local
 *   pnpm --filter @remawt/engine exec tsx scripts/smoke.ts --offline  # no DB/R2: script → plan → align → hf-kit compose → lint
 *
 * Steps whose provider keys are missing are skipped with a canned stand-in (script without ANTHROPIC_API_KEY,
 * narration without ELEVENLABS_API_KEY/DEEPINFRA_API_KEY, render without R2/ffmpeg).
 */
import "dotenv/config";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { IdentityKitSchema, SKIN_PRESETS, getFormat, CompositionSchema, type Script, type VoiceTrack, type IdentityKit } from "@remawt/shared";
import { has } from "../src/lib/env.js";
import { estimateWordTimings } from "../src/lib/captions.js";
import { alignScenes } from "../src/lib/planning/allocate.js";
import { hfkit } from "../src/lib/hfkit.js";
import { writeScript } from "../src/mastra/agents/scriptwriter.js";
import { planScenes } from "../src/mastra/agents/planner.js";

process.env.RENDER_PROVIDER ??= "local";
const offline = process.argv.includes("--offline");
const out = mkdtempSync(join(tmpdir(), "remawt-smoke-"));
const say = (m: string, extra?: unknown) => console.log(`[smoke] ${m}`, extra ?? "");

const kit: IdentityKit = IdentityKitSchema.parse({
  audience: "curious adults who like quick science facts",
  promise: "one surprising science fact explained visually per video",
  skin: SKIN_PRESETS[0],
  voice: { provider: "elevenlabs", voiceId: "rachel", name: "Rachel" },
  persona: { tone: { formal: 0.3, energy: 0.7, humor: 0.3, density: 0.6 }, pov: "second" },
  defaultDurationSec: 35,
});
const format = getFormat("did-you-know")!;
const idea = { title: "Why the sky is blue", hook: "The sky isn't blue for the reason you think", angle: "Rayleigh scattering in 30 seconds" };

const CANNED: Script = {
  title: "Why the sky is blue", hook: "The sky isn't blue for the reason you think.", cta: "Follow for one science fact a day.",
  sources: [{ title: "NASA SpacePlace: Why is the sky blue?", url: "https://spaceplace.nasa.gov/blue-sky/" }], hashtags: ["science", "physics", "sky"], description: "Rayleigh scattering, explained.", estimatedSec: 30,
  lines: [
    { beatId: "hook", text: "The sky isn't blue for the reason you think.", onScreen: "Not the ocean", targetSec: 3 },
    { beatId: "setup", text: "Most people guess it reflects the ocean.", onScreen: "Ocean reflection?", targetSec: 4 },
    { beatId: "reveal", text: "Sunlight hits tiny air molecules. Short blue waves scatter far more than red ones.", onScreen: "Blue scatters most", targetSec: 9 },
    { beatId: "twist", text: "Violet scatters even more, but your eyes are less sensitive to it.", onScreen: "So why not violet?", targetSec: 7 },
    { beatId: "loop", text: "So next time you look up, thank physics. Follow for one science fact a day.", onScreen: "Thank physics", targetSec: 6 },
  ],
};

async function offlineRun() {
  say(`offline mode → ${out}`);
  const script = has.anthropic() ? await writeScript({ kit, format, niche: "science", targetSec: 35, idea }, "standard") : CANNED;
  say("script", { title: script.title, lines: script.lines.length, sources: script.sources.length, llm: has.anthropic() });
  writeFileSync(join(out, "script.json"), JSON.stringify(script, null, 2));
  const text = script.lines.map((l) => l.text).join(" ");
  const durationMs = Math.round(script.estimatedSec * 1000);
  const voice: VoiceTrack = { audioUrl: "", durationMs, words: estimateWordTimings(text, durationMs), provider: "estimate", voiceId: "" };
  const draft = has.anthropic() ? await planScenes({ script, voice, format, kit }, "standard") : { musicMood: "curious", scenes: script.lines.map((l, i) => ({ id: `s${i + 1}`, beatId: l.beatId, block: "kinetic-headline", headline: l.onScreen ?? l.text.split(" ").slice(0, 5).join(" ") })) };
  say("plan", { scenes: draft.scenes.length, mood: draft.musicMood });
  const timed = alignScenes({ scenes: draft.scenes, lines: script.lines, beats: format.beats, words: voice.words, totalMs: durationMs, beatMs: 60000 / 120 });
  const plan = { scenes: draft.scenes.map((s) => ({ ...s, ...timed.find((t) => t.id === s.id)!, assetIds: [] as string[] })), totalMs: durationMs, musicMood: draft.musicMood, sfxCues: [] };
  writeFileSync(join(out, "plan.json"), JSON.stringify(plan, null, 2));
  try {
    const comp = CompositionSchema.parse(hfkit.composeVideo({ script, voice, plan, kit, assets: [], music: null, sfx: [], watermark: true }));
    const lint = hfkit.lintComposition(comp);
    writeFileSync(join(out, "composition.json"), JSON.stringify(comp, null, 2));
    say("compose+lint", { scenes: comp.sceneFiles.length, ok: lint.ok, errors: lint.errors.slice(0, 5), warnings: lint.warnings.length });
    if (process.argv.includes("--render")) {
      const { renderToDir } = await import("../src/lib/render/index.js");
      const t0 = Date.now();
      const master = await renderToDir({ videoId: "smoke", composition: comp, quality: "draft" }, join(out, "render"));
      say("local render (draft, no upload)", { master, sec: Math.round((Date.now() - t0) / 1000) });
    }
  } catch (e) {
    say("compose skipped/failed", (e as Error).message);
  }
}

async function fullRun() {
  const { db } = await import("../src/lib/db.js");
  const steps = await import("../src/pipeline/steps.js");
  if (!has.db()) throw new Error("DATABASE_URL required for full mode (use --offline otherwise)");
  if (!has.r2()) say("R2 not configured: narration/assets/render uploads will fail — use --offline");
  const email = "smoke@remawt.local";
  const user = await db().user.upsert({ where: { email }, create: { email, name: "Smoke", videoAllowance: 999 }, update: {} });
  const channel = await db().channel.create({ data: { userId: user.id, name: "Smoke Science", niche: "science", kit: kit as never, status: "ACTIVE" } });
  const video = await db().video.create({ data: { channelId: channel.id, title: idea.title, format: format.id, targetSec: 35, status: "QUEUED" } });
  await db().usageLedger.create({ data: { userId: user.id, videoId: video.id, delta: -1, kind: "video", note: "smoke" } });
  const ctx = { videoId: video.id, quality: "standard" as const, watermark: false };
  say(`video ${video.id} → ${out}`);

  if (!has.anthropic()) { await db().video.update({ where: { id: video.id }, data: { script: CANNED as never, title: CANNED.title } }); say("script: canned (no ANTHROPIC_API_KEY)"); }
  else await steps.runScript(ctx, { notes: idea.angle });

  if (has.elevenlabs() || has.kokoro()) await steps.runVoice(ctx);
  else {
    const t = CANNED.lines.map((l) => l.text).join(" ");
    await db().video.update({ where: { id: video.id }, data: { voice: { audioUrl: "", durationMs: 30000, words: estimateWordTimings(t, 30000), provider: "estimate", voiceId: "" } as never } });
    say("voice: estimated timings (no TTS key)");
  }
  if (has.anthropic()) await steps.runPlan(ctx);
  else throw new Error("planner needs ANTHROPIC_API_KEY in full mode");
  await steps.runAlign(ctx);
  await steps.runAssets(ctx);
  let state = await steps.runCompose(ctx);
  while (!state.ok && state.attempts < 2) state = await steps.runReview(ctx, state);
  say("lint", state);
  if (!state.ok) throw new Error(`lint failed: ${state.lint?.errors.join("; ")}`);
  const master = await steps.runRenderLocal(ctx);
  await steps.runQc(ctx);
  await steps.runCuts(ctx);
  const final = await db().video.findUnique({ where: { id: video.id } });
  say("READY", { masterUrl: master, status: final?.status, cost: final?.cost, originality: final?.originality });
}

(offline ? offlineRun() : fullRun())
  .then(() => process.exit(0))
  .catch((e) => { console.error("[smoke] FAILED", e); process.exit(1); });
