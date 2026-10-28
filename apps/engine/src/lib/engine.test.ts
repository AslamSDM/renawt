import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateBeatDurations, alignScenes, lineWordRanges, wordGapBoundaries } from "./planning/allocate.js";
import { chunkCaptions, wordsFromCharAlignment, estimateWordTimings, type Word } from "./captions.js";
import { originality, cosine, tfidfVectors, docTerms } from "./qc/originality.js";
import { estimateLlmUsd, isDeepseekOffPeak, priceKey, estimateTtsUsd } from "./pricing.js";
import { buildSegments, editTimeline, remapWords, cutInTarget, timelineDuration } from "./edit/segments.js";
import { buildMuxArgs } from "./render/ffmpeg.js";
import { chooseFit, trimConcatArgs } from "./media/ingest.js";
import { policyLint } from "./qc/policy.js";

const words = (text: string, gapMs = 60, wordMs = 300): Word[] => {
  let t = 0;
  return text.split(" ").map((w) => { const x = { w, s: t, e: t + wordMs }; t += wordMs + gapMs; return x; });
};

// ───────── beat allocation ─────────
test("allocateBeatDurations splits by share and sums exactly", () => {
  const r = allocateBeatDurations([{ id: "a", share: 0.1 }, { id: "b", share: 0.6 }, { id: "c", share: 0.3 }], 45_000);
  assert.deepEqual(r.map((x) => x.durationMs), [4500, 27000, 13500]);
  assert.equal(r.reduce((s, x) => s + x.durationMs, 0), 45_000);
  assert.equal(r[1].startMs, 4500);
});

test("allocateBeatDurations normalises shares that don't sum to 1", () => {
  const r = allocateBeatDurations([{ id: "a", share: 1 }, { id: "b", share: 3 }], 4000);
  assert.deepEqual(r.map((x) => x.durationMs), [1000, 3000]);
});

test("alignScenes cuts on word gaps at line starts and covers the whole narration", () => {
  const lines = [{ beatId: "hook", text: "Why is the sky blue" }, { beatId: "reveal", text: "Sunlight scatters off air molecules" }, { beatId: "reveal", text: "Blue light scatters the most" }, { beatId: "loop", text: "Follow for more" }];
  const w = words(lines.map((l) => l.text).join(" "));
  const totalMs = w[w.length - 1].e + 200;
  const out = alignScenes({
    scenes: [{ id: "s1", beatId: "hook" }, { id: "s2", beatId: "reveal" }, { id: "s3", beatId: "reveal" }, { id: "s4", beatId: "loop" }],
    lines, beats: [{ id: "hook", share: 0.1 }, { id: "reveal", share: 0.7 }, { id: "loop", share: 0.2 }], words: w, totalMs, minSceneMs: 300,
  });
  assert.equal(out[0].startMs, 0);
  assert.equal(out.reduce((s, x) => s + x.durationMs, 0), totalMs);
  const gaps = new Set(wordGapBoundaries(w, totalMs));
  for (const s of out) assert.ok(gaps.has(s.startMs), `scene ${s.id} starts mid-word at ${s.startMs}`);
  // reveal beat starts exactly at the gap before "Sunlight" (word index 5)
  assert.equal(out[1].startMs, Math.round((w[4].e + w[5].s) / 2));
  // loop starts at the gap before "Follow"
  const fi = w.findIndex((x) => x.w === "Follow");
  assert.equal(out[3].startMs, Math.round((w[fi - 1].e + w[fi].s) / 2));
});

test("alignScenes falls back to shares when narration doesn't match the script", () => {
  const w = words("completely different words here that do not match anything at all in the script whatsoever okay");
  const totalMs = w[w.length - 1].e;
  const out = alignScenes({ scenes: [{ id: "a", beatId: "x" }, { id: "b", beatId: "y" }], lines: [{ beatId: "x", text: "one" }, { beatId: "y", text: "two" }], beats: [{ id: "x", share: 0.5 }, { id: "y", share: 0.5 }], words: w, totalMs });
  assert.equal(out.length, 2);
  assert.ok(Math.abs(out[1].startMs - totalMs / 2) < 400);
});

test("lineWordRanges returns null on large mismatch", () => {
  assert.equal(lineWordRanges(["a b c d e f g h i j"], words("a b")), null);
  assert.deepEqual(lineWordRanges(["a b", "c d e"], words("a b c d e")), [[0, 1], [2, 4]]);
});

test("alignScenes nudges cuts onto the music beat grid only inside word gaps", () => {
  const lines = [{ beatId: "a", text: "one two three" }, { beatId: "b", text: "four five six" }];
  const w = words("one two three four five six", 400, 300);
  const out = alignScenes({ scenes: [{ id: "s1", beatId: "a" }, { id: "s2", beatId: "b" }], lines, beats: [{ id: "a", share: 0.5 }, { id: "b", share: 0.5 }], words: w, totalMs: 4200, beatMs: 500 });
  // gap between "three" (1400–1700) and "four" (2100–2400): midpoint 1900 → beat 2000 is inside → snapped
  assert.equal(out[1].startMs, 2000);
});

