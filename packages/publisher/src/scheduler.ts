import { DEFAULT_CAPS } from "./caps";
import type { Platform } from "./types";
import { fnv1a, mulberry32 } from "./util";

/** Weekday: 0=Sun … 6=Sat, or a 3-letter name ("mon"). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6 | "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

export interface Cadence {
  /** Max posts per week (Mon–Sun in the channel's timezone). */
  perWeek: number;
  /** Allowed weekdays. Empty → spread `perWeek` evenly across the week. */
  days: Weekday[];
  /** Local hour 0–23. Fractions allowed (18.5 = 18:30). */
  hourLocal: number;
  /** Optional explicit minute (overrides the fraction of hourLocal). */
  minuteLocal?: number;
}

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function toDayNum(d: Weekday): number {
  return typeof d === "number" ? d : DAY_NAMES.indexOf(d.toLowerCase() as (typeof DAY_NAMES)[number]);
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(tz: string): Intl.DateTimeFormat {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
    });
    dtfCache.set(tz, f);
  }
  return f;
}

export interface LocalParts { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number }

/** Wall-clock parts of an instant in a timezone. */
export function localParts(date: Date, tz: string): LocalParts {
  const parts = Object.fromEntries(dtf(tz).formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour) % 24, minute: Number(parts.minute), second: Number(parts.second),
    weekday: DAY_NAMES.indexOf(String(parts.weekday).toLowerCase().slice(0, 3) as (typeof DAY_NAMES)[number]),
  };
}

/** Offset (ms) of tz from UTC at an instant: local = utc + offset. */
export function tzOffsetMs(date: Date, tz: string): number {
  const p = localParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Instant for a local wall time in tz.
 * - DST gap (time doesn't exist, e.g. 02:30 on spring-forward): shifted forward by the gap (→ 03:30).
 * - DST overlap (time exists twice): the earlier instant.
 */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  // Candidate offsets around the target; pick the earliest instant whose local time matches.
  const offA = tzOffsetMs(new Date(wall - 36e5 * 14), tz);
  const offB = tzOffsetMs(new Date(wall + 36e5 * 14), tz);
  const candidates = [...new Set([offA, offB, tzOffsetMs(new Date(wall), tz)])].map((o) => wall - o).sort((a, b) => a - b);
  for (const c of candidates) {
    const p = localParts(new Date(c), tz);
    if (p.year === year && p.month === month && p.day === day && p.hour === hour && p.minute === minute) return new Date(c);
  }
  // Gap: interpret with the pre-transition offset, which lands after the jump.
  return new Date(wall - Math.min(offA, offB));
}

function addLocalDays(y: number, m: number, d: number, n: number): { y: number; m: number; d: number; wd: number } {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), wd: t.getUTCDay() };
}

/** Evenly spread n posts across Mon..Sun (returns weekday numbers). */
export function defaultDays(perWeek: number): number[] {
  const n = Math.max(1, Math.min(7, Math.round(perWeek)));
  const mondayFirst = [1, 2, 3, 4, 5, 6, 0];
  const picked = new Set<number>();
  for (let i = 0; i < n; i++) picked.add(mondayFirst[Math.floor((i * 7) / n)]);
  return [...picked];
}

/**
 * Next `count` publish slots strictly after `from`, at `hourLocal` in `tz` on the cadence days,
 * honouring `perWeek` (Mon-start weeks in local time). Pure; uses Intl only.
 */
export function nextSlots(cadence: Cadence, tz: string, from: Date, count: number): Date[] {
  if (count <= 0 || cadence.perWeek <= 0) return [];
  const hour = Math.floor(cadence.hourLocal);
  const minute = cadence.minuteLocal ?? Math.round((cadence.hourLocal - hour) * 60);
  const allowed = new Set((cadence.days.length ? cadence.days.map(toDayNum) : defaultDays(cadence.perWeek)).filter((d) => d >= 0 && d <= 6));
  if (allowed.size === 0) return [];
  const perWeek = Math.floor(cadence.perWeek);

  const start = localParts(from, tz);
  const out: Date[] = [];
  const perWeekCount = new Map<string, number>();
  for (let i = 0; out.length < count && i < 7 * 520; i++) {
    const day = addLocalDays(start.year, start.month, start.day, i);
    if (!allowed.has(day.wd)) continue;
    const monday = addLocalDays(day.y, day.m, day.d, -((day.wd + 6) % 7));
    const weekKey = `${monday.y}-${monday.m}-${monday.d}`;
    const used = perWeekCount.get(weekKey) ?? 0;
    if (used >= perWeek) continue;
    const at = zonedTimeToUtc(day.y, day.m, day.d, hour, minute, tz);
    if (at.getTime() <= from.getTime()) continue;
    perWeekCount.set(weekKey, used + 1);
    out.push(at);
  }
  return out;
}

export interface SpreadOptions {
  minGapMin?: number;
  maxGapMin?: number;
  /** Seed for deterministic gaps (default: base time + platforms). */
  seed?: string;
}

/** Stagger one slot across platforms by 5–15 min (deterministic) so posts never share an identical timestamp. */
export function spreadAcrossPlatforms(base: Date, platforms: Platform[], opts: SpreadOptions = {}): Array<{ platform: Platform; at: Date }> {
  const min = opts.minGapMin ?? 5;
  const max = Math.max(min, opts.maxGapMin ?? 15);
  const rng = mulberry32(fnv1a(opts.seed ?? `${base.toISOString()}|${platforms.join(",")}`));
  let t = base.getTime();
  return platforms.map((platform, i) => {
    if (i > 0) t += Math.round((min + rng() * (max - min)) * 60_000);
    return { platform, at: new Date(t) };
  });
}

const DAY_MS = 24 * 3600 * 1000;

/**
 * Would adding `candidate` keep every rolling 24h window ≤ limit?
 * `existing` = publish times (past + already scheduled) for the same account (or project for YouTube direct).
 */
export function isWithinCap(platform: Platform, existing: Date[], candidate: Date, limit: number = DEFAULT_CAPS[platform].dailyLimit): boolean {
  const c = candidate.getTime();
  const times = existing.map((d) => d.getTime());
  const countIn = (end: number) => times.filter((t) => t > end - DAY_MS && t <= end).length + (c > end - DAY_MS && c <= end ? 1 : 0);
  if (countIn(c) > limit) return false;
  for (const t of times) if (t > c && t < c + DAY_MS && countIn(t) > limit) return false;
  return true;
}
