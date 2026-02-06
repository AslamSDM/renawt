import { NextRequest, NextResponse } from "next/server";
import { listAudioFiles, isR2Configured } from "@/lib/storage/r2";

/**
 * GET /api/audio
 * List all available audio files from R2
 */
export async function GET() {
  try {
    if (!isR2Configured()) {
      // Return mock data if R2 is not configured
      return NextResponse.json({
        audio: [
          {
            key: "audio/audio1.mp3",
            name: "Energetic Upbeat",
            url: "/audio/audio1.mp3",
            bpm: 128,
            duration: 30,
          },
          {
            key: "audio/audio2.mp3",
            name: "Corporate Tech",
            url: "/audio/audio2.mp3",
            bpm: 120,
            duration: 30,
          },
        ],
        source: "local",
      });
    }

    const audioFiles = await listAudioFiles();
    
    return NextResponse.json({
      audio: audioFiles.map(file => ({
        key: file.key,
        name: file.name,
        url: file.url,
        bpm: file.bpm,
        duration: file.duration,
      })),
      source: "r2",
    });
  } catch (error) {
    console.error("[API] Error listing audio:", error);
    return NextResponse.json(
      { error: "Failed to list audio files" },
      { status: 500 }
    );
  }
}
