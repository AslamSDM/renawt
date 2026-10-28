import { defaultCache, SIX_HOURS_MS } from "../cache";
import { requestJson } from "../http";
import { defaultYoutubeQuota, type QuotaBudgeter } from "../quota";
import type { NicheInput, RawTrendItem, RadarEnv, SourceContext } from "../types";

const API = "https://www.googleapis.com/youtube/v3";
export const DEFAULT_REGIONS = ["US", "GB", "IN", "CA", "AU"];

export function youtubeConfigured(env: RadarEnv): boolean { return Boolean(env.YOUTUBE_API_KEY); }

/** ISO-8601 duration ("PT1M5S") → seconds. */
export function parseIsoDuration(d?: string): number | undefined {
  if (!d) return undefined;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(d);
  if (!m) return undefined;
  return Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0);
}

interface YtVideo {
  id: string;
  snippet?: { title?: string; description?: string; channelId?: string; channelTitle?: string; publishedAt?: string; thumbnails?: Record<string, { url: string }> };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration?: string };
}
interface YtChannel { id: string; statistics?: { viewCount?: string; videoCount?: string; subscriberCount?: string } }

/** Parse a `videos.list` response into raw items. `channelMedians` maps channelId → median-views proxy. */
export function parseYoutubeVideos(json: unknown, opts: { sourceId?: string; region?: string; query?: string; channelMedians?: Map<string, number> } = {}): RawTrendItem[] {
  const items = ((json as { items?: YtVideo[] })?.items ?? []) as YtVideo[];
  const out: RawTrendItem[] = [];
  for (const v of items) {
    if (!v?.id || !v.snippet?.title) continue;
    const th = v.snippet.thumbnails ?? {};
    out.push({
      platform: "YOUTUBE",
      kind: "content",
      url: `https://www.youtube.com/watch?v=${v.id}`,
      externalId: v.id,
      title: v.snippet.title,
      caption: v.snippet.description?.slice(0, 500),
      creator: v.snippet.channelTitle,
      creatorMedianViews: v.snippet.channelId ? opts.channelMedians?.get(v.snippet.channelId) : undefined,
      views: Number(v.statistics?.viewCount ?? 0),
      likes: v.statistics?.likeCount ? Number(v.statistics.likeCount) : undefined,
      comments: v.statistics?.commentCount ? Number(v.statistics.commentCount) : undefined,
      publishedAt: v.snippet.publishedAt ? new Date(v.snippet.publishedAt) : undefined,
      lengthSec: parseIsoDuration(v.contentDetails?.duration),
      thumbnailUrl: (th.high ?? th.medium ?? th.default)?.url,
      sourceId: opts.sourceId,
      region: opts.region,
      query: opts.query,
    });
  }
  return out;
}

/**
 * Channel "median views" proxy: total channel views / video count. The API exposes no
 * per-channel median, and fetching the uploads playlist per creator would burn quota.
 * The mean over-estimates the median for hit-driven channels, so outlier scores from
 * this proxy are conservative.
 */
export function parseChannelMedians(json: unknown): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of ((json as { items?: YtChannel[] })?.items ?? []) as YtChannel[]) {
    const views = Number(c.statistics?.viewCount ?? 0);
    const count = Number(c.statistics?.videoCount ?? 0);
    if (c.id && count > 0 && views > 0) out.set(c.id, Math.max(1, Math.round(views / count)));
  }
  return out;
}

/** Parse `search.list` → video ids. */
export function parseSearchIds(json: unknown): string[] {
  const items = ((json as { items?: Array<{ id?: { videoId?: string } }> })?.items ?? []);
  return items.map((i) => i.id?.videoId).filter((x): x is string => Boolean(x));
}

function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") p.set(k, String(v));
  return p.toString();
}

interface YtOpts { regions?: string[]; maxResults?: number; maxQueries?: number; ttlMs?: number }

