import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVideoEditPlan } from "./steps.js";

test("buildVideoEditPlan interleaves footage, cut-ins and overlays on the edited timeline", () => {
  const pieces = [
    { segmentId: "g1", srcStartMs: 900, srcEndMs: 3100, editStartMs: 0, durationMs: 2200 },
    { segmentId: "g3", srcStartMs: 5000, srcEndMs: 8000, editStartMs: 2200, durationMs: 3000 },
    { segmentId: "g4", srcStartMs: 8000, srcEndMs: 9000, editStartMs: 5200, durationMs: 1000 },
  ];
  const plan = buildVideoEditPlan({
    pieces, totalMs: 6200, formatBeats: ["hook", "body"], userVideo: { assetId: "vid-src", fit: "crop" },
    edit: {
      title: "t", hook: "h", cta: "c", hashtags: [], description: "", sources: [], keep: ["g1", "g3", "g4"], musicMood: "calm",
      beats: [{ segmentId: "g1", beatId: "hook" }, { segmentId: "g3", beatId: "body" }],
      cutIns: [{ segmentId: "g3", block: "counter", headline: "3x cheaper", data: { value: 3 }, sfx: "pop" }],
      overlays: [{ segmentId: "g1", block: "overlay-lower-third", headline: "Jane Doe" }],
    },
  });
  const main = plan.scenes.filter((s) => !s.block.startsWith("overlay-"));
  assert.deepEqual(main.map((s) => [s.block, s.startMs, s.durationMs, s.beatId]), [["video-segment", 0, 2200, "hook"], ["counter", 2200, 3000, "body"], ["video-segment", 5200, 1000, "body"]]);
  assert.deepEqual(main[0].data, { assetId: "vid-src", inMs: 900, outMs: 3100, crop: "crop", segmentId: "g1" });
  assert.deepEqual(main[0].assetIds, ["vid-src"]);
  const ov = plan.scenes.find((s) => s.block === "overlay-lower-third")!;
  assert.equal(ov.startMs, 300);
  assert.equal((ov.data as { layer: string }).layer, "overlay");
  assert.deepEqual(plan.sfxCues, [{ atMs: 2120, cue: "pop" }]);
  assert.equal(plan.totalMs, 6200);
});
