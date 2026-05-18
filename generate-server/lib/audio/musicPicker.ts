/**
 * Music picker — selects a track from music_metadata.json based on mood + duration.
 * Returns the track's R2 URL and BPM so the composer can align operations to beats.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

export interface MusicTrack {
  title: string;
  filename: string;
  url: string;
  moods: string[];
  artist: string;
  bpm: number;
  durationMs?: number;
}

export interface PickedTrack {
  url: string;
  bpm: number;
  beatMs: number;
  title: string;
  moods: string[];
}

let cached: MusicTrack[] | null = null;

function loadCatalog(): MusicTrack[] {
  if (cached) return cached;
  // Locate music_metadata.json — try repo root from generate-server cwd then ../
  const candidates = [
    resolve(process.cwd(), "music_metadata.json"),
    resolve(process.cwd(), "..", "music_metadata.json"),
    resolve(__dirname, "../../../music_metadata.json"),
  ];
  for (const p of candidates) {
    try {
      const data = readFileSync(p, "utf8");
      cached = JSON.parse(data) as MusicTrack[];
      return cached;
    } catch {}
  }
  throw new Error(
    `music_metadata.json not found. Tried: ${candidates.join(", ")}`,
  );
}

/**
 * Pick the best-fit track for a given mood + intended BPM range.
 * Deterministic ordering: matching tracks sorted by closeness to target BPM.
 */
export function pickTrack(opts: {
  /** Free-form mood (matched substring against track.moods + title). */
  mood?: string;
  /** Preferred BPM. Default 124 (~product-launch energy). */
  preferredBpm?: number;
  /** Hard BPM filter, e.g. [110, 130]. */
  bpmRange?: [number, number];
}): PickedTrack {
  const catalog = loadCatalog();
  const want = (opts.mood || "").toLowerCase().trim();
  const target = opts.preferredBpm ?? 124;
  const [minBpm, maxBpm] = opts.bpmRange ?? [80, 160];

  const inRange = catalog.filter(
    (t) => t.bpm >= minBpm && t.bpm <= maxBpm,
  );
  let pool = inRange.length ? inRange : catalog;

  if (want) {
    const moodMatches = pool.filter(
      (t) =>
        t.moods.some((m) => m.toLowerCase().includes(want)) ||
        t.title.toLowerCase().includes(want),
    );
    if (moodMatches.length) pool = moodMatches;
  }

  pool.sort((a, b) => Math.abs(a.bpm - target) - Math.abs(b.bpm - target));
  const picked = pool[0];

  return {
    url: picked.url,
    bpm: picked.bpm,
    beatMs: 60000 / picked.bpm,
    title: picked.title,
    moods: picked.moods,
  };
}

/** Map BrandReport mood → music mood keyword. */
export function moodToMusicKeyword(brandMood: string): string {
  switch (brandMood) {
    case "premium":
    case "minimal":
      return "product";
    case "playful":
    case "warm":
      return "advertising";
    case "techy":
    case "bold":
      return "launch";
    default:
      return "product";
  }
}
