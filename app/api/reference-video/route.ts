import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@/auth";

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
 * POST /api/reference-video
 * Upload a reference video to R2 and return its public URL
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const formData = await request.formData();
    const video = formData.get("video") as File;

    if (!video) {
      return NextResponse.json({ error: "No video file provided" }, { status: 400 });
    }

    // Validate file type
    const validTypes = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"];
    if (!validTypes.includes(video.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Supported: MP4, WebM, MOV, AVI" },
        { status: 400 },
      );
    }

    // Max 100MB
    if (video.size > 100 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 100MB." },
        { status: 400 },
      );
    }

    const client = getR2Client();
    const videoBuffer = Buffer.from(await video.arrayBuffer());
    const ext = video.name.split(".").pop() || "mp4";
    const refId = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const fileName = `reference-${refId}.${ext}`;
    const key = `reference-videos/${session.user.id}/${fileName}`;

    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: videoBuffer,
        ContentType: video.type,
        Metadata: {
          "uploaded-at": new Date().toISOString(),
          "user-id": session.user.id,
        },
      }),
    );

    const publicUrl = R2_PUBLIC_URL
      ? `${R2_PUBLIC_URL}/${key}`
      : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

    return NextResponse.json({
      url: publicUrl,
      key,
      fileName,
    });
  } catch (error) {
    console.error("[ReferenceVideo Upload] Error:", error);
    return NextResponse.json(
      { error: "Failed to upload reference video" },
      { status: 500 },
    );
  }
}
