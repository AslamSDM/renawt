/**
 * RENDER API - Server-Side Remotion Rendering
 *
 * POST /api/render
 * Body: { remotionCode: string, durationInFrames: number, format?: 'mp4' | 'webm' }
 *
 * Returns: { success: boolean, videoUrl?: string, error?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { renderVideo } from "@/lib/render/ssrRenderer";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for rendering

export async function POST(request: NextRequest) {
  console.log("[RenderAPI] Starting SSR render...");

  try {
    const body = await request.json();
    const { remotionCode, durationInFrames = 300, format = "mp4" } = body;

    if (!remotionCode) {
      return NextResponse.json(
        { error: "remotionCode is required" },
        { status: 400 },
      );
    }

    console.log(`[RenderAPI] Code length: ${remotionCode.length} chars`);
    console.log(
      `[RenderAPI] Duration: ${durationInFrames} frames, Format: ${format}`,
    );

    // Render the video
    const result = await renderVideo({
      remotionCode,
      durationInFrames,
      outputFormat: format,
    });

    if (result.success) {
      console.log(`[RenderAPI] Render successful: ${result.videoUrl}`);
      return NextResponse.json({
        success: true,
        videoUrl: result.videoUrl,
        renderTime: result.renderTime,
      });
    } else {
      console.error(`[RenderAPI] Render failed: ${result.error}`);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("[RenderAPI] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Render failed",
      },
      { status: 500 },
    );
  }
}

// GET for endpoint info
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/render",
    method: "POST",
    body: {
      remotionCode: "string (required) - Generated Remotion TSX code",
      durationInFrames:
        "number (optional, default 300) - Video duration in frames",
      format: "string (optional) - mp4 or webm",
    },
    returns: {
      success: "boolean",
      videoUrl:
        "string - Path to rendered video (e.g. /renders/video-abc123.mp4)",
      renderTime: "number - Render time in milliseconds",
      error: "string (on failure)",
    },
  });
}
