import { test } from "node:test";
import assert from "node:assert/strict";
import { heuristicTags, ideasForChannel, refreshNiche } from "../src/index";
import type { RadarDb } from "../src/persist";
import type { RawTrendItem, TrendSource } from "../src/types";

const now = new Date("2026-10-28T12:00:00Z");
const mk = (platform: RawTrendItem["platform"], i: number, title: string, views: number, extra: Partial<RawTrendItem> = {}): RawTrendItem =>
  ({ platform, kind: platform === "REDDIT" ? "signal" : platform === "NEWS" ? "evidence" : "content", url: `https://ex.com/${platform}/${i}`, title, views, publishedAt: new Date(now.getTime() - (5 + i) * 3600_000), ...extra });

const fakeSources: TrendSource[] = [
  { id: "yt", cadence: "daily", isConfigured: () => true, fetch: async () => [
    mk("YOUTUBE", 1, "Index funds vs ETFs: which wins?", 300_000, { creatorMedianViews: 10_000 }),
    mk("YOUTUBE", 2, "ETFs vs index funds explained", 80_000),
    mk("YOUTUBE", 3, "5 money myths debunked", 50_000),
    mk("YOUTUBE", 4, "Money myths you still believe", 40_000),
  ] },
  { id: "rd", cadence: "daily", isConfigured: () => true, fetch: async () => [mk("REDDIT", 5, "Index funds vs ETFs for beginners?", 400)] },
  { id: "news", cadence: "weekly", isConfigured: () => true, fetch: async () => [mk("NEWS", 6, "Index funds vs ETFs: fees hit record low", 0, { creator: "reuters.com" })] },
  { id: "broken", cadence: "daily", isConfigured: () => true, fetch: async () => { throw new Error("boom"); } },
  { id: "off", cadence: "daily", isConfigured: () => false, fetch: async () => { throw new Error("should not run"); } },
];

function fakeDb() {
  const items = new Map<string, unknown>();
  const cards: Array<Record<string, unknown> & { id: string }> = [];
  const ideas: Array<Record<string, unknown>> = [];
  let n = 0;
  const db = {
    trendItem: {
      upsert: async ({ where, create }: { where: { platform_url: { platform: string; url: string } }; create: unknown }) => { items.set(`${where.platform_url.platform}|${where.platform_url.url}`, create); return create; },
      findMany: async () => [],
    },
    trendCard: {
      findMany: async ({ where, select }: { where: { niche: string; weekKey: string }; select?: unknown }) =>
        cards.filter((c) => c.niche === where.niche && c.weekKey === where.weekKey).map((c) => (select ? { ...c, _count: { ideas: 0 } } : c)).sort((a, b) => (b.score as number) - (a.score as number)),
      create: async ({ data }: { data: Record<string, unknown> }) => { const c = { ...data, id: `card${++n}` }; cards.push(c); return { id: c.id }; },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => { const c = cards.find((x) => x.id === where.id)!; Object.assign(c, data); return c; },
      deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => { for (const id of where.id.in) cards.splice(cards.findIndex((c) => c.id === id), 1); return { count: where.id.in.length }; },
    },
    idea: {
      create: async ({ data }: { data: Record<string, unknown> }) => { const id = `idea${ideas.length + 1}`; ideas.push({ ...data, id }); return { id }; },
      findMany: async () => [{ title: "Gold is a scam" }],
    },
    video: { findMany: async () => [] },
    metricSnapshot: {
      findMany: async () => [
        { publicationId: "p1", t: "7d", outlierScore: 4, publication: { video: { format: "x-vs-y", title: "a", idea: null } } },
        { publicationId: "p1", t: "24h", outlierScore: 0.1, publication: { video: { format: "x-vs-y", title: "a", idea: null } } },
      ],
    },
  };
  return { db: db as unknown as RadarDb, items, cards, ideas };
}

test("heuristicTags strips format words from topic", () => {
  const t = heuristicTags({ title: "Top 5 money myths debunked" });
  assert.equal(t.format, "mythbust");
  assert.equal(t.topic, "money myth debunk");
});

