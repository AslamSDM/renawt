import { test } from "node:test";
import assert from "node:assert/strict";
import { FORMATS, SKIN_PRESETS, IdentityKitSchema, type ScenePlan, type Script, type VoiceTrack } from "@remawt/shared";
import { composeWithRepair, ComposeRepairError } from "./repair.js";
import { estimateWordTimings } from "../captions.js";

const kit = IdentityKitSchema.parse({ audience: "a", promise: "p", skin: SKIN_PRESETS[0], voice: { provider: "elevenlabs", voiceId: "v", name: "V" }, persona: { tone: { formal: 0.3, energy: 0.7, humor: 0.3, density: 0.6 }, pov: "second" } });
const script: Script = { title: "t", hook: "h", cta: "c", sources: [], hashtags: [], description: "", estimatedSec: 9, lines: [{ beatId: "hook", text: "one two three four five six", targetSec: 9 }] };
const voice: VoiceTrack = { audioUrl: "", durationMs: 9000, words: estimateWordTimings("one two three four five six", 9000), provider: "estimate", voiceId: "" };
const plan = (scenes: Array<Partial<ScenePlan["scenes"][number]>>): ScenePlan => ({
  totalMs: 9000, musicMood: "calm", sfxCues: [],
  scenes: scenes.map((s, i) => ({ id: `s${i + 1}`, beatId: "hook", startMs: i * 3000, durationMs: 3000, block: "kinetic-headline", assetIds: [], ...s })),
});
const input = (p: ScenePlan) => ({ script, voice, plan: p, kit, assets: [], music: null, sfx: [] });
void FORMATS;

test("composeWithRepair: clean plan (lenient schemas absorb bare-string diagram nodes)", async () => {
  const r = await composeWithRepair(input(plan([{ headline: "Hi" }, { block: "diagram", headline: "Flow", data: { nodes: ["A", "B"] } }])));
  assert.equal(r.outcome, "clean");
});

test("composeWithRepair: coercion stage fixes context-dependent faults (unknown block, tip numbers)", async () => {
  const r = await composeWithRepair(input(plan([{ block: "mega-title", headline: "Hi" }, { block: "numbered-card", headline: "Tip", data: {} }])));
  assert.equal(r.outcome, "coerced");
  assert.equal(r.plan.scenes[0].block, "kinetic-headline");
  assert.ok(r.repairs.some((x) => x.stage === "coerce"));
});

test("composeWithRepair: LLM stage repairs what coercion cannot (max 2 attempts) and logs it", async () => {
  let calls = 0;
  const r = await composeWithRepair(input(plan([{ headline: "Hi" }, { block: "chart", headline: "Up", data: { series: [{ name: "a", values: [1] }] } }])), {
    repairScene: async (i) => { calls++; return i.attempt === 1 ? { block: "chart", data: { series: [{ name: "a", values: [1] }] } } : { block: "chart", data: { series: [{ name: "a", values: [1, 2, 3] }], source: "x" } }; },
  });
  assert.equal(r.outcome, "llm");
  assert.equal(calls, 2);
  assert.deepEqual(r.repairs.filter((x) => x.stage === "llm").map((x) => x.ok), [false, true]);
});

test("composeWithRepair: fails with the repair log when nothing works", async () => {
  await assert.rejects(
    composeWithRepair(input(plan([{ block: "chart", headline: "Up", data: { series: [{ name: "a", values: [1] }] } }])), { repairScene: async () => ({ block: "chart", data: {} }) }),
    (e: unknown) => e instanceof ComposeRepairError && e.repairs.filter((x) => x.stage === "llm").length === 2,
  );
  await assert.rejects(composeWithRepair(input(plan([{ block: "chart", headline: "Up", data: { series: [] } }]))), ComposeRepairError);
});
