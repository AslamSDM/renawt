import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "remawt-videos";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/[%\s/]+$/, '');

const getR2Client = (): S3Client => {
  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  });
};

/**
 * POST /api/recordings
 * Save a new screen recording
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const video = formData.get("video") as File;
    const projectId = formData.get("projectId") as string;
    const cursorData = formData.get("cursorData") as string;
    const zoomPoints = formData.get("zoomPoints") as string;
    const featureName = formData.get("featureName") as string;
    const description = formData.get("description") as string;
    const duration = parseFloat(formData.get("duration") as string);
    const cursorStyle = formData.get("cursorStyle") as string || "hand-pointing";

    // Validate required fields
    if (!video || !featureName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Upload video to R2
    const client = getR2Client();
    const videoBuffer = Buffer.from(await video.arrayBuffer());
    const recordingId = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const fileName = `recording-${recordingId}.webm`;
    const effectiveProjectId = projectId || "creative-session";
    const key = `recordings/${effectiveProjectId}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: videoBuffer,
      ContentType: "video/webm",
      Metadata: {
        "uploaded-at": new Date().toISOString(),
        "project-id": effectiveProjectId,
        "feature-name": featureName,
      },
    });

    await client.send(command);

    const videoUrl = R2_PUBLIC_URL
      ? `${R2_PUBLIC_URL}/${key}`
      : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

    // For creative sessions (no real project), skip DB persistence
    // The recording data lives in client-side React state
    if (effectiveProjectId === "creative-session") {
      return NextResponse.json({
        success: true,
        recordingId,
        videoUrl,
      });
    }

    // For real projects, verify project exists and persist to DB
    const project = await prisma.project.findUnique({
      where: { id: effectiveProjectId }
    });

    if (!project) {
      // Still return success — video is uploaded to R2
      return NextResponse.json({
        success: true,
        recordingId,
        videoUrl,
      });
    }

    // Create recording in database
    const recording = await prisma.screenRecording.create({
      data: {
        projectId: effectiveProjectId,
        videoUrl,
        duration,
        cursorData: cursorData || "[]",
        zoomPoints: zoomPoints || "[]",
        trimStart: 0,
        trimEnd: 0,
        featureName,
        description: description || "",
        cursorStyle: cursorStyle || "hand-pointing"
      }
    });

    return NextResponse.json({
      success: true,
      recordingId: recording.id,
      videoUrl: recording.videoUrl
    });

  } catch (error) {
    console.error("[API] Failed to save recording:", error);
    return NextResponse.json(
      { error: "Failed to save recording" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/recordings?projectId=xxx
 * Get all recordings for a project
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID required" },
        { status: 400 }
      );
    }

    const recordings = await prisma.screenRecording.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ recordings });

  } catch (error) {
    console.error("[API] Failed to get recordings:", error);
    return NextResponse.json(
      { error: "Failed to get recordings" },
      { status: 500 }
    );
  }
}
