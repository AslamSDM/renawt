import { test } from "node:test";
import assert from "node:assert/strict";
import { TtlCache } from "../src/cache";
import { createYoutubeQuota, pacificDayKey, QuotaBudgeter, QuotaExceededError } from "../src/quota";
import { youtubeBreakout, youtubeMostPopular } from "../src/sources/youtube";
import type { QuotaCounter } from "../src/types";
import { fakeFetch, fixture } from "./helpers";

test("pacific day key rolls at PT midnight, not UTC", () => {
  assert.equal(pacificDayKey(new Date("2026-10-28T06:59:00Z")), "2026-10-27");
  assert.equal(pacificDayKey(new Date("2026-10-28T07:01:00Z")), "2026-10-28");
});

test("search bucket allows 90 calls/day (10% reserve) then refuses", async () => {
  const q = createYoutubeQuota();
  let ok = 0;
  for (let i = 0; i < 120; i++) if (await q.tryConsume("search")) ok++;
  assert.equal(ok, 90);
  assert.equal(await q.remaining("search"), 0);
  assert.equal(await q.remaining("default"), 9000, "buckets are independent");
  await assert.rejects(q.consume("search"), QuotaExceededError);
});

test("budget resets on a new day", async () => {
  let now = new Date("2026-10-28T12:00:00Z");
  const q = new QuotaBudgeter("t", { b: { limit: 2 } }, { now: () => now });
  assert.ok(await q.tryConsume("b", 2));
  assert.equal(await q.tryConsume("b"), false);
  now = new Date("2026-10-29T12:00:00Z");
  assert.ok(await q.tryConsume("b"));
});

test("injected persistent counter is shared across budgeters and rolls back on race", async () => {
  const store = new Map<string, number>();
  const counter: QuotaCounter = { get: async (k) => store.get(k) ?? 0, incr: async (k, by) => { const v = (store.get(k) ?? 0) + by; store.set(k, v); return v; } };
  const a = new QuotaBudgeter("yt", { search: { limit: 3 } }, { counter });
  const b = new QuotaBudgeter("yt", { search: { limit: 3 } }, { counter });
  assert.ok(await a.tryConsume("search"));
  assert.ok(await b.tryConsume("search"));
  assert.ok(await a.tryConsume("search"));
  assert.equal(await b.tryConsume("search"), false);
  assert.equal(await a.used("search"), 3);
  // simulate a racing process that slipped in between get and incr
  const racy: QuotaCounter = { get: async () => 0, incr: counter.incr };
  const c = new QuotaBudgeter("yt", { search: { limit: 3 } }, { counter: racy });
  assert.equal(await c.tryConsume("search"), false);
  assert.equal([...store.values()][0], 3, "rolled back");
});

const niche = { slug: "personal-finance", name: "Personal finance", keywords: ["money", "saving", "budget"], subreddits: [], youtubeCategoryId: "22" };

test("youtubeBreakout: search → videos → channels, consumes buckets, caches 6h", async () => {
  const { fetch, calls } = fakeFetch([
    [/\/search\?/, fixture("youtube-search.json")],
    [/\/videos\?/, fixture("youtube-videos.json")],
    [/\/channels\?/, fixture("youtube-channels.json")],
  ]);
  let t = new Date("2026-10-28T12:00:00Z").getTime();
  const cache = new TtlCache(() => t);
  const quota = createYoutubeQuota(undefined, () => new Date(t));
  const ctx = { env: { YOUTUBE_API_KEY: "k" }, fetch, cache, youtubeQuota: quota, now: new Date(t) };
  const items = await youtubeBreakout(niche, ctx);
  assert.equal(items.length, 2);
  assert.equal(calls.filter((c) => c.includes("/search?")).length, 2, "maxQueries=2");
  assert.ok(calls[0]!.includes("videoDuration=short") && calls[0]!.includes("order=viewCount") && calls[0]!.includes("publishedAfter=2026-10-21"));
  assert.equal(await quota.used("search"), 2);
  assert.equal(await quota.used("default"), 2, "videos.list + channels.list");
  const small = items.find((i) => i.externalId === "abc123")!;
  assert.equal(small.creatorMedianViews, 10_000);
  assert.equal(small.query, "money");
  await youtubeBreakout(niche, ctx);
  assert.equal(calls.length, 4, "served from cache");
  t += 6 * 3600_000 + 1;
  await youtubeBreakout(niche, { ...ctx, now: new Date(t) });
  assert.equal(calls.length, 8, "cache expired");
});

test("youtubeBreakout stops when search bucket is empty", async () => {
  const { fetch, calls } = fakeFetch([[/./, { items: [] }]]);
  const quota = new QuotaBudgeter("yt", { default: { limit: 100 }, search: { limit: 0 } });
  const items = await youtubeBreakout(niche, { env: { YOUTUBE_API_KEY: "k" }, fetch, cache: new TtlCache(), youtubeQuota: quota });
  assert.deepEqual(items, []);
  assert.equal(calls.length, 0);
});

test("youtubeMostPopular: one call per region with category", async () => {
  const { fetch, calls } = fakeFetch([[/chart=mostPopular/, fixture("youtube-videos.json")]]);
  const quota = createYoutubeQuota();
  const items = await youtubeMostPopular(niche, { env: { YOUTUBE_API_KEY: "k" }, fetch, cache: new TtlCache(), youtubeQuota: quota }, { regions: ["US", "IN"] });
  assert.equal(calls.length, 2);
  assert.ok(calls.every((c) => c.includes("videoCategoryId=22")));
  assert.equal(items.length, 4);
  assert.deepEqual([...new Set(items.map((i) => i.region))], ["US", "IN"]);
  assert.equal(await quota.used("default"), 2);
  assert.deepEqual(await youtubeMostPopular({ ...niche, youtubeCategoryId: undefined }, { env: { YOUTUBE_API_KEY: "k" }, fetch }), []);
});
