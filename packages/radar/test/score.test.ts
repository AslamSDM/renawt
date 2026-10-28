import { test } from "node:test";
import assert from "node:assert/strict";
import { ageHoursOf, computeBaseline, corroborationCounts, dedupeItems, scoreItems } from "../src/score";
import type { RawTrendItem } from "../src/types";

const now = new Date("2026-10-28T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);
const yt = (o: Partial<RawTrendItem>): RawTrendItem => ({ platform: "YOUTUBE", kind: "content", url: `https://www.youtube.com/watch?v=${Math.random().toString(36).slice(2)}`, title: "x", views: 0, ...o });

test("ageHours, velocity and outlier math", () => {
  assert.equal(ageHoursOf({ publishedAt: hoursAgo(10) }, now), 10);
  assert.equal(ageHoursOf({ publishedAt: hoursAgo(0.1) }, now), 1, "min 1h");
  assert.equal(ageHoursOf({}, now), 72, "unknown age default");
  const [a] = scoreItems([yt({ title: "solo", views: 10_000, creatorMedianViews: 1_000, publishedAt: hoursAgo(20) })], undefined, { now });
  assert.equal(a!.ageHours, 20);
  assert.equal(a!.velocity, 500);
  assert.equal(a!.outlier, 10);
  assert.equal(a!.breakout, true);
});

test("outlier falls back to niche median per platform", () => {
  const items = [
    yt({ title: "alpha one", views: 100, publishedAt: hoursAgo(10) }),
    yt({ title: "beta two", views: 200, publishedAt: hoursAgo(10) }),
    yt({ title: "gamma three", views: 3000, publishedAt: hoursAgo(10) }),
    { platform: "REDDIT", kind: "signal", url: "https://reddit.com/r/a/1", title: "delta four", views: 50, publishedAt: hoursAgo(5) } as RawTrendItem,
  ];
  const out = scoreItems(items, undefined, { now });
  const gamma = out.find((i) => i.title === "gamma three")!;
  assert.equal(gamma.outlier, 3000 / 200, "median of 100/200/3000 = 200");
  const reddit = out.find((i) => i.platform === "REDDIT")!;
  assert.equal(reddit.outlier, 1, "own platform median");
  assert.ok(gamma.zscore! > 0);
  assert.equal(out[0]!.title, "gamma three", "sorted by score");
});

test("z-score uses stored baseline when it has more samples", () => {
  const baseline = computeBaseline(Array.from({ length: 50 }, (_, i) => yt({ title: `t${i}`, views: 100 + i, publishedAt: hoursAgo(10) })), now);
  const [x] = scoreItems([yt({ title: "big", views: 100_000, publishedAt: hoursAgo(10) })], baseline, { now });
  assert.ok(x!.zscore! > 5, `z=${x!.zscore}`);
  assert.ok(Math.abs(x!.outlier - 100_000 / baseline.byPlatform.YOUTUBE!.medianViews) < 1e-9);
});

test("dedupe by url and by near-identical title on same platform", () => {
  const items: RawTrendItem[] = [
    yt({ url: "https://www.youtube.com/watch?v=AAA&utm_source=x", title: "Why the Roman empire fell", views: 10 }),
    yt({ url: "https://youtu.be/AAA", title: "Why the Roman empire fell", views: 50 }),
    yt({ url: "https://youtube.com/shorts/BBB", title: "Why the Roman Empire fell!", views: 20 }),
    { platform: "REDDIT", kind: "signal", url: "https://reddit.com/r/history/x", title: "Why the Roman empire fell", views: 5 },
  ];
  const out = dedupeItems(items);
  assert.equal(out.length, 2, "one YT (url+title dupes) + one reddit");
  assert.equal(out.find((i) => i.platform === "YOUTUBE")!.views, 50);
});

test("cross-platform corroboration bonus", () => {
  const items: RawTrendItem[] = [
    yt({ title: "Index funds vs ETFs: which wins?", views: 1000, publishedAt: hoursAgo(10) }),
    { platform: "REDDIT", kind: "signal", url: "https://reddit.com/r/pf/1", title: "index funds or ETFs for beginners", views: 300, publishedAt: hoursAgo(10) },
    { platform: "GOOGLE_TRENDS", kind: "signal", url: "https://trends.google.com/q=1", title: "index funds vs etfs", views: 350 },
    yt({ title: "Cats sleeping compilation", views: 1000, publishedAt: hoursAgo(10) }),
  ];
  const c = corroborationCounts(items);
  assert.deepEqual(c, [3, 3, 3, 1]);
  const scored = scoreItems(items, undefined, { now, dedupe: false });
  const idx = scored.find((i) => i.title.startsWith("Index"))!;
  const cats = scored.find((i) => i.title.startsWith("Cats"))!;
  assert.equal(idx.corroboration, 3);
  assert.ok(idx.score! > cats.score!, "same views, corroborated item ranks higher");
});
