import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/audio
 * List enabled music tracks from the Music table (R2-hosted).
 */
export async function GET() {
  try {
    const rows = await prisma.music.findMany({
      where: { enabled: true },
      orderBy: [{ source: "asc" }, { createdAt: "asc" }],
    });

    const audio = rows.map((r) => ({
      key: r.filename,
      name: r.title + (r.artist ? ` — ${r.artist}` : ""),
      url: r.url,
      bpm: r.bpm,
      duration: r.durationMs ? r.durationMs / 1000 : undefined,
      moods: r.moods,
      source: r.source,
      license: r.license ?? undefined,
    }));

    return NextResponse.json({ audio, source: "music_db" });
  } catch (error) {
    console.error("[API] Error listing audio:", error);
    return NextResponse.json(
      { error: "Failed to list audio files" },
      { status: 500 },
    );
  }
}
