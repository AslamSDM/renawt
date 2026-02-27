import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync } from "fs";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "remawt-videos";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/[%\s/]+$/, "");

export const isR2Configured = (): boolean => {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
};

const getR2Client = (): S3Client => {
  if (!isR2Configured()) {
    throw new Error("R2 not configured");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  });
};

export interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

export async function uploadVideoToR2(
  filePath: string,
  projectId?: string
): Promise<UploadResult> {
  try {
    const client = getR2Client();
    const fileContent = readFileSync(filePath);
    const fileName = filePath.split("/").pop() || `video-${Date.now()}.mp4`;
    const key = projectId
      ? `projects/${projectId}/videos/${fileName}`
      : `videos/${Date.now()}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: fileContent,
      ContentType: "video/mp4",
      Metadata: {
        "uploaded-at": new Date().toISOString(),
        "project-id": projectId || "unknown",
      },
    });

    await client.send(command);

    const publicUrl = R2_PUBLIC_URL
      ? `${R2_PUBLIC_URL}/${key}`
      : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

    console.log(`[R2] Video uploaded: ${key}`);

    return { success: true, url: publicUrl, key };
  } catch (error) {
    console.error("[R2] Upload failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown upload error",
    };
  }
}
