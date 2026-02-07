import { NextRequest, NextResponse } from "next/server";
import { listAudioFiles, isR2Configured } from "@/lib/storage/r2";
import musicMetadata from "@/music_metadata.json";

/**
 * GET /api/audio
 * List all available audio files — serves tracks from music_metadata.json (R2-hosted)
 * plus any user-uploaded audio from R2
 */
export async function GET() {
  try {
    // Primary source: music_metadata.json tracks (hosted on R2)
    const metadataTracks = musicMetadata.map((track) => ({
      key: track.filename,
      name: track.title + (track.artist ? ` — ${track.artist}` : ""),
      url: track.url,
      bpm: 120,
      duration: undefined as number | undefined,
      moods: track.moods,
    }));

    // Also include user-uploaded audio from R2 if configured
    let userUploads: typeof metadataTracks = [];
    if (isR2Configured()) {
      try {
        const r2Files = await listAudioFiles();
        userUploads = r2Files.map((file) => ({
          key: file.key,
          name: file.name,
          url: file.url,
          bpm: file.bpm || 120,
          duration: file.duration,
          moods: [] as string[],
        }));
      } catch {
        // R2 user uploads optional — don't fail
      }
    }

    return NextResponse.json({
      audio: [...metadataTracks, ...userUploads],
      source: "music_metadata",
    });
  } catch (error) {
    console.error("[API] Error listing audio:", error);
    return NextResponse.json(
      { error: "Failed to list audio files" },
      { status: 500 }
    );
  }
}
