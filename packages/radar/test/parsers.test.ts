import { test } from "node:test";
import assert from "node:assert/strict";
import { apifyTiktokConfigured, parseApifyTiktok } from "../src/sources/apifyTiktok";
import { exaConfigured, parseExaResults, exaNews } from "../src/sources/exa";
import { googleTrendsRising, parseGoogleTrendsExplore } from "../src/sources/googleTrends";
import { parseRedditListing, redditTrends } from "../src/sources/reddit";
import { parseChannelMedians, parseIsoDuration, parseSearchIds, parseYoutubeVideos } from "../src/sources/youtube";
import { configuredSources, dueSources, SOURCES } from "../src/sources";
import { fakeFetch, fixture } from "./helpers";

test("ISO durations", () => {
  assert.equal(parseIsoDuration("PT48S"), 48);
  assert.equal(parseIsoDuration("PT1M5S"), 65);
  assert.equal(parseIsoDuration("PT1H"), 3600);
  assert.equal(parseIsoDuration("P1DT1S"), 86401);
  assert.equal(parseIsoDuration("garbage"), undefined);
});

test("youtube parsers", () => {
  const medians = parseChannelMedians(fixture("youtube-channels.json"));
  assert.deepEqual([...medians], [["UC_small", 10_000], ["UC_big", 300_000]]);
  assert.deepEqual(parseSearchIds(fixture("youtube-search.json")), ["abc123", "def456"]);
  const items = parseYoutubeVideos(fixture("youtube-videos.json"), { channelMedians: medians, region: "US" });
  assert.equal(items.length, 2, "skips items without title");
  const [a, b] = items;
  assert.equal(a!.url, "https://www.youtube.com/watch?v=abc123");
  assert.equal(a!.views, 250_000);
  assert.equal(a!.likes, 12_000);
  assert.equal(a!.lengthSec, 48);
  assert.equal(a!.creatorMedianViews, 10_000);
  assert.equal(a!.publishedAt!.toISOString(), "2026-10-27T12:00:00.000Z");
  assert.equal(a!.thumbnailUrl, "https://i.ytimg.com/vi/abc123/hqdefault.jpg");
  assert.equal(b!.likes, undefined);
  assert.equal(b!.creator, "Big Finance");
  assert.deepEqual(parseYoutubeVideos(null), []);
});

test("reddit listing parser skips stickied + nsfw", () => {
  const items = parseRedditListing(fixture("reddit-rising.json"), { sourceId: "reddit-rising" });
  assert.equal(items.length, 1);
  const [r] = items;
  assert.equal(r!.platform, "REDDIT");
  assert.equal(r!.kind, "signal");
  assert.equal(r!.url, "https://www.reddit.com/r/personalfinance/comments/aaa/index_funds_vs_etfs/");
  assert.equal(r!.views, 420);
  assert.equal(r!.comments, 133);
  assert.equal(r!.thumbnailUrl, undefined);
  assert.equal(r!.publishedAt!.getTime(), 1793102400 * 1000);
});

