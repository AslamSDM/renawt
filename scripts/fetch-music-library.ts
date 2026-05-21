/**
 * Fetch opensource music tracks → upload to R2 → insert into Music table.
 *
 * Sources:
 *   - Pixabay  (scraped via scraper-service /scrape-pixabay-music — their
 *              public API does NOT expose audio, only images)
 *   - Jamendo  (public CC music API; needs JAMENDO_CLIENT_ID)
 *
 * Usage:
 *   SCRAPER_SERVICE_URL=http://localhost:4001 \
 *   JAMENDO_CLIENT_ID=xxx \
 *   npx tsx scripts/fetch-music-library.ts
 *
 * Options via env:
 *   MUSIC_FETCH_LIMIT     max tracks per query/source (default 20)
 *   MUSIC_FETCH_QUERIES   comma-sep queries (default: corporate,upbeat,product,techno,calm,energetic,cinematic,inspiring,electronic,ambient)
 *   MUSIC_SOURCES         comma-sep enabled sources (default: pixabay,jamendo)
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

const SCRAPER_SERVICE_URL =
  process.env.SCRAPER_SERVICE_URL || "http://localhost:4001";
const SCRAPER_AUTH_TOKEN = process.env.SCRAPER_AUTH_TOKEN || "";

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
  source: "pixabay" | "jamendo";
  license: string;
  durationMs?: number;
  remoteUrl: string;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

// ─── Pixabay (via scraper-service) ────────────────────────────────────────────
async function fetchPixabayViaScraper(
  query: string,
  limit: number,
): Promise<IngestTrack[]> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (SCRAPER_AUTH_TOKEN) headers.Authorization = `Bearer ${SCRAPER_AUTH_TOKEN}`;

  const res = await fetch(`${SCRAPER_SERVICE_URL}/scrape-pixabay-music`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, limit }),
    signal: AbortSignal.timeout(180000),
  });

  if (!res.ok) {
    console.warn(`[fetch-music] pixabay "${query}" scraper failed: ${res.status}`);
    return [];
  }
  const json = (await res.json()) as {
    success: boolean;
    tracks?: Array<{
      title: string;
      artist: string;
      durationSec: number;
      mp3Url: string;
      tags: string[];
      pixabayId: string;
    }>;
    error?: string;
  };
  if (!json.success || !json.tracks) {
    console.warn(`[fetch-music] pixabay "${query}" returned no tracks: ${json.error || ""}`);
    return [];
  }

  const out: IngestTrack[] = [];
  for (const t of json.tracks) {
    if (!t.mp3Url) continue;
    out.push({
      title: t.title,
      filename: `pixabay-${slugify(t.title)}-${t.pixabayId}.mp3`,
      artist: t.artist || "Pixabay",
      bpm: 120,
      moods: t.tags.length ? t.tags : [query.toLowerCase()],
      source: "pixabay",
      license: "pixabay",
      durationMs: t.durationSec ? t.durationSec * 1000 : undefined,
      remoteUrl: t.mp3Url,
    });
  }
  return out;
}

// ─── Jamendo ──────────────────────────────────────────────────────────────────
async function fetchJamendo(query: string, limit: number): Promise<IngestTrack[]> {
  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (!clientId) {
    console.log("[fetch-music] JAMENDO_CLIENT_ID not set — skipping Jamendo");
    return [];
  }

  const params = new URLSearchParams({
    client_id: clientId,
    format: "json",
    limit: String(limit),
    tags: query,
    audioformat: "mp32",
    include: "musicinfo+licenses",
  });
  const url = `https://api.jamendo.com/v3.0/tracks/?${params.toString()}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.warn(`[fetch-music] Jamendo "${query}" failed: ${res.status}`);
      return [];
    }
    const json = (await res.json()) as {
      results?: Array<{
        id: string;
        name: string;
        artist_name: string;
        audio: string;
        audiodownload?: string;
        duration: number;
        musicinfo?: {
          tags?: { genres?: string[]; moods?: string[] };
          acousticelectric?: string;
          vocalinstrumental?: string;
        };
        license_ccurl?: string;
      }>;
      headers?: { status: string; error_message?: string };
    };

    if (json.headers?.status && json.headers.status !== "success") {
      console.warn(
        `[fetch-music] Jamendo "${query}" status=${json.headers.status} msg=${json.headers.error_message || ""}`,
      );
      return [];
    }

    const out: IngestTrack[] = [];
    for (const r of json.results || []) {
      const remoteUrl = r.audiodownload || r.audio;
      if (!remoteUrl) continue;
      const moods = [
        ...(r.musicinfo?.tags?.genres || []),
        ...(r.musicinfo?.tags?.moods || []),
      ]
        .map((m) => m.toLowerCase())
        .slice(0, 6);
      out.push({
        title: r.name,
        filename: `jamendo-${slugify(r.name)}-${r.id}.mp3`,
        artist: r.artist_name || "Jamendo",
        bpm: 120,
        moods: moods.length ? moods : [query.toLowerCase()],
        source: "jamendo",
        license: r.license_ccurl ? "CC-BY" : "Jamendo",
        durationMs: r.duration ? r.duration * 1000 : undefined,
        remoteUrl,
      });
    }
    return out;
  } catch (err) {
    console.warn(
      `[fetch-music] Jamendo error: ${err instanceof Error ? err.message : err}`,
    );
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
    console.warn(
      `[fetch-music] ingest failed for ${t.title}: ${err instanceof Error ? err.message : err}`,
    );
    return "failed";
  }
}

async function main() {
  const limit = Number(process.env.MUSIC_FETCH_LIMIT || 20);
  const queries = (
    process.env.MUSIC_FETCH_QUERIES ||
    "corporate,upbeat,product,techno,calm,energetic,cinematic,inspiring,electronic,ambient"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const enabledSources = new Set(
    (process.env.MUSIC_SOURCES || "pixabay,jamendo")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );

  console.log(
    `[fetch-music] queries=${queries.join(", ")} limit=${limit} sources=${[...enabledSources].join(",")}`,
  );

  const collected: IngestTrack[] = [];
  for (const q of queries) {
    const tasks: Promise<IngestTrack[]>[] = [];
    if (enabledSources.has("pixabay")) tasks.push(fetchPixabayViaScraper(q, limit));
    if (enabledSources.has("jamendo")) tasks.push(fetchJamendo(q, limit));
    const results = await Promise.all(tasks);
    const px = enabledSources.has("pixabay") ? results.shift() ?? [] : [];
    const jm = enabledSources.has("jamendo") ? results.shift() ?? [] : [];
    collected.push(...px, ...jm);
    console.log(`[fetch-music] "${q}" → pixabay=${px.length} jamendo=${jm.length}`);
  }

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
