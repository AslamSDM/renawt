import { test } from "node:test";
import assert from "node:assert/strict";
import { clusterItems, formatTrends } from "../src/cluster";
import { scoreItems } from "../src/score";
import type { RawTrendItem, TaggedTrendItem, TrendTags } from "../src/types";

const now = new Date("2026-10-28T12:00:00Z");

/** 30 fake items: 12 on index funds (3 platforms), 9 on sleep myths, 6 on roman empire, 3 singletons. */
function fixture30(): TaggedTrendItem[] {
  const rows: Array<[RawTrendItem["platform"], string, number, string, string, number?]> = [];
  const idx = ["index funds vs etfs", "index fund vs etf", "etfs vs index funds", "index funds and etfs"];
  for (let i = 0; i < 12; i++) rows.push([i < 6 ? "YOUTUBE" : i < 10 ? "TIKTOK" : "REDDIT", `Index funds vs ETFs take ${i}`, 10_000 * (i + 1), idx[i % 4]!, i % 3 === 0 ? "chart-explains" : "x-vs-y", i === 0 ? 500 : undefined]);
  for (let i = 0; i < 9; i++) rows.push([i < 5 ? "YOUTUBE" : "TIKTOK", `Sleep myth number ${i}`, 5_000 * (i + 1), i % 2 ? "sleep myths" : "sleeping myth", "mythbust"]);
  for (let i = 0; i < 6; i++) rows.push(["YOUTUBE", `Rome fell because ${i}`, 3_000 * (i + 1), i % 2 ? "roman empire fall" : "fall of the roman empire", i < 4 ? "did-you-know" : "listicle-countdown"]);
  rows.push(["YOUTUBE", "Cats in boxes", 900, "cats boxes", "comedy-skit"]);
  rows.push(["YOUTUBE", "Volcano facts", 800, "volcano eruption", "did-you-know"]);
  rows.push(["TIKTOK", "Bread science", 700, "sourdough starter", "tutorial"]);
  assert.equal(rows.length, 30);
  const raw: RawTrendItem[] = rows.map(([platform, title, views, , , median], i) => ({
    platform, kind: platform === "REDDIT" ? "signal" : "content", url: `https://example.com/${platform}/${i}`, title, views,
    creatorMedianViews: median, publishedAt: new Date(now.getTime() - (10 + i) * 3600_000),
  }));
  const scored = scoreItems(raw, undefined, { now, dedupe: false });
  return scored.map((s) => {
    const i = raw.findIndex((r) => r.url === s.url);
    const [, , , topic, format] = rows[i]!;
    const tags: TrendTags = { topic, format, hookType: "question" };
    return { ...s, id: `i${i}`, tags };
  });
}

test("clusters 30 items into topic cards", () => {
  const cards = clusterItems(fixture30(), { niche: "personal-finance", weekKey: "2026-W44" });
  assert.equal(cards.length, 3, cards.map((c) => c.topic).join(" | "));
  const [a, b, c] = cards;
  assert.equal(a!.itemCount, 12);
  assert.equal(a!.format, "x-vs-y", "mode of formats");
  assert.deepEqual(new Set(a!.platforms), new Set(["YOUTUBE", "TIKTOK", "REDDIT"]));
  assert.equal(a!.exemplars.length, 3);
  assert.ok(a!.exemplars.every((e) => e.platform !== "REDDIT"), "signals aren't exemplars when content exists");
  assert.ok(a!.breakoutCount >= 1);
  assert.equal(a!.producibleFormat, "x-vs-y");
  assert.equal(b!.itemCount, 9);
  assert.equal(b!.format, "mythbust");
  assert.equal(c!.itemCount, 6);
  assert.equal(c!.format, "did-you-know");
  assert.ok(a!.score > b!.score && b!.score > c!.score);
  assert.equal(a!.weekKey, "2026-W44");
  // exemplars sorted by outlier×velocity weight: item 0 has a 500-view creator median → 20× outlier
  assert.equal(a!.exemplars[0]!.url, "https://example.com/YOUTUBE/0");
});

test("singletons survive only as breakouts", () => {
  const items = fixture30();
  const cats = items.find((i) => i.title === "Cats in boxes")!;
  cats.breakout = true;
  const cards = clusterItems(items);
  assert.ok(cards.some((c) => c.topic === "cats boxes"));
});

test("formatTrends computes WoW share deltas", () => {
  const last = [{ format: "x-vs-y", itemCount: 4 }, { format: "mythbust", itemCount: 46 }, { format: "did-you-know", itemCount: 50 }];
  const now_ = [{ format: "x-vs-y", itemCount: 12 }, { format: "mythbust", itemCount: 38 }, { format: "did-you-know", itemCount: 50 }];
  const t = formatTrends(now_, last);
  assert.equal(t[0]!.format, "x-vs-y");
  assert.ok(Math.abs(t[0]!.delta - 0.08) < 1e-9);
  assert.ok(Math.abs(t[0]!.shareThis - 0.12) < 1e-9);
  assert.equal(t.at(-1)!.format, "mythbust");
  const fresh = formatTrends([{ format: "quiz" }], []);
  assert.equal(fresh[0]!.shareThis, 1);
  assert.equal(fresh[0]!.shareLast, 0);
});
