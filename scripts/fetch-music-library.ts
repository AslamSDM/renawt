/**
 * Fetch opensource music tracks → upload to R2 → insert into Music table.
 *
 * Sources:
 *   - Pixabay Music   (needs PIXABAY_API_KEY)
 *   - Free Music Archive (FMA)  (best-effort; their public endpoints are flaky)
 *
 * Usage:
 *   PIXABAY_API_KEY=xxx FMA_API_KEY=xxx npx tsx scripts/fetch-music-library.ts
 *
 * Options via env:
 *   MUSIC_FETCH_LIMIT      max tracks per query (default 30)
 *   MUSIC_FETCH_QUERIES    comma-sep queries (default: corporate,upbeat,product,techno,calm,energetic,cinematic)
 *
 * Idempotent: skips R2 uploads + DB rows that already exist by filename.
 */

import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const prisma = new PrismaClient();

// ─── R2 config ────────────────────────────────────────────────────────────────
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "remawt-videos";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/[%\s/]+$/, "");

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  throw new Error("R2 env vars missing (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)");
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

async function r2Exists(key: string): Promise<boolean> {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function r2Put(key: string, body: Buffer, contentType: string) {
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: { "uploaded-at": new Date().toISOString() },
    }),
  );
}

function r2PublicUrl(key: string): string {
  return R2_PUBLIC_URL
    ? `${R2_PUBLIC_URL}/${key}`
    : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
}

// ─── Track shape ──────────────────────────────────────────────────────────────
interface IngestTrack {
  title: string;
  filename: string; // unique slug.mp3
  artist?: string;
  bpm: number;
  moods: string[];
  source: "pixabay" | "fma";
  license: string;
  durationMs?: number;
  remoteUrl: string; // where to download mp3 from
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

// ─── Pixabay fetch ────────────────────────────────────────────────────────────
async function fetchPixabay(query: string, perPage: number): Promise<IngestTrack[]> {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) {
    console.log("[fetch-music] PIXABAY_API_KEY not set — skipping Pixabay");
    return [];
  }

