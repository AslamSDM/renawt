import { requestJson } from "../http";
import type { NicheInput, RawTrendItem, RadarEnv, SourceContext } from "../types";

/**
 * OPTIONAL TikTok hashtag scrape via an Apify actor.
 *
 * !! ToS RISK !! TikTok's Terms of Service prohibit automated collection. There is no
 * commercial TikTok trends API (the Research API is academic/non-profit only). US case
 * law (hiQ v. LinkedIn; Meta v. Bright Data, 2024) leans toward permitting logged-out
 * public-data scraping, but contract/ToS risk remains. This source is therefore OFF
 * unless BOTH `APIFY_TOKEN` and `RADAR_ENABLE_SCRAPERS=1` are set. We only read public
 * aggregate metrics; never store/redistribute the videos themselves, and never surface
 * scraped creators' content verbatim to users.
 *
 * Default actor: `clockworks~tiktok-scraper` (override with APIFY_TIKTOK_ACTOR).
 */
export function apifyTiktokConfigured(env: RadarEnv): boolean { return Boolean(env.APIFY_TOKEN) && env.RADAR_ENABLE_SCRAPERS === "1"; }

interface ApifyTiktokItem {
  id?: string; text?: string; webVideoUrl?: string; createTimeISO?: string; createTime?: number;
  playCount?: number; diggCount?: number; commentCount?: number; shareCount?: number;
  authorMeta?: { name?: string; fans?: number; video?: number; heart?: number };
  videoMeta?: { duration?: number; coverUrl?: string };
  hashtags?: Array<{ name?: string }>;
}

export function hashtagFromKeyword(k: string): string { return k.toLowerCase().replace(/[^a-z0-9]/g, ""); }

export function parseApifyTiktok(json: unknown, opts: { query?: string } = {}): RawTrendItem[] {
  const items = (Array.isArray(json) ? json : []) as ApifyTiktokItem[];
  const out: RawTrendItem[] = [];
  for (const v of items) {
    if (!v.webVideoUrl || !v.text) continue;
    // Creator "median" proxy: total hearts / videos is likes, not views; use ~10× likes heuristic only if no better signal.
    const a = v.authorMeta;
    const medianProxy = a?.heart && a?.video ? Math.round((a.heart / a.video) * 10) : undefined;
    const firstLine = v.text.split(/\n/)[0]!.replace(/#\S+/g, "").trim();
    out.push({
      platform: "TIKTOK",
      kind: "content",
      url: v.webVideoUrl,
      externalId: v.id,
      title: (firstLine || v.text).slice(0, 150),
      caption: v.text.slice(0, 500),
      creator: a?.name,
      creatorMedianViews: medianProxy,
      views: Number(v.playCount ?? 0),
      likes: v.diggCount,
      comments: v.commentCount,
      shares: v.shareCount,
      publishedAt: v.createTimeISO ? new Date(v.createTimeISO) : v.createTime ? new Date(v.createTime * 1000) : undefined,
      lengthSec: v.videoMeta?.duration,
      thumbnailUrl: v.videoMeta?.coverUrl,
      sourceId: "apify-tiktok",
      query: opts.query,
    });
  }
  return out;
}

export async function apifyTiktokHashtags(niche: NicheInput, ctx: SourceContext = {}, opts: { resultsPerHashtag?: number; maxHashtags?: number } = {}): Promise<RawTrendItem[]> {
  const env = ctx.env ?? process.env;
  if (!apifyTiktokConfigured(env)) return [];
  const actor = env.APIFY_TIKTOK_ACTOR ?? "clockworks~tiktok-scraper";
  const hashtags = [...new Set(niche.keywords.map(hashtagFromKeyword).filter(Boolean))].slice(0, opts.maxHashtags ?? 3);
  const json = await requestJson(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(env.APIFY_TOKEN!)}`, {
    fetch: ctx.fetch,
    body: { hashtags, resultsPerPage: opts.resultsPerHashtag ?? 30, shouldDownloadVideos: false, shouldDownloadCovers: false },
    timeoutMs: 240_000,
  });
  return parseApifyTiktok(json, { query: hashtags.map((h) => `#${h}`).join(" ") });
}
