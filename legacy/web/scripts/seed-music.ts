/**
 * Seed Music table with the original 15 R2-hosted Pixabay tracks.
 * Idempotent — upserts by `filename`.
 *
 *   npx tsx scripts/seed-music.ts
 */
import { prisma } from "../lib/db/prisma";

const SEED_TRACKS = [
  { title: "Product Launch Advertising Commercial Music", filename: "hitslab-product-launch-advertising-commercial-music-301409.mp3", artist: "Hitslab", bpm: 125, moods: ["product", "launch", "advertising"] },
  { title: "Product Launch Advertising Commercial Music", filename: "backgroundmusicforvideos-product-launch-advertising-commercial-music-314658.mp3", artist: "Backgroundmusicforvideos", bpm: 128, moods: ["product", "launch", "advertising"] },
  { title: "Product Launch Advertising Commercial Music", filename: "lnplusmusic-product-launch-advertising-commercial-music-306038.mp3", artist: "Lnplusmusic", bpm: 120, moods: ["product", "launch", "advertising"] },
  { title: "Commercial Advertising Product Launch Music", filename: "backgroundmusicforvideo-commercial-advertising-product-launch-music-412813.mp3", artist: "Backgroundmusicforvideo", bpm: 130, moods: ["advertising", "product", "launch"] },
  { title: "Product Launch Commercial Advertising Music", filename: "hitslab-product-launch-commercial-advertising-music-323265.mp3", artist: "Hitslab", bpm: 126, moods: ["product", "launch", "advertising"] },
  { title: "Product Launch Commercial Advertising Music", filename: "backgroundmusicforvideos-product-launch-commercial-advertising-music-376510.mp3", artist: "Backgroundmusicforvideos", bpm: 124, moods: ["product", "launch", "advertising"] },
  { title: "Upbeat Corporate Business Music", filename: "petrushkasound-upbeat-corporate-business-music-461987.mp3", artist: "Petrushkasound", bpm: 130, moods: ["upbeat", "corporate", "business"] },
  { title: "Product Launch Advertising Commercial Music", filename: "original_soundtrack-product-launch-advertising-commercial-music-344588.mp3", artist: "Original Soundtrack", bpm: 122, moods: ["product", "launch", "advertising"] },
  { title: "Product Launch Advertising Commercial Music", filename: "backgroundmusicforvideos-product-launch-advertising-commercial-music-368052.mp3", artist: "Backgroundmusicforvideos", bpm: 125, moods: ["product", "launch", "advertising"] },
  { title: "Product Launch Advertising Commercial Music", filename: "soundgallerybydmitrytaras-product-launch-advertising-commercial-music-362884.mp3", artist: "Soundgallerybydmitrytaras", bpm: 128, moods: ["product", "launch", "advertising"] },
  { title: "Disco Funk Background Music", filename: "rediskasound-disco-funk-background-music-462444.mp3", artist: "Rediskasound", bpm: 118, moods: ["disco", "funk", "background"] },
  { title: "Product", filename: "nastelbom-product-422908.mp3", artist: "Nastelbom", bpm: 120, moods: ["product"] },
  { title: "Energetic Pop Background Music", filename: "rediskasound-energetic-pop-background-music-462435.mp3", artist: "Rediskasound", bpm: 135, moods: ["energetic", "pop", "background"] },
  { title: "Business Corporate Background Music", filename: "petrushkasound-business-corporate-background-music-461956.mp3", artist: "Petrushkasound", bpm: 110, moods: ["business", "corporate", "background"] },
  { title: "Product Launch Advertising Music", filename: "backgroundmusicforvideos-product-launch-advertising-music-322166.mp3", artist: "Backgroundmusicforvideos", bpm: 126, moods: ["product", "launch", "advertising"] },
];

const R2_PREFIX = "https://pub-52c4f36ed495483b84403a8cbd2d2ff3.r2.dev";

async function main() {
  console.log(`[seed-music] Seeding ${SEED_TRACKS.length} tracks...`);

  let inserted = 0;
  let updated = 0;
  for (const t of SEED_TRACKS) {
    const url = `${R2_PREFIX}/${t.filename}`;
    const existing = await prisma.music.findUnique({ where: { filename: t.filename } });
    await prisma.music.upsert({
      where: { filename: t.filename },
      create: {
        title: t.title,
        filename: t.filename,
        url,
        moods: t.moods,
        artist: t.artist,
        bpm: t.bpm,
        source: "seed",
        license: "pixabay",
        enabled: true,
      },
      update: {
        title: t.title,
        url,
        moods: t.moods,
        artist: t.artist,
        bpm: t.bpm,
      },
    });
    if (existing) updated++;
    else inserted++;
  }

  const total = await prisma.music.count();
  console.log(`[seed-music] inserted=${inserted} updated=${updated} totalInDb=${total}`);
}

main()
  .catch((err) => {
    console.error("[seed-music] failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
