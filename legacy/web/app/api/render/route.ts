/**
 * RENDER API - Proxies to generate-server's render endpoint
 *
 * POST /api/render
 * Body: { remotionCode: string, durationInFrames: number, format?: 'mp4' | 'webm' }
 *
 * Returns: { success: boolean, videoUrl?: string, error?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for rendering

const GENERATE_SERVER_URL = process.env.GENERATE_SERVER_URL || "http://localhost:3001";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  console.log("[RenderAPI] Proxying render to generate-server...");

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
    console.log(`[RenderAPI] Duration: ${durationInFrames} frames, Format: ${format}`);

    // Submit render job via generate-server's render-service client
    const RENDER_SERVICE_URL = process.env.RENDER_SERVICE_URL || "http://localhost:4002";

    const submitResponse = await fetch(`${RENDER_SERVICE_URL}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        remotionCode,
        durationInFrames,
        outputFormat: format,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      return NextResponse.json(
        { success: false, error: `Render service error: ${errorText}` },
        { status: 500 },
      );
    }

    const { jobId } = await submitResponse.json();

    // Poll for completion
    const startTime = Date.now();
    const timeoutMs = 5 * 60 * 1000;

    while (Date.now() - startTime < timeoutMs) {
      const statusResponse = await fetch(`${RENDER_SERVICE_URL}/render/${jobId}/status`, {
        signal: AbortSignal.timeout(10000),
      });

      if (!statusResponse.ok) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      const status = await statusResponse.json();

      if (status.status === "completed") {
        // Download file from render-service and upload to R2
        const { uploadVideoBufferToR2, isR2Configured } = await import("@/lib/storage/r2");

        if (!isR2Configured()) {
          return NextResponse.json(
            { success: false, error: "R2 not configured" },
            { status: 500 },
          );
        }

        const fileResponse = await fetch(`${RENDER_SERVICE_URL}/render/${jobId}/file`, {
          signal: AbortSignal.timeout(60000),
        });

        if (!fileResponse.ok) {
          return NextResponse.json(
            { success: false, error: "Failed to download rendered file" },
            { status: 500 },
          );
        }

        const arrayBuffer = await fileResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const uploadResult = await uploadVideoBufferToR2(buffer, `video-${jobId}.mp4`);

        // Cleanup render-service file
        fetch(`${RENDER_SERVICE_URL}/render/${jobId}/cleanup`, { method: "DELETE" }).catch(() => {});

        if (uploadResult.success && uploadResult.url) {
          return NextResponse.json({
            success: true,
            videoUrl: uploadResult.url,
            renderTime: status.renderTime,
          });
        } else {
          return NextResponse.json(
            { success: false, error: `R2 upload failed: ${uploadResult.error}` },
            { status: 500 },
          );
        }
      }

      if (status.status === "failed") {
        return NextResponse.json(
          { success: false, error: status.error || "Render failed" },
          { status: 500 },
        );
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    return NextResponse.json(
      { success: false, error: "Render timed out" },
      { status: 504 },
    );
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
      durationInFrames: "number (optional, default 300) - Video duration in frames",
      format: "string (optional) - mp4 or webm",
    },
    returns: {
      success: "boolean",
      videoUrl: "string - R2 URL of rendered video",
      renderTime: "number - Render time in milliseconds",
      error: "string (on failure)",
    },
  });
}
