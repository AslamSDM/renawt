import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@/auth";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "remawt-videos";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/[%\s/]+$/, "");

const getR2Client = (): S3Client => {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error(
      "R2 not configured (missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)",
    );
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
};

const VALID_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/svg+xml",
  "image/webp",
];

const VALID_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
];

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB — screen recordings can be big

/**
 * POST /api/assets
 * Upload image/video assets (logos, screenshots, screen recordings) to R2.
 *
 * Each returned asset: { url, key, name, kind: "image" | "video" }.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 },
      );
    }

    if (files.length > 10) {
      return NextResponse.json(
        { error: "Maximum 10 files per upload" },
        { status: 400 },
      );
    }

    const client = getR2Client();
    const uploaded: {
      url: string;
      key: string;
      name: string;
      kind: "image" | "video";
    }[] = [];

    for (const file of files) {
      const isImage = VALID_IMAGE_TYPES.includes(file.type);
      const isVideo = VALID_VIDEO_TYPES.includes(file.type);
      if (!isImage && !isVideo) {
        return NextResponse.json(
          {
            error: `Invalid file type: ${file.name}. Supported: PNG, JPG, SVG, WebP, MP4, WebM, MOV`,
          },
          { status: 400 },
        );
      }

      const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (file.size > maxBytes) {
        const limit = isVideo ? "200MB" : "10MB";
        return NextResponse.json(
          { error: `File too large: ${file.name}. Maximum ${limit}.` },
          { status: 400 },
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const ext =
        file.name.split(".").pop() || (isVideo ? "mp4" : "png");
      const assetId = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const fileName = `${assetId}.${ext}`;
      const subdir = isVideo ? "videos" : "images";
      const key = `assets/${session.user.id}/${subdir}/${fileName}`;

      await client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: file.type,
          Metadata: {
            "uploaded-at": new Date().toISOString(),
            "user-id": session.user.id,
            "original-name": file.name,
          },
        }),
      );

      // Only ever persist the PUBLIC domain url. The S3 endpoint
      // (`<bucket>.<account>.r2.cloudflarestorage.com`) is ORB-blocked in the
      // browser/Remotion renderer, so a private url stored here renders as a
      // blank image downstream. Fail loudly instead.
      if (!R2_PUBLIC_URL) {
        throw new Error(
          "R2_PUBLIC_URL is not set — refusing to store a private (ORB-blocked) asset url. Set R2_PUBLIC_URL to the bucket's public r2.dev/custom domain.",
        );
      }
      const publicUrl = `${R2_PUBLIC_URL}/${key}`;

      uploaded.push({
        url: publicUrl,
        key,
        name: file.name,
        kind: isVideo ? "video" : "image",
      });
    }

    return NextResponse.json({ assets: uploaded });
  } catch (error) {
    console.error("[Assets Upload] Error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to upload assets: ${msg}` },
      { status: 500 },
    );
  }
}
