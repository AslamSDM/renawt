import type { RadarPlatform, RawTrendItem, ScoredTrendItem } from "./types";
import { clamp, jaccard, keywordSet, mean, median, normalizeUrl, overlap, std } from "./text";

/**
 * Scoring per the radar spec:
 *   ageHours  = hours since publish (min 1; 72 when unknown)
 *   velocity  = views / ageHours
 *   outlier   = views / creatorMedianViews (fallback: niche median views for that platform)
 *   zscore    = (log10(1+velocity) − μ) / σ over the niche baseline for the same platform
 *   corroboration = distinct platforms carrying the same topic (overlap coef ≥ 0.6, ≥2 shared tokens)
 *   score     = log10(1+velocity) × min(outlier, 50)^0.5 × (1 + 0.25·(corroboration−1)) × (1 + 0.1·max(z,0))
 * Scales differ per platform (reddit score vs YT views), so baselines are per platform.
 */

export const BREAKOUT_OUTLIER = 5;
export const DEFAULT_AGE_HOURS = 72;

export interface PlatformBaseline { n: number; medianViews: number; meanLogVelocity: number; stdLogVelocity: number }
export interface NicheBaseline { byPlatform: Partial<Record<RadarPlatform, PlatformBaseline>> }

export function ageHoursOf(item: Pick<RawTrendItem, "publishedAt">, now: Date): number {
  if (!item.publishedAt || Number.isNaN(item.publishedAt.getTime())) return DEFAULT_AGE_HOURS;
  return Math.max(1, (now.getTime() - item.publishedAt.getTime()) / 3_600_000);
}

const logv = (v: number) => Math.log10(1 + Math.max(0, v));

/** Build a niche baseline from content/signal items (evidence items have no counts). */
export function computeBaseline(items: RawTrendItem[], now: Date = new Date()): NicheBaseline {
  const groups = new Map<RadarPlatform, RawTrendItem[]>();
  for (const it of items) {
    if (it.kind === "evidence") continue;
    const arr = groups.get(it.platform) ?? [];
    arr.push(it);
    groups.set(it.platform, arr);
  }
  const byPlatform: NicheBaseline["byPlatform"] = {};
  for (const [p, arr] of groups) {
    const lv = arr.map((i) => logv(i.views / ageHoursOf(i, now)));
    byPlatform[p] = { n: arr.length, medianViews: median(arr.map((i) => i.views)), meanLogVelocity: mean(lv), stdLogVelocity: std(lv) };
  }
  return { byPlatform };
}

/** Merge a stored long-run baseline with the current batch (stored wins when it has more samples). */
export function mergeBaselines(stored: NicheBaseline | undefined, current: NicheBaseline): NicheBaseline {
  if (!stored) return current;
  const out: NicheBaseline = { byPlatform: { ...current.byPlatform } };
  for (const [p, b] of Object.entries(stored.byPlatform) as Array<[RadarPlatform, PlatformBaseline]>) {
    const cur = current.byPlatform[p];
    if (!cur || b.n >= cur.n) out.byPlatform[p] = b;
  }
  return out;
}

function similarTitle(a: Set<string>, b: Set<string>): boolean { return a.size > 0 && b.size > 0 && jaccard(a, b) >= 0.8; }

/** Dedupe by normalised URL, then by near-identical titles on the same platform (keeps the higher-view item). */
export function dedupeItems<T extends RawTrendItem>(items: T[]): T[] {
  const byUrl = new Map<string, T>();
  for (const it of items) {
    const k = normalizeUrl(it.url);
    const prev = byUrl.get(k);
    if (!prev || it.views > prev.views) byUrl.set(k, prev ? { ...prev, ...it, views: Math.max(prev.views, it.views) } : it);
  }
  const sorted = [...byUrl.values()].sort((a, b) => b.views - a.views);
  const kept: Array<{ item: T; kw: Set<string> }> = [];
  for (const it of sorted) {
    const kw = keywordSet(it.title);
    if (kept.some((k) => k.item.platform === it.platform && similarTitle(k.kw, kw))) continue;
    kept.push({ item: it, kw });
  }
  return kept.map((k) => k.item);
}

export function sameTopic(a: Set<string>, b: Set<string>): boolean {
  const { coef, inter } = overlap(a, b);
  return inter >= 2 && coef >= 0.6;
}

/** For each item, count distinct platforms (incl. its own) that carry the same topic. */
export function corroborationCounts(items: RawTrendItem[]): number[] {
  const kws = items.map((i) => keywordSet(i.title));
  return items.map((it, i) => {
    const plats = new Set<RadarPlatform>([it.platform]);
    for (let j = 0; j < items.length; j++) {
      if (j === i || plats.has(items[j]!.platform)) continue;
      if (sameTopic(kws[i]!, kws[j]!)) plats.add(items[j]!.platform);
    }
    return plats.size;
  });
}

export interface ScoreOptions { now?: Date; dedupe?: boolean }

export function scoreItems(items: RawTrendItem[], nicheBaseline?: NicheBaseline, opts: ScoreOptions = {}): ScoredTrendItem[] {
  const now = opts.now ?? new Date();
  const base = opts.dedupe === false ? items : dedupeItems(items);
  const baseline = mergeBaselines(nicheBaseline, computeBaseline(base, now));
  const corr = corroborationCounts(base);
  const scored = base.map((it, i): ScoredTrendItem => {
    const ageHours = ageHoursOf(it, now);
    const velocity = it.views / ageHours;
    const pb = baseline.byPlatform[it.platform];
    const denom = it.creatorMedianViews && it.creatorMedianViews > 0 ? it.creatorMedianViews : pb && pb.medianViews > 0 ? pb.medianViews : 0;
    const outlier = it.kind === "evidence" ? 0 : denom > 0 ? it.views / denom : 1;
    const zscore = pb && pb.stdLogVelocity > 0 ? (logv(velocity) - pb.meanLogVelocity) / pb.stdLogVelocity : 0;
    const corroboration = corr[i]!;
    const score = it.kind === "evidence"
      ? 0.1 * corroboration
      : logv(velocity) * Math.sqrt(clamp(outlier, 0, 50)) * (1 + 0.25 * (corroboration - 1)) * (1 + 0.1 * Math.max(zscore, 0));
    return { ...it, ageHours, velocity, outlier, zscore, corroboration, breakout: outlier >= BREAKOUT_OUTLIER, score };
  });
  return scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
