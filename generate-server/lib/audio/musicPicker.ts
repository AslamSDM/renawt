/**
 * Music picker — selects a track from the Music DB table based on mood + BPM.
 * Returns the track's R2 URL and BPM so the composer can align operations to beats.
 */

import { PrismaClient } from "../generated/prisma/index.js";

export interface MusicTrack {
  id: string;
  title: string;
  filename: string;
  url: string;
  moods: string[];
  artist: string | null;
  bpm: number;
  durationMs: number | null;
}

export interface PickedTrack {
  url: string;
  bpm: number;
  beatMs: number;
  title: string;
  moods: string[];
}

const globalForPrisma = globalThis as unknown as {
  __musicPrisma: PrismaClient | undefined;
};

function getPrisma(): PrismaClient {
  if (!globalForPrisma.__musicPrisma) {
    globalForPrisma.__musicPrisma = new PrismaClient();
  }
  return globalForPrisma.__musicPrisma;
}

let cached: MusicTrack[] | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

async function loadCatalog(): Promise<MusicTrack[]> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;
  const rows = await getPrisma().music.findMany({
    where: { enabled: true },
  });
  cached = rows.map((r) => ({
    id: r.id,
    title: r.title,
    filename: r.filename,
    url: r.url,
    moods: r.moods,
    artist: r.artist,
    bpm: r.bpm,
    durationMs: r.durationMs,
  }));
  cachedAt = Date.now();
  if (!cached.length) {
    throw new Error("Music table is empty — run scripts/seed-music.ts");
  }
  return cached;
}

/**
 * Pick the best-fit track for a given mood + intended BPM range.
 * Deterministic ordering: matching tracks sorted by closeness to target BPM.
 */
export async function pickTrack(opts: {
  mood?: string;
  preferredBpm?: number;
  bpmRange?: [number, number];
}): Promise<PickedTrack> {
  const catalog = await loadCatalog();
  const want = (opts.mood || "").toLowerCase().trim();
  const target = opts.preferredBpm ?? 124;
  const [minBpm, maxBpm] = opts.bpmRange ?? [80, 160];

  const inRange = catalog.filter((t) => t.bpm >= minBpm && t.bpm <= maxBpm);
  let pool = inRange.length ? inRange : catalog;

  if (want) {
    const moodMatches = pool.filter(
      (t) =>
        t.moods.some((m) => m.toLowerCase().includes(want)) ||
        t.title.toLowerCase().includes(want),
    );
    if (moodMatches.length) pool = moodMatches;
  }

  pool = [...pool].sort(
    (a, b) => Math.abs(a.bpm - target) - Math.abs(b.bpm - target),
  );
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