// ───────── captions ─────────
test("wordsFromCharAlignment aggregates characters into ms words", () => {
  const chars = [..."Hi there"];
  const starts = chars.map((_, i) => i * 0.1);
  const ends = chars.map((_, i) => i * 0.1 + 0.08);
  assert.deepEqual(wordsFromCharAlignment(chars, starts, ends), [{ w: "Hi", s: 0, e: 180 }, { w: "there", s: 300, e: 780 }]);
});

test("chunkCaptions respects word limit, sentence ends and pauses", () => {
  const w: Word[] = [
    { w: "This", s: 0, e: 200 }, { w: "is", s: 250, e: 350 }, { w: "a", s: 400, e: 450 }, { w: "test.", s: 500, e: 800 },
    { w: "Next", s: 900, e: 1100 }, { w: "line", s: 1150, e: 1400 }, { w: "after", s: 2200, e: 2500 }, { w: "pause", s: 2550, e: 2900 },
  ];
  const c = chunkCaptions(w, { maxWords: 4 });
  assert.deepEqual(c.map((x) => x.text), ["This is a test.", "Next line", "after pause"]);
  assert.equal(c[1].s, 900);
  assert.equal(c[2].e, 2900);
});

test("chunkCaptions splits long runs by char limit", () => {
  const c = chunkCaptions(words("extraordinarily complicated multisyllabic vocabulary"), { maxWords: 4, maxChars: 22 });
  assert.ok(c.every((x) => x.text.length <= 22 || x.words.length === 1));
  assert.ok(c.length >= 2);
});

test("estimateWordTimings is monotone and fits the duration", () => {
  const w = estimateWordTimings("One fact. Then another, and a third.", 3000);
  assert.equal(w.length, 7);
  for (let i = 1; i < w.length; i++) assert.ok(w[i].s >= w[i - 1].e);
  assert.ok(w[w.length - 1].e <= 3000);
});

// ───────── originality ─────────
test("originality: identical script + structure ≈ duplicate, unrelated ≈ original", () => {
  const a = { text: "Index funds beat most stock pickers because fees compound over decades", blocks: ["kinetic-headline", "chart", "chart", "outro"] };
  const same = { id: "v1", ...a };
  const other = { id: "v2", text: "The Roman empire split in two because of administrative overload", blocks: ["map", "timeline", "kinetic-headline"] };
  const dup = originality(a, [same, other]);
  assert.ok(dup.maxSimilarity > 0.95);
  assert.equal(dup.mostSimilarId, "v1");
  assert.ok(dup.flags.includes("near_duplicate"));
  const fresh = originality(a, [other]);
  assert.ok(fresh.score > 0.8, `score ${fresh.score}`);
  assert.deepEqual(fresh.flags, []);
});

test("originality catches same template with new words via block bigrams", () => {
  const blocks = ["kinetic-headline", "split-stat", "split-stat", "split-stat", "outro"];
  const r = originality({ text: "cats versus dogs", blocks }, [{ id: "p", text: "tea versus coffee", blocks }]);
  assert.ok(r.maxSimilarity > 0.3);
  assert.equal(originality({ text: "x", blocks: [] }, []).score, 1);
});

test("cosine of tf-idf vectors is symmetric and bounded", () => {
  const [a, b] = tfidfVectors([docTerms({ text: "alpha beta gamma", blocks: [] }), docTerms({ text: "beta gamma delta", blocks: [] })]);
  const s = cosine(a, b);
  assert.ok(s > 0 && s < 1);
  assert.equal(s, cosine(b, a));
});

// ───────── pricing ─────────
test("pricing: Sonnet 5.5 with cache hits", () => {
  const usd = estimateLlmUsd("anthropic", "anthropic/claude-sonnet-5-5", { inputTokens: 100_000, outputTokens: 10_000, cachedTokens: 80_000 });
  // 20k uncached × $2 + 80k cached × $0.20 + 10k out × $10, per MTok
  assert.equal(usd, (20_000 * 2 + 80_000 * 0.2 + 10_000 * 10) / 1e6);
});

test("pricing: haiku, opus, unknown model", () => {
  assert.equal(estimateLlmUsd("anthropic", "claude-haiku-5-5", { inputTokens: 1_000_000, outputTokens: 1_000_000 }), 0.6);
  assert.equal(estimateLlmUsd("anthropic", "anthropic/claude-opus-5-5", { inputTokens: 1_000_000, outputTokens: 0, cacheWriteTokens: 1_000_000 }), 5);
  assert.equal(estimateLlmUsd("openai", "gpt-x", { inputTokens: 1, outputTokens: 1 }), null);
  assert.equal(priceKey("anthropic", "claude-sonnet-5-5"), "anthropic/claude-sonnet-5-5");
});