function deps(ctx: SourceContext = {}) {
  const env = ctx.env ?? process.env;
  const key = env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY not set");
  return { key, f: ctx.fetch, quota: (ctx.youtubeQuota ?? defaultYoutubeQuota) as QuotaBudgeter, cache: ctx.cache ?? defaultCache, now: ctx.now ?? new Date() };
}

/** `videos.list chart=mostPopular` per region for the niche's category (1 unit per region). */
export async function youtubeMostPopular(niche: NicheInput, ctx: SourceContext = {}, opts: YtOpts = {}): Promise<RawTrendItem[]> {
  if (!niche.youtubeCategoryId) return []; // generic mostPopular is not niche signal
  const { key, f, quota, cache } = deps(ctx);
  const regions = opts.regions ?? DEFAULT_REGIONS;
  return cache.wrap(`yt:popular:${niche.youtubeCategoryId}:${regions.join(",")}`, opts.ttlMs ?? SIX_HOURS_MS, async () => {
    const out: RawTrendItem[] = [];
    for (const region of regions) {
      if (!(await quota.tryConsume("default", 1))) break;
      try {
        const json = await requestJson(`${API}/videos?${qs({ part: "snippet,statistics,contentDetails", chart: "mostPopular", regionCode: region, videoCategoryId: niche.youtubeCategoryId, maxResults: opts.maxResults ?? 50, key })}`, { fetch: f });
        out.push(...parseYoutubeVideos(json, { sourceId: "youtube-most-popular", region }));
      } catch {
        // some categories are unavailable in some regions (400 "chart not supported") — skip region
      }
    }
    return out;
  });
}

/**
 * Breakout Shorts detector: `search.list` (own 100/day bucket) for niche keywords in the
 * last 7 days ordered by views, then `videos.list` for stats and `channels.list` for
 * the creator median proxy (1 unit each from the shared pool).
 */
export async function youtubeBreakout(niche: NicheInput, ctx: SourceContext = {}, opts: YtOpts = {}): Promise<RawTrendItem[]> {
  const { key, f, quota, cache, now } = deps(ctx);
  return cache.wrap(`yt:breakout:${niche.slug}`, opts.ttlMs ?? SIX_HOURS_MS, async () => {
    const publishedAfter = new Date(now.getTime() - 7 * 86400000).toISOString();
    const queries = niche.keywords.slice(0, opts.maxQueries ?? 2);
    const idsByQuery = new Map<string, string>();
    for (const q of queries) {
      if (!(await quota.tryConsume("search", 1))) break;
      const json = await requestJson(`${API}/search?${qs({ part: "snippet", type: "video", q, publishedAfter, order: "viewCount", videoDuration: "short", maxResults: opts.maxResults ?? 25, relevanceLanguage: "en", key })}`, { fetch: f });
      for (const id of parseSearchIds(json)) if (!idsByQuery.has(id)) idsByQuery.set(id, q);
    }
    const ids = [...idsByQuery.keys()].slice(0, 50);
    if (ids.length === 0) return [];
    if (!(await quota.tryConsume("default", 1))) return [];
    const videosJson = await requestJson(`${API}/videos?${qs({ part: "snippet,statistics,contentDetails", id: ids.join(","), key })}`, { fetch: f });
    const channelIds = [...new Set(((videosJson as { items?: YtVideo[] }).items ?? []).map((v) => v.snippet?.channelId).filter((x): x is string => Boolean(x)))].slice(0, 50);
    let medians = new Map<string, number>();
    if (channelIds.length && (await quota.tryConsume("default", 1))) {
      const chJson = await requestJson(`${API}/channels?${qs({ part: "statistics", id: channelIds.join(","), key })}`, { fetch: f });
      medians = parseChannelMedians(chJson);
    }
    return parseYoutubeVideos(videosJson, { sourceId: "youtube-breakout", channelMedians: medians }).map((it) => ({ ...it, query: idsByQuery.get(it.externalId ?? "") }));
  });
}
