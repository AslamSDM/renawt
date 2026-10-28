/**
 * Music picker — selects a track from the Music table by mood + BPM (5-min in-process cache).
 * Ported from legacy generate-server/lib/audio/musicPicker.ts. Deterministic per (mood, seed) so
 * re-runs pick the same track; `seed` (e.g. channelId) varies picks across channels.
 */
import { db } from "../db.js";
import { has } from "../env.js";

export interface MusicTrack { id: string; title: string; url: string; moods: string[]; bpm: number; durationMs: number | null }
export interface PickedTrack { id: string; url: string; bpm: number; beatMs: number; title: string; moods: string[]; durationMs: number }

let cached: MusicTrack[] | null = null;
let cachedAt = 0;
const TTL = 5 * 60 * 1000;

async function catalog(): Promise<MusicTrack[]> {
  if (cached && Date.now() - cachedAt < TTL) return cached;
  const rows = await db().music.findMany({ where: { enabled: true } });
  cached = rows.map((r) => ({ id: r.id, title: r.title, url: r.url, moods: r.moods, bpm: r.bpm, durationMs: r.durationMs }));
  cachedAt = Date.now();
  return cached;
}

/** Map plan musicMood / skin motion to a library mood keyword. */
export const MOOD_ALIASES: Record<string, string[]> = {
  upbeat: ["upbeat", "energetic", "happy", "launch"],
  calm: ["calm", "chill", "ambient", "lofi", "minimal"],
  dramatic: ["dramatic", "cinematic", "epic", "tension"],
  curious: ["curious", "playful", "quirky", "light"],
  serious: ["corporate", "serious", "documentary", "product"],
  playful: ["playful", "fun", "quirky", "advertising"],
};

export function bpmForMood(mood: string): number {
  switch (mood) {
    case "upbeat": return 128;
    case "dramatic": return 100;
    case "calm": return 90;
    case "playful": return 120;
    default: return 115;
  }
}

export function chooseTrack(tracks: MusicTrack[], opts: { mood?: string; preferredBpm?: number; minDurationMs?: number; seed?: string }): MusicTrack | null {
  if (!tracks.length) return null;
  const want = (opts.mood ?? "").toLowerCase().trim();
  const keywords = MOOD_ALIASES[want] ?? (want ? [want] : []);
  const target = opts.preferredBpm ?? bpmForMood(want);
  let pool = tracks;
  if (opts.minDurationMs) {
    const long = pool.filter((t) => !t.durationMs || t.durationMs >= opts.minDurationMs!);
    if (long.length) pool = long;
  }
  if (keywords.length) {
    const m = pool.filter((t) => t.moods.some((x) => keywords.some((k) => x.toLowerCase().includes(k))) || keywords.some((k) => t.title.toLowerCase().includes(k)));
    if (m.length) pool = m;
  }
  const sorted = [...pool].sort((a, b) => Math.abs(a.bpm - target) - Math.abs(b.bpm - target) || a.id.localeCompare(b.id));
  // pick among the 3 closest by seed so channels don't all share one track
  const top = sorted.slice(0, Math.min(3, sorted.length));
  const idx = opts.seed ? [...opts.seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % top.length : 0;
  return top[idx];
}

export async function pickTrack(opts: { mood?: string; preferredBpm?: number; minDurationMs?: number; seed?: string }): Promise<PickedTrack | null> {
  if (!has.db()) return null;
  const t = chooseTrack(await catalog(), opts);
  if (!t) return null;
  return { id: t.id, url: t.url, bpm: t.bpm, beatMs: 60000 / t.bpm, title: t.title, moods: t.moods, durationMs: t.durationMs ?? 0 };
}
