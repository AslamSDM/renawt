import { NextRequest, NextResponse } from "next/server";
import { cvProcessor } from "@/lib/recording/cvProcessor";
import { videoProcessor } from "@/lib/recording/videoProcessor";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/recordings/[id]/status
 * Get processing status for a recording (checks in-memory queues + DB)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recordingId } = await params;

    // Check in-memory video processing status
    const videoJob = videoProcessor.getJobStatus(recordingId);
    const processedVideoUrl = videoProcessor.getProcessedVideoUrl(recordingId);

    // Check in-memory CV detection status
    const cvJob = cvProcessor.getJobStatus(recordingId);

    if (cvJob || videoJob) {
      return NextResponse.json({
        recordingId,
        cvStatus: cvJob?.status || "complete",
        cvProgress: cvJob?.progress || 100,
        cursorCount: cvJob?.cursorData?.length || 0,
        zoomPointCount: cvJob?.zoomPoints?.length || 0,
        videoStatus: videoJob?.status || "not_started",
        videoProgress: videoJob?.progress || 0,
        processedVideoUrl: processedVideoUrl || null,
        status: videoJob?.status === "complete"
          ? "complete"
          : videoJob?.status || cvJob?.status || "pending",
        progress: videoJob
          ? Math.round((cvJob?.progress || 100) * 0.4 + (videoJob.progress || 0) * 0.6)
          : cvJob?.progress || 0,
        error: videoJob?.error || cvJob?.error,
        startedAt: cvJob?.startedAt?.toISOString(),
        completedAt: videoJob?.completedAt?.toISOString() || cvJob?.completedAt?.toISOString(),
      });
    }

    // Check if we have saved data from a previous CV run
    const savedData = await cvProcessor.loadSavedData(recordingId);
    if (savedData) {
      return NextResponse.json({
        recordingId,
        status: "complete",
        progress: 100,
        cursorCount: savedData.cursorData.length,
        zoomPointCount: savedData.zoomPoints.length,
        processedVideoUrl: processedVideoUrl || null,
        source: savedData.source,
      });
    }

    // Check the database as last resort (recording may have been processed before server restart)
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
 * Retry failed CV processing
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recordingId } = await params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "retry") {
      await cvProcessor.retryJob(recordingId);
      return NextResponse.json({
        recordingId,
        status: "retrying",
        message: "CV processing retry initiated",
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
