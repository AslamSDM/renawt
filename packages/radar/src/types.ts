import type { Platform } from "@remawt/db";

/**
 * Platforms the radar ingests from. `Platform` (DB enum) covers social video platforms;
 * REDDIT / GOOGLE_TRENDS / NEWS are radar-only signal sources. Items on radar-only
 * platforms are used for scoring/corroboration/evidence but are not persisted as
 * TrendItem rows until the DB enum grows (see docs/REQUESTS.md).
 */
export type RadarPlatform = Platform | "REDDIT" | "GOOGLE_TRENDS" | "NEWS";

/**
 * content  = a post/video with real view counts (scored, clustered, exemplars)
 * signal   = a search/discussion signal (rising query, reddit thread) — corroborates topics
 * evidence = a news/article result — attached to trend cards as "why now" citations
 */
export type TrendItemKind = "content" | "signal" | "evidence";

export interface RawTrendItem {
  platform: RadarPlatform;
  url: string;
  externalId?: string;
  title: string;
  caption?: string;
  creator?: string;
  creatorMedianViews?: number;
  views: number;
  likes?: number;
  comments?: number;
  shares?: number;
  publishedAt?: Date;
  lengthSec?: number;
  thumbnailUrl?: string;
  /** Additive fields (radar v2). */
  kind?: TrendItemKind;
  sourceId?: string;
  region?: string;
  query?: string;
}

export interface ScoredTrendItem extends RawTrendItem {
  ageHours: number;
  velocity: number;
  outlier: number;
  zscore?: number;
  /** Additive fields. */
  id?: string;
  corroboration?: number;      // number of distinct platforms carrying the same topic (>=1)
  breakout?: boolean;          // outlier >= 5
  score?: number;              // composite rank score
}

export interface TrendTags { topic: string; format: string; hookType: string; lengthSec?: number; visualStyle?: string }

export interface NicheInput {
  slug: string;
  keywords: string[];
  subreddits: string[];
  youtubeCategoryId?: string;
  name?: string;
  group?: string;
  riskNotes?: string;
}

export type RadarEnv = Record<string, string | undefined>;

/** Persistent counter used by quota budgeters (e.g. Redis INCR or a DB row). */
export interface QuotaCounter {
  get(key: string): Promise<number>;
  incr(key: string, by: number): Promise<number>;
}

export interface SourceContext {
  env?: RadarEnv;
  fetch?: typeof fetch;
  now?: Date;
  /** Shared quota budgeter for YouTube (defaults to a module-level in-memory one). */
  youtubeQuota?: import("./quota").QuotaBudgeter;
  cache?: import("./cache").TtlCache;
}

export interface TrendSource {
  id: string;
  cadence: "daily" | "twice-weekly" | "weekly";
  /** Additive: whether required env is present. Sources without it are always configured. */
  isConfigured?(env: RadarEnv): boolean;
  fetch(niche: NicheInput, ctx?: SourceContext): Promise<RawTrendItem[]>;
}

export interface IdeaDraft { hook: string; title: string; format: string; angle: string; beats: Array<{ label: string; durationSec: number; note: string }>; evidence: Array<{ url: string; title: string }>; risk: { level: "low" | "medium" | "high"; flags: string[] }; score: number; cardId?: string }

export interface TaggedTrendItem extends ScoredTrendItem { id: string; tags: TrendTags }

export interface TrendCardExemplar { url: string; title: string; views: number; platform: RadarPlatform }
export interface TrendCardEvidence { url: string; title: string; source: string }

export interface TrendCardDraft {
  niche?: string;
  weekKey?: string;
  topic: string;
  format: string;              // taxonomy id (see taxonomy.ts)
  hookType?: string;
  score: number;
  summary: string;
  exemplars: TrendCardExemplar[];
  evidence: TrendCardEvidence[];
  keywords: string[];
  itemCount: number;
  breakoutCount: number;
  platforms: RadarPlatform[];
  /** Nearest producible @remawt/shared FORMATS id, if any. */
  producibleFormat?: string;
}
