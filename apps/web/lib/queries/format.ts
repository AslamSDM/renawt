/** Display helpers shared by app pages. Pure functions; safe on server and client. */
import { getFormat, getNiche } from "@remawt/shared";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("en");

export function formatCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "–";
  return Math.abs(n) >= 10_000 ? compact.format(n) : whole.format(n);
}

export function formatUsd(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "–";
  return `$${n.toFixed(digits)}`;
}

export function formatSeconds(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return "–";
  const s = Math.round(sec);
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s}s`;
}

export function formatMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatDate(d: Date | string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }, timeZone?: string) {
  return new Intl.DateTimeFormat("en", { ...opts, timeZone }).format(new Date(d));
}

export function formatDateTime(d: Date | string, timeZone?: string) {
  return formatDate(d, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }, timeZone);
}

export function relativeTime(d: Date | string, now = Date.now()): string {
  const diff = new Date(d).getTime() - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60_000) return "just now";
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  if (abs < 7 * 86_400_000) return rtf.format(Math.round(diff / 86_400_000), "day");
  return formatDate(d);
}

export function formatName(id: string | null | undefined): string {
  if (!id) return "Auto";
  return getFormat(id)?.name ?? id.replace(/[-_]/g, " ");
}

export function nicheName(slug: string | null | undefined): string {
  if (!slug) return "–";
  return getNiche(slug)?.name ?? slug;
}

export const PLATFORM_LABEL: Record<string, string> = {
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  THREADS: "Threads",
  LINKEDIN: "LinkedIn",
  X: "X",
  PINTEREST: "Pinterest",
  REDDIT: "Reddit",
  GOOGLE_TRENDS: "Google Trends",
  NEWS: "News",
};

export function platformLabel(p: string | null | undefined): string {
  if (!p) return "–";
  return PLATFORM_LABEL[p.toUpperCase()] ?? p;
}

/** ISO week key, e.g. 2026-W44 (matches TrendCard.weekKey). */
export function weekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function shiftWeek(key: string, delta: number): string {
  const m = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!m) return weekKey();
  // Monday of ISO week 1 is the Monday of the week holding Jan 4.
  const jan4 = new Date(Date.UTC(Number(m[1]), 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (Number(m[2]) - 1 + delta) * 7);
  return weekKey(new Date(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate()));
}

/** Monday 00:00 (local server time) of the week containing `d`. */
export function startOfWeek(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() || 7) - 1));
  return x;
}
