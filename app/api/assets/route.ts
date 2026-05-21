import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@/auth";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "remawt-videos";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/[%\s/]+$/, "");

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

const VALID_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/svg+xml",
  "image/webp",
];

/**
 * POST /api/assets
 * Upload image assets (logos, SVGs, PNGs) to R2
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
    const uploaded: { url: string; key: string; name: string }[] = [];

    for (const file of files) {
      if (!VALID_IMAGE_TYPES.includes(file.type)) {
        return NextResponse.json(
          {
            error: `Invalid file type: ${file.name}. Supported: PNG, JPG, SVG, WebP`,
          },
          { status: 400 },
        );
      }

      // Max 10MB per image
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: `File too large: ${file.name}. Maximum 10MB per image.` },
          { status: 400 },
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.name.split(".").pop() || "png";
      const assetId = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const fileName = `${assetId}.${ext}`;
      const key = `assets/${session.user.id}/${fileName}`;

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

      const publicUrl = R2_PUBLIC_URL
        ? `${R2_PUBLIC_URL}/${key}`
        : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

      uploaded.push({ url: publicUrl, key, name: file.name });
    }

    return NextResponse.json({ assets: uploaded });
  } catch (error) {
    console.error("[Assets Upload] Error:", error);
    return NextResponse.json(
      { error: "Failed to upload assets" },
      { status: 500 },
    );
  }
}