  const url = `https://pixabay.com/api/audio/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=${perPage}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`[fetch-music] Pixabay "${query}" failed: ${res.status}`);
    return [];
  }
  const json = (await res.json()) as {
    hits?: Array<{
      id: number;
      title?: string;
      audio?: string;
      audio_mp3?: string;
      audio_url?: string;
      user?: string;
      tags?: string;
      duration?: number;
    }>;
  };

  const hits = json.hits ?? [];
  const out: IngestTrack[] = [];
  for (const h of hits) {
    const remoteUrl = h.audio_mp3 || h.audio || h.audio_url || "";
    if (!remoteUrl) continue;
    const title = h.title || `Pixabay ${h.id}`;
    const artist = h.user || "Pixabay";
    const moods = (h.tags || query)
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 6);
    out.push({
      title,
      filename: `pixabay-${slugify(title)}-${h.id}.mp3`,
      artist,
      bpm: 120,
      moods,
      source: "pixabay",
      license: "pixabay",
      durationMs: h.duration ? h.duration * 1000 : undefined,
      remoteUrl,
    });
  }
  return out;
}

// ─── FMA fetch ────────────────────────────────────────────────────────────────
async function fetchFMA(query: string, limit: number): Promise<IngestTrack[]> {
  // FMA's official API is intermittent. We hit the public search JSON endpoint;
  // if it 4xx/5xx we just skip gracefully.
  const apiKey = process.env.FMA_API_KEY;
  if (!apiKey) {
    console.log("[fetch-music] FMA_API_KEY not set — skipping FMA");
    return [];
  }

  const url = `https://freemusicarchive.org/api/get/tracks.json?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=${limit}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.warn(`[fetch-music] FMA "${query}" failed: ${res.status}`);
      return [];
    }
    const json = (await res.json()) as {
      dataset?: Array<{
        track_id?: string;
        track_title?: string;
        artist_name?: string;
        track_listen_url?: string;
        track_url?: string;
        track_genres?: Array<{ genre_title: string }>;
        track_duration?: string; // mm:ss
        license_title?: string;
      }>;
    };
    const rows = json.dataset ?? [];

    const out: IngestTrack[] = [];
    for (const r of rows) {
      const remoteUrl = r.track_listen_url || r.track_url || "";
      if (!remoteUrl) continue;
      const title = r.track_title || `FMA ${r.track_id}`;
      const moods = (r.track_genres || [])
        .map((g) => g.genre_title.toLowerCase())
        .slice(0, 6);
      let durationMs: number | undefined;
      if (r.track_duration && /^\d+:\d+$/.test(r.track_duration)) {
        const [mm, ss] = r.track_duration.split(":").map(Number);
        durationMs = (mm * 60 + ss) * 1000;
      }
      out.push({
        title,
        filename: `fma-${slugify(title)}-${r.track_id}.mp3`,
        artist: r.artist_name || "FMA",
        bpm: 120,
        moods: moods.length ? moods : [query.toLowerCase()],
        source: "fma",
        license: r.license_title || "CC",
        durationMs,
        remoteUrl,
      });
    }
    return out;
  } catch (err) {
    console.warn(`[fetch-music] FMA error: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────
async function ingestOne(t: IngestTrack): Promise<"inserted" | "skipped" | "failed"> {
  const existing = await prisma.music.findUnique({ where: { filename: t.filename } });
  if (existing) return "skipped";

  const key = `audio/library/${t.filename}`;
  try {
    if (!(await r2Exists(key))) {
      const res = await fetch(t.remoteUrl, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) {
        console.warn(`[fetch-music] download failed (${res.status}): ${t.remoteUrl}`);
        return "failed";
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength < 5000) {
        console.warn(`[fetch-music] suspiciously small file (${buf.byteLength}b): ${t.title}`);
        return "failed";
      }
      await r2Put(key, buf, "audio/mpeg");
    }

    await prisma.music.create({
      data: {
        title: t.title,
        filename: t.filename,
        url: r2PublicUrl(key),
        artist: t.artist ?? null,
        bpm: t.bpm,
        durationMs: t.durationMs ?? null,
        moods: t.moods,
        source: t.source,
        license: t.license,
        enabled: true,
      },
    });
    return "inserted";
  } catch (err) {
    console.warn(`[fetch-music] ingest failed for ${t.title}: ${err instanceof Error ? err.message : err}`);
    return "failed";
  }
}

async function main() {
  const limit = Number(process.env.MUSIC_FETCH_LIMIT || 30);
  const queries = (
    process.env.MUSIC_FETCH_QUERIES ||
    "corporate,upbeat,product,techno,calm,energetic,cinematic,inspiring,electronic,ambient"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  console.log(`[fetch-music] queries=${queries.join(", ")} limit=${limit}`);

  const collected: IngestTrack[] = [];
  for (const q of queries) {
    const [px, fma] = await Promise.all([fetchPixabay(q, limit), fetchFMA(q, limit)]);
    collected.push(...px, ...fma);
    console.log(`[fetch-music] "${q}" → pixabay=${px.length} fma=${fma.length}`);
  }

  // Dedup by filename
  const byFilename = new Map<string, IngestTrack>();
  for (const t of collected) byFilename.set(t.filename, t);
  const unique = [...byFilename.values()];
  console.log(`[fetch-music] ${unique.length} unique tracks → ingesting...`);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;
  for (const t of unique) {
    const r = await ingestOne(t);
    if (r === "inserted") inserted++;
    else if (r === "skipped") skipped++;
    else failed++;
  }

  const total = await prisma.music.count();
  console.log(
    `[fetch-music] done. inserted=${inserted} skipped=${skipped} failed=${failed} totalInDb=${total}`,
  );
}

main()
  .catch((err) => {
    console.error("[fetch-music] fatal:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
