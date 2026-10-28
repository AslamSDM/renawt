import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlatformMeta, normalizeHashtags, stripBrand, truncate } from "../meta";

const cp = (s: string) => [...s].length;

test("YouTube title ≤100, description ≤5000, no angle brackets", () => {
  const m = buildPlatformMeta("YOUTUBE", { title: "T".repeat(150), caption: "<b>" + "word ".repeat(1500), hashtags: ["a", "b"], aiGenerated: true });
  assert.ok(cp(m.title!) <= 100);
  assert.ok(cp(m.caption) <= 5000);
  assert.ok(!/[<>]/.test(m.caption));
  assert.equal(m.madeForKids, false, "COPPA declaration always explicit");
  assert.equal(m.aiGenerated, true);
  assert.ok(m.warnings.length > 0);
});

test("YouTube title falls back to first caption line without hashtags; tags ≤500 chars", () => {
  const m = buildPlatformMeta("YOUTUBE", { caption: "Why the sky is blue #science\nmore", hashtags: Array.from({ length: 100 }, (_, i) => `longtag${i}xxxxxxxx`) });
  assert.equal(m.title, "Why the sky is blue");
  assert.ok(m.tags!.join(",").length <= 500);
});

test("TikTok caption ≤2200 incl hashtags and ≤5 hashtags", () => {
  const m = buildPlatformMeta("TIKTOK", { caption: "x".repeat(2190), hashtags: ["one", "two", "three", "four", "five", "six", "seven"], privacy: "public" });
  assert.ok(cp(m.caption) <= 2200);
  assert.ok(m.hashtags.length <= 5);
  // hashtags dropped before body truncation
  assert.ok(m.caption.startsWith("x".repeat(2190)));
  const short = buildPlatformMeta("TIKTOK", { caption: "hello", hashtags: ["#a", "b", "c", "d", "e", "f"] });
  assert.equal(short.caption, "hello\n\n#a #b #c #d #e");
});

test("Instagram ≤30 hashtags, ≤2200 chars", () => {
  const m = buildPlatformMeta("INSTAGRAM", { caption: "hi", hashtags: Array.from({ length: 40 }, (_, i) => `t${i}`) });
  assert.equal(m.hashtags.length, 30);
  assert.ok(cp(m.caption) <= 2200);
});

test("Threads ≤500, X ≤280 (body truncated with ellipsis)", () => {
  const t = buildPlatformMeta("THREADS", { caption: "lorem ipsum ".repeat(100), hashtags: ["a", "b"] });
  assert.ok(cp(t.caption) <= 500);
  const x = buildPlatformMeta("X", { caption: "lorem ipsum ".repeat(50) });
  assert.ok(cp(x.caption) <= 280);
  assert.ok(x.caption.endsWith("…"));
});

test("hashtags already in caption are not duplicated", () => {
  const m = buildPlatformMeta("INSTAGRAM", { caption: "Learn #Physics today", hashtags: ["physics", "Science", "science"] });
  assert.equal(m.caption, "Learn #Physics today\n\n#Science");
});

test("brand is stripped and never added", () => {
  assert.equal(stripBrand("Made with Remawt: cool facts | remawt.com"), "cool facts");
  const m = buildPlatformMeta("TIKTOK", { title: "Remawt facts", caption: "Space facts — created with remawt #remawt", hashtags: ["remawt", "remawtai", "space"], privacy: "public" });
  assert.ok(!/remawt/i.test(m.caption), m.caption);
  assert.deepEqual(m.hashtags, ["space"]);
  const plain = buildPlatformMeta("INSTAGRAM", { caption: "Plain" });
  assert.equal(plain.caption, "Plain", "no watermark text added");
});

test("helpers", () => {
  assert.equal(truncate("hello world foo", 12), "hello world…");
  assert.ok(cp(truncate("😀".repeat(10), 5)) === 5);
  assert.deepEqual(normalizeHashtags(["#Foo", "foo", "bar-baz", "", "#"]), ["Foo", "barbaz"]);
});
