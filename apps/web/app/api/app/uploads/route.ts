import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { CreateUploadRequest } from "@remawt/shared";
import { prisma } from "@/lib/db/prisma";
import { isR2Configured, publicUrlForKey } from "@/lib/storage/r2";
import { getViewerOrNull } from "@/lib/queries/viewer";

export const runtime = "nodejs";

const LIMITS = {
  video: { max: 2_000_000_000, types: { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" } },
  audio: {
    max: 200_000_000,
    types: { "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/m4a": "m4a", "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav" },
  },
  image: { max: 20_000_000, types: { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } },
} as const satisfies Record<string, { max: number; types: Record<string, string> }>;

const EXPIRES_SEC = 60 * 60;

function client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
  });
}

/** POST CreateUploadRequest → CreateUploadResponse. Browser then PUTs the file straight to R2 (bucket CORS must allow PUT from the app origin). */
export async function POST(req: NextRequest) {
  const viewer = await getViewerOrNull();
  if (!viewer) return NextResponse.json({ error: "Sign in to upload." }, { status: 401 });
  if (viewer.bypass) return NextResponse.json({ error: "Uploads are off in dev bypass mode." }, { status: 403 });

  const parsed = CreateUploadRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid upload request." }, { status: 400 });
  const { channelId, kind, contentType, sizeBytes } = parsed.data;

  const limit = LIMITS[kind];
  const types: Record<string, string> = limit.types;
  const ext = types[contentType.toLowerCase()];
  if (!ext) return NextResponse.json({ error: `That file type isn’t supported for ${kind} uploads.` }, { status: 415 });
  if (sizeBytes > limit.max) {
    return NextResponse.json({ error: `File is too large. The limit is ${Math.round(limit.max / 1_000_000)} MB.` }, { status: 413 });
  }

  const owned = await prisma.channel.count({ where: { id: channelId, userId: viewer.userId } });
  if (!owned) return NextResponse.json({ error: "Channel not found." }, { status: 404 });

  if (!isR2Configured() || !process.env.R2_PUBLIC_URL) {
    return NextResponse.json({ error: "Storage is not configured on this server." }, { status: 503 });
  }

  const key = `uploads/${viewer.userId}/${channelId}/${randomUUID()}.${ext}`;
  try {
    const uploadUrl = await getSignedUrl(
      client(),
      new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME || "remawt-videos", Key: key, ContentType: contentType, ContentLength: sizeBytes }),
      { expiresIn: EXPIRES_SEC },
    );
    return NextResponse.json({
      uploadUrl,
      publicUrl: publicUrlForKey(key),
      key,
      expiresAt: new Date(Date.now() + EXPIRES_SEC * 1000).toISOString(),
    });
  } catch (e) {
    console.error("[api/app/uploads]", e);
    return NextResponse.json({ error: "Couldn’t prepare the upload. Try again." }, { status: 500 });
  }
}
