import { NextRequest, NextResponse } from "next/server";
import { cvProcessor } from "@/lib/recording/cvProcessor";

/**
 * GET /api/recordings/[id]/status
 * Get CV processing status for a recording
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const recordingId = params.id;

    // Check in-memory queue first
    const job = cvProcessor.getJobStatus(recordingId);

    if (job) {
      return NextResponse.json({
        recordingId,
        status: job.status,
        progress: job.progress || 0,
        cursorCount: job.cursorData?.length || 0,
        zoomPointCount: job.zoomPoints?.length || 0,
        error: job.error,
        startedAt: job.startedAt?.toISOString(),
        completedAt: job.completedAt?.toISOString(),
      });
    }

    // Check if we have saved data from a previous run
    const savedData = await cvProcessor.loadSavedData(recordingId);
    if (savedData) {
      return NextResponse.json({
        recordingId,
        status: "complete",
        progress: 100,
        cursorCount: savedData.cursorData.length,
        zoomPointCount: savedData.zoomPoints.length,
        source: savedData.source,
      });
    }

    // Recording not found in queue or saved data
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
  { params }: { params: { id: string } }
) {
  try {
    const recordingId = params.id;
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