test("refreshNiche: sources → score → tag → cluster → persist", async () => {
  const { db, items, cards } = fakeDb();
  let taggerCalls = 0;
  const runTagger = async (p: { prompt: string }) => {
      taggerCalls++;
      const ids = [...p.prompt.matchAll(/"id":"(i\d+)"[^\n]*"title":"([^"]+)"/g)].map((m) => [m[1]!, m[2]!] as const);
      // tag everything except one item → that one uses the heuristic fallback
      return { tags: ids.slice(0, -1).map(([id, title]) => /myth/i.test(title)
        ? { id, topic: "money myths", format: "mythbust", hookType: "contrarian" }
        : { id, topic: "index funds vs etfs", format: "x-vs-y", hookType: "question" }) };
  };
  const res = await refreshNiche({ niche: "personal-finance", env: {}, prisma: db, sources: fakeSources, now, runTagger });
  assert.equal(taggerCalls, 1);
  assert.equal(res.weekKey, "2026-W44");
  assert.equal(res.itemsFetched, 6);
  assert.deepEqual(res.sources.map((s) => [s.id, s.items, Boolean(s.error)]), [["yt", 4, false], ["rd", 1, false], ["news", 1, false], ["broken", 0, true]]);
  assert.equal(res.tagger.heuristic, 1);
  assert.equal(items.size, 4, "only DB platforms persisted (YOUTUBE)");
  assert.ok(res.cards.length >= 2);
  const top = res.cards[0]!;
  assert.equal(top.topic, "index funds vs etfs");
  assert.equal(top.format, "x-vs-y");
  assert.ok(top.evidence.some((e) => e.source === "reuters.com"), "news attached as evidence");
  assert.ok("id" in top && typeof top.id === "string");
  assert.equal(cards.length, res.cards.length);
  // re-run with the same tags updates in place (ids stable, no duplicates)
  const ids1 = cards.map((c) => c.id).sort();
  taggerCalls = 0;
  await refreshNiche({ niche: "personal-finance", env: {}, prisma: db, sources: fakeSources, now, runTagger });
  assert.deepEqual(cards.map((c) => c.id).sort(), ids1);
});

test("refreshNiche dry run without prisma or tagger", async () => {
  const res = await refreshNiche({ niche: { slug: "x", keywords: [], subreddits: [] }, env: {}, sources: fakeSources, now });
  assert.equal(res.itemsPersisted, 0);
  assert.equal(res.tagger.batches, 0);
  assert.ok(res.cards.length >= 1);
  await assert.rejects(refreshNiche({ niche: "nope", env: {}, sources: [] }), /Unknown niche/);
});

test("ideasForChannel: cards + bandit mix → validated ideas persisted", async () => {
  const { db, ideas } = fakeDb();
  await refreshNiche({ niche: "personal-finance", env: {}, prisma: db, sources: fakeSources, now });
  let seenPrompt = "";
  const res = await ideasForChannel({
    channel: { id: "ch1", niche: "personal-finance", kit: { audience: "20s", promise: "money", formatPrefs: [] } },
    prisma: db, now,
    runIdeator: async (p) => {
      seenPrompt = p.system + p.prompt;
      return { ideas: [
        { hook: "Which one quietly costs more?", title: "Index funds vs ETFs: the hidden fee", format: "x-vs-y", angle: "fees compound", beats: [{ label: "a", durationSec: 5, note: "" }, { label: "b", durationSec: 30, note: "" }], evidence: [{ url: "https://ex.com/YOUTUBE/1", title: "t" }], risk: { level: "low", flags: [] }, score: 0.8 },
        { hook: "Gold?", title: "Gold is a scam", format: "mythbust", angle: "fees compound", beats: [{ label: "a", durationSec: 5, note: "" }, { label: "b", durationSec: 30, note: "" }], evidence: [], risk: { level: "low", flags: [] }, score: 0.5 },
      ] };
    },
  });
  assert.match(seenPrompt, /Gold is a scam/, "recent titles in prompt");
  assert.match(seenPrompt, /NO 'AI advisor'/);
  assert.equal(res.drafts.length, 1, "recent title deduped");
  assert.deepEqual(res.ideaIds, ["idea1"]);
  assert.equal(ideas[0]!.channelId, "ch1");
  assert.equal(Object.values(res.formatMix).reduce((a, b) => a + b, 0), 10);
  assert.equal(res.weekKey, "2026-W44");
});
