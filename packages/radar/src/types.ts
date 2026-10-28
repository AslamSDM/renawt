import type { Platform } from "@remawt/db";

export interface RawTrendItem { platform: Platform; url: string; externalId?: string; title: string; caption?: string; creator?: string; creatorMedianViews?: number; views: number; likes?: number; comments?: number; shares?: number; publishedAt?: Date; lengthSec?: number; thumbnailUrl?: string }
export interface ScoredTrendItem extends RawTrendItem { ageHours: number; velocity: number; outlier: number; zscore?: number }
export interface TrendTags { topic: string; format: string; hookType: string; lengthSec?: number; visualStyle?: string }
export interface TrendSource { id: string; cadence: "daily" | "twice-weekly" | "weekly"; fetch(niche: { slug: string; keywords: string[]; subreddits: string[]; youtubeCategoryId?: string }): Promise<RawTrendItem[]> }
export interface IdeaDraft { hook: string; title: string; format: string; angle: string; beats: Array<{ label: string; durationSec: number; note: string }>; evidence: Array<{ url: string; title: string }>; risk: { level: "low" | "medium" | "high"; flags: string[] }; score: number; cardId?: string }