test("redditTrends uses public JSON with UA, or OAuth when configured", async () => {
  const pub = fakeFetch([[/reddit\.com\/r\//, fixture("reddit-rising.json")]]);
  const items = await redditTrends({ slug: "pf", keywords: [], subreddits: ["personalfinance"] }, { env: {}, fetch: pub.fetch });
  assert.equal(items.length, 2, "rising + top");
  assert.ok(pub.calls.some((c) => c.endsWith("/r/personalfinance/rising.json?limit=25")));
  assert.ok(pub.calls.some((c) => c.includes("/top.json?t=week")));
  const oauth = fakeFetch([[/access_token/, { access_token: "tok", expires_in: 3600 }], [/oauth\.reddit\.com/, fixture("reddit-rising.json")]]);
  await redditTrends({ slug: "pf", keywords: [], subreddits: ["personalfinance"] }, { env: { REDDIT_CLIENT_ID: "id", REDDIT_CLIENT_SECRET: "s" }, fetch: oauth.fetch });
  assert.ok(oauth.calls.some((c) => c.startsWith("https://oauth.reddit.com/r/personalfinance/rising?limit=25")));
});

test("DataForSEO google trends parser: rising only, deduped case-insensitively", () => {
  const now = new Date("2026-10-28T00:00:00Z");
  const items = parseGoogleTrendsExplore(fixture("dataforseo-explore.json"), { now });
  assert.deepEqual(items.map((i) => [i.title, i.views]), [["index funds vs etfs", 350], ["high yield savings 2026", 5000]]);
  assert.equal(items[0]!.platform, "GOOGLE_TRENDS");
  assert.equal(items[0]!.query, "money, saving");
  assert.ok(items[0]!.url.includes("q=index%20funds%20vs%20etfs"));
  assert.equal(parseGoogleTrendsExplore(fixture("dataforseo-explore.json"), { includeTop: true }).length, 3);
});

test("googleTrendsRising posts basic-auth tasks of ≤5 keywords", async () => {
  let body: unknown; let auth: string | undefined;
  const { fetch } = fakeFetch([[/dataforseo/, (_u: string, init?: RequestInit) => { body = JSON.parse(String(init?.body)); auth = (init?.headers as Record<string, string>).authorization; return fixture("dataforseo-explore.json"); }]]);
  const items = await googleTrendsRising({ slug: "x", keywords: ["a", "b", "c", "d", "e", "f"], subreddits: [] }, { env: { DATAFORSEO_LOGIN: "u", DATAFORSEO_PASSWORD: "p" }, fetch }, { maxTasks: 1 });
  assert.equal(items.length, 2);
  assert.deepEqual((body as Array<{ keywords: string[] }>)[0]!.keywords, ["a", "b", "c", "d", "e"]);
  assert.equal(auth, `Basic ${Buffer.from("u:p").toString("base64")}`);
  assert.deepEqual(await googleTrendsRising({ slug: "x", keywords: ["a"], subreddits: [] }, { env: {} }), []);
});

test("Exa parser → evidence items", async () => {
  const items = parseExaResults(fixture("exa-search.json"), "q");
  assert.equal(items.length, 1);
  assert.equal(items[0]!.kind, "evidence");
  assert.equal(items[0]!.creator, "reuters.com");
  assert.equal(exaConfigured({}), false);
  let sent: Record<string, unknown> = {};
  const { fetch } = fakeFetch([[/api\.exa\.ai/, (_u: string, init?: RequestInit) => { sent = JSON.parse(String(init?.body)); return fixture("exa-search.json"); }]]);
  await exaNews({ slug: "investing", name: "Investing & markets", keywords: ["stocks"], subreddits: [] }, { env: { EXA_API_KEY: "k" }, fetch, now: new Date("2026-10-28T00:00:00Z") });
  assert.equal(sent.category, "news");
  assert.equal(sent.startPublishedDate, "2026-10-21T00:00:00.000Z");
  assert.match(String(sent.query), /this week in Investing/);
});

test("Apify TikTok parser + double env gate", () => {
  const items = parseApifyTiktok(fixture("apify-tiktok.json"));
  assert.equal(items.length, 1);
  const [t] = items;
  assert.equal(t!.platform, "TIKTOK");
  assert.equal(t!.title, "Index funds vs ETFs explained 📈");
  assert.equal(t!.views, 1_200_000);
  assert.equal(t!.creatorMedianViews, 100_000);
  assert.equal(t!.lengthSec, 41);
  assert.equal(apifyTiktokConfigured({ APIFY_TOKEN: "x" }), false);
  assert.equal(apifyTiktokConfigured({ APIFY_TOKEN: "x", RADAR_ENABLE_SCRAPERS: "1" }), true);
});

test("SOURCES registry: configured + due", () => {
  assert.equal(SOURCES.length, 6);
  assert.deepEqual(configuredSources({}).map((s) => s.id), ["reddit"]);
  const all = { YOUTUBE_API_KEY: "a", DATAFORSEO_LOGIN: "b", DATAFORSEO_PASSWORD: "c", EXA_API_KEY: "d", APIFY_TOKEN: "e", RADAR_ENABLE_SCRAPERS: "1" };
  assert.equal(configuredSources(all).length, 6);
  const now = new Date("2026-10-28T12:00:00Z");
  const h = (n: number) => new Date(now.getTime() - n * 3600_000);
  const due = dueSources(all, { "youtube-most-popular": h(2), "youtube-breakout": h(24), reddit: h(23.5), "google-trends": h(100), "exa-news": h(170), "apify-tiktok": h(90) }, now).map((s) => s.id);
  assert.deepEqual(due, ["youtube-breakout", "reddit", "apify-tiktok", "exa-news"]);
});
