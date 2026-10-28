import type { RadarEnv, TrendSource } from "../types";
import { apifyTiktokConfigured, apifyTiktokHashtags } from "./apifyTiktok";
import { exaConfigured, exaNews } from "./exa";
import { googleTrendsConfigured, googleTrendsRising } from "./googleTrends";
import { redditConfigured, redditTrends } from "./reddit";
import { youtubeBreakout, youtubeConfigured, youtubeMostPopular } from "./youtube";

export * from "./youtube";
export * from "./reddit";
export * from "./googleTrends";
export * from "./exa";
export * from "./apifyTiktok";

export const SOURCES: TrendSource[] = [
  { id: "youtube-most-popular", cadence: "daily", isConfigured: youtubeConfigured, fetch: (n, ctx) => youtubeMostPopular(n, ctx) },
  { id: "youtube-breakout", cadence: "daily", isConfigured: youtubeConfigured, fetch: (n, ctx) => youtubeBreakout(n, ctx) },
  { id: "reddit", cadence: "daily", isConfigured: redditConfigured, fetch: (n, ctx) => redditTrends(n, ctx) },
  { id: "apify-tiktok", cadence: "twice-weekly", isConfigured: apifyTiktokConfigured, fetch: (n, ctx) => apifyTiktokHashtags(n, ctx) },
  { id: "google-trends", cadence: "weekly", isConfigured: googleTrendsConfigured, fetch: (n, ctx) => googleTrendsRising(n, ctx) },
  { id: "exa-news", cadence: "weekly", isConfigured: exaConfigured, fetch: (n, ctx) => exaNews(n, ctx) },
];

export const CADENCE_HOURS: Record<TrendSource["cadence"], number> = { daily: 24, "twice-weekly": 84, weekly: 168 };

export function configuredSources(env: RadarEnv, sources: TrendSource[] = SOURCES): TrendSource[] {
  return sources.filter((s) => (s.isConfigured ? s.isConfigured(env) : true));
}

/** Sources due to run given their last run times (missing = due). 1h slack so cron jitter doesn't skip a cycle. */
export function dueSources(env: RadarEnv, lastRunAt: Record<string, Date | undefined>, now: Date = new Date(), sources: TrendSource[] = SOURCES): TrendSource[] {
  return configuredSources(env, sources).filter((s) => {
    const last = lastRunAt[s.id];
    return !last || now.getTime() - last.getTime() >= (CADENCE_HOURS[s.cadence] - 1) * 3600_000;
  });
}
