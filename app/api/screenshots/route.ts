import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// R2 Configuration
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

/**
 * POST /api/screenshots
 * Upload screenshot image(s) to R2, return ScreenshotData-shaped JSON
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const images = formData.getAll("image") as File[];
    const projectId = (formData.get("projectId") as string) || "creative-session";
    const section = (formData.get("section") as string) || "uploaded";
    const description = (formData.get("description") as string) || "";

    if (!images.length) {
      return NextResponse.json(
        { error: "No image files provided" },
        { status: 400 }
      );
    }

    const client = getR2Client();
    const results = [];

    for (const image of images) {
      if (!image.type.startsWith("image/")) {
        continue;
      }

      const buffer = Buffer.from(await image.arrayBuffer());
      const timestamp = Date.now();
      const safeName = image.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileName = `${timestamp}-${safeName}`;
      const key = `projects/${projectId}/screenshots/${section}/${fileName}`;

      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: image.type,
        Metadata: {
          "uploaded-at": new Date().toISOString(),
          "project-id": projectId,
          section,
        },
      });

      await client.send(command);

      const url = R2_PUBLIC_URL
        ? `${R2_PUBLIC_URL}/${key}`
        : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

      results.push({
        url,
        name: safeName,
        section,
        description: description || safeName,
        path: key,
      });
    }

    if (!results.length) {
      return NextResponse.json(
        { error: "No valid image files found" },
        { status: 400 }
      );
    }

    return NextResponse.json({ screenshots: results });
  } catch (error) {
    console.error("[API] Failed to upload screenshot:", error);
    return NextResponse.json(
      { error: "Failed to upload screenshot" },
      { status: 500 }
    );
  }
}
