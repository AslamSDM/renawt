import type { AccountCaps, Platform } from "./types";

export interface CapDefinition {
  /** Posts allowed per window. */
  dailyLimit: number;
  /** "account" = per connected creator account; "project" = shared by our whole API project (YouTube direct). */
  scope: "account" | "project";
  window: "rolling24h" | "calendarDay";
  note: string;
}

/** Defaults from docs/research/2026-10-28-distribution-trends.md §1/§5. Read live limits at runtime where the API exposes them. */
export const DEFAULT_CAPS: Record<Platform, CapDefinition> = {
  TIKTOK: { dailyLimit: 15, scope: "account", window: "rolling24h", note: "~15 Direct Posts/day/creator, shared across ALL API clients" },
  FACEBOOK: { dailyLimit: 30, scope: "account", window: "rolling24h", note: "30 Reels per rolling 24h per Page" },
  INSTAGRAM: { dailyLimit: 100, scope: "account", window: "rolling24h", note: "100 API posts/24h (docs also say 50) — read content_publishing_limit" },
  THREADS: { dailyLimit: 250, scope: "account", window: "rolling24h", note: "250 posts/24h — read threads_publishing_limit" },
  YOUTUBE: { dailyLimit: 100, scope: "project", window: "calendarDay", note: "videos.insert bucket: 100/day per GCP project (direct only)" },
  PINTEREST: { dailyLimit: 10, scope: "account", window: "rolling24h", note: "conservative; trial apps are heavily limited" },
  LINKEDIN: { dailyLimit: 5, scope: "account", window: "rolling24h", note: "conservative; per-app throttles undocumented" },
  X: { dailyLimit: 10, scope: "account", window: "rolling24h", note: "conservative; pay-per-use API" },
};

export function defaultCaps(platform: Platform, overrides?: Partial<Record<Platform, number>>): AccountCaps {
  return { dailyLimit: overrides?.[platform] ?? DEFAULT_CAPS[platform].dailyLimit };
}

export interface CapCheck { allowed: boolean; limit: number; remaining: number }

/** Can one more post go out given how many were published in the last 24h? */
export function checkCap(platform: Platform, publishedLast24h: number, limit: number = DEFAULT_CAPS[platform].dailyLimit): CapCheck {
  const remaining = Math.max(0, limit - publishedLast24h);
  return { allowed: remaining > 0, limit, remaining };
}