test("pricing: DeepSeek off-peak discount and peak windows", () => {
  const peak = new Date("2026-10-28T07:00:00Z"); // Wednesday 07:00 UTC
  const off = new Date("2026-10-28T12:00:00Z");
  const weekend = new Date("2026-10-31T07:00:00Z");
  assert.equal(isDeepseekOffPeak(peak), false);
  assert.equal(isDeepseekOffPeak(off), true);
  assert.equal(isDeepseekOffPeak(weekend), true);
  const u = { inputTokens: 1_000_000, outputTokens: 1_000_000 };
  assert.equal(estimateLlmUsd("deepseek", "deepseek/deepseek-flash", u, peak), 1.5);
  assert.equal(estimateLlmUsd("deepseek", "deepseek/deepseek-flash", u, off), 0.75);
});

test("pricing: TTS per character", () => {
  assert.equal(estimateTtsUsd("elevenlabs", "eleven_flash_v2_5", 900), 0.036);
});

// ───────── user media editing ─────────
test("buildSegments splits on pauses/sentences and isolates fillers", () => {
  const w: Word[] = [
    { w: "Um", s: 0, e: 200 }, { w: "so", s: 250, e: 400 }, { w: "index", s: 450, e: 700 }, { w: "funds", s: 750, e: 1000 }, { w: "win.", s: 1050, e: 1300 },
    { w: "Here's", s: 2500, e: 2800 }, { w: "why", s: 2850, e: 3100 }, { w: "uh", s: 3150, e: 3300 },
  ];
  const segs = buildSegments(w);
  assert.deepEqual(segs.map((s) => [s.kind, s.text]), [["filler", "Um"], ["speech", "so index funds win."], ["silence", ""], ["speech", "Here's why"], ["filler", "uh"]]);
  assert.equal(segs.find((s) => s.kind === "silence")!.keep, false);
});

test("editTimeline + remapWords produce a contiguous edited timeline", () => {
  const w: Word[] = [{ w: "a.", s: 1000, e: 1500 }, { w: "b.", s: 5000, e: 5600 }, { w: "c.", s: 9000, e: 9400 }];
  const segs = buildSegments(w);
  const speech = segs.filter((s) => s.kind === "speech");
  const pieces = editTimeline(segs, new Set([speech[0].id, speech[2].id]), 100);
  assert.deepEqual(pieces.map((p) => [p.srcStartMs, p.srcEndMs, p.editStartMs]), [[900, 1600, 0], [8900, 9500, 700]]);
  assert.equal(timelineDuration(pieces), 1300);
  assert.deepEqual(remapWords(w, pieces), [{ w: "a.", s: 100, e: 600 }, { w: "c.", s: 800, e: 1200 }]);
});

test("cutInTarget follows density", () => {
  assert.equal(cutInTarget(60_000, "light"), 3);
  assert.equal(cutInTarget(60_000, "medium"), 5);
  assert.equal(cutInTarget(64_000, "heavy"), 8);
  assert.equal(cutInTarget(5_000, "light"), 1);
});

test("chooseFit: 9:16 scale, 16:9 crop, square blur-pad", () => {
  assert.equal(chooseFit({ width: 1080, height: 1920 }), "scale");
  assert.equal(chooseFit({ width: 1920, height: 1080 }), "crop");
  assert.equal(chooseFit({ width: 1080, height: 1080 }), "blurpad");
  assert.equal(chooseFit({ width: 1920, height: 1080 }, "1:1"), "blurpad");
});

test("ffmpeg argv builders", () => {
  const mux = buildMuxArgs({ videoPath: "v.mp4", narration: "n.mp3", music: "m.mp3", sfx: [{ atMs: 1500, src: "s.mp3" }], durationMs: 30_000, outputPath: "o.mp4" });
  const fc = mux[mux.indexOf("-filter_complex") + 1];
  assert.match(fc, /amix=inputs=3/);
  assert.match(fc, /adelay=1500\|1500/);
  assert.ok(mux.includes("-stream_loop"));
  const trim = trimConcatArgs("src.mp4", [{ startMs: 0, endMs: 1000 }, { startMs: 2000, endMs: 2500 }], "o.mp3");
  assert.match(trim[trim.indexOf("-filter_complex") + 1], /concat=n=2:v=0:a=1/);
});

// ───────── policy ─────────
test("policyLint flags advisor phrasing only in regulated niches and missing sources", () => {
  const script = { title: "t", hook: "h", cta: "c", sources: [], hashtags: [], description: "", estimatedSec: 30, lines: [{ beatId: "hook", text: "As your financial advisor, you should buy this ETF now.", targetSec: 3 }] };
  const fin = policyLint(script, { niche: "personal-finance", format: "chart-explains" });
  assert.ok(fin.flags.includes("advisor_persona"));
  assert.ok(fin.flags.includes("directive_advice"));
  assert.ok(fin.flags.includes("missing_sources"));
  assert.equal(fin.blocking, true);
  const hist = policyLint(script, { niche: "history", format: "did-you-know" });
  assert.deepEqual(hist.flags, []);
});
