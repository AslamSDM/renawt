import { NextRequest, NextResponse } from "next/server";
import { uploadAudioToR2, isR2Configured } from "@/lib/storage/r2";

/**
 * POST /api/audio/upload
 * Upload an audio file to R2
 */
export async function POST(request: NextRequest) {
  try {
    if (!isR2Configured()) {
      return NextResponse.json(
        { error: "R2 storage not configured" },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("audio") as File;
    const bpm = formData.get("bpm") as string;
    const duration = formData.get("duration") as string;

    if (!file) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("audio/")) {
      return NextResponse.json(
        { error: "File must be an audio file" },
        { status: 400 }
      );
    }

    // Upload to R2
    const result = await uploadAudioToR2(file, {
      bpm: bpm ? parseInt(bpm) : undefined,
      duration: duration ? parseInt(duration) : undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Upload failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      audio: {
        key: result.key,
        name: file.name.replace(/\.[^/.]+$/, ""),
        url: result.url,
        bpm: bpm ? parseInt(bpm) : undefined,
        duration: duration ? parseInt(duration) : undefined,
      },
    });
  } catch (error) {
    console.error("[API] Error uploading audio:", error);
    return NextResponse.json(
      { error: "Failed to upload audio file" },
      { status: 500 }
    );
  }
}
