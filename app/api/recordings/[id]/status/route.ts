import { NextRequest, NextResponse } from "next/server";
import { videoProcessor } from "@/lib/recording/videoProcessor";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";

/**
 * GET /api/recordings/[id]/status
 * Get processing status for a recording
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const { id: recordingId } = await params;

    // Check in-memory video processing status
    const videoJob = videoProcessor.getJobStatus(recordingId);
    const processedVideoUrl = videoProcessor.getProcessedVideoUrl(recordingId);

    if (videoJob) {
      return NextResponse.json({
        recordingId,
        videoStatus: videoJob.status,
        videoProgress: videoJob.progress || 0,
        processedVideoUrl: processedVideoUrl || null,
        status: videoJob.status,
        progress: videoJob.progress || 0,
        error: videoJob.error,
        startedAt: videoJob.startedAt?.toISOString(),
        completedAt: videoJob.completedAt?.toISOString(),
      });
    }

    // Check the database as last resort
    try {
      const dbRecording = await prisma.screenRecording.findUnique({
        where: { id: recordingId },
        select: { processedVideoUrl: true, processingStatus: true },
      });
      if (dbRecording?.processedVideoUrl) {
        return NextResponse.json({
          recordingId,
          status: "complete",
          progress: 100,
          processedVideoUrl: dbRecording.processedVideoUrl,
        });
      }
      if (dbRecording?.processingStatus === "complete") {
        return NextResponse.json({
          recordingId,
          status: "complete",
          progress: 100,
          processedVideoUrl: null,
        });
      }
    } catch {
      // DB lookup failed, continue to not_found
    }

    // Recording not found in any source
    return NextResponse.json({
      recordingId,
      status: "not_found",
      message: "Recording not found in processing queue",
    });

  } catch (error) {
    console.error("[API] Failed to get recording status:", error);
    return NextResponse.json(
      { error: "Failed to get recording status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/recordings/[id]/status/retry
 * Retry failed video processing
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const { id: recordingId } = await params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "retry") {
      // Video processing retry is handled by the videoProcessor
      // For now, return not supported
      return NextResponse.json({
        recordingId,
        status: "not_supported",
        message: "Video processing retry not implemented",
      });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );

  } catch (error) {
    console.error("[API] Failed to retry recording:", error);
    return NextResponse.json(
      { error: "Failed to retry" },
      { status: 500 }
    );
  }
}
