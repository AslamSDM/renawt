import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { readFileSync } from "fs";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "remawt-videos";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/[%\s/]+$/, "");
const R2_ENDPOINT =
  process.env.R2_ENDPOINT ||
  (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : "");

function getClient(): S3Client {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 not configured (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)");
  }
  return new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    forcePathStyle: !!process.env.R2_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  });
}

function publicUrl(key: string): string {
  if (!R2_PUBLIC_URL) {
    throw new Error("R2_PUBLIC_URL is not set — cannot build a public asset url");
  }
  return `${R2_PUBLIC_URL}/${key}`;
}

export async function uploadFileToR2(
  filePath: string,
  key: string,
  contentType: string,
): Promise<{ url: string; key: string }> {
  const client = getClient();
  const body = readFileSync(filePath);
  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return { url: publicUrl(key), key };
}

export async function putStatus(
  jobId: string,
  status: object,
): Promise<void> {
  try {
    const client = getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: `status/${jobId}.json`,
        Body: JSON.stringify(status),
        ContentType: "application/json",
      }),
    );
  } catch (err) {
    console.error(`[render-lambda] status write failed for ${jobId}:`, err);
  }
}

export async function deleteStatus(jobId: string): Promise<void> {
  try {
    const client = getClient();
    await client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: `status/${jobId}.json`,
      }),
    );
  } catch {
    // ignore cleanup errors
  }
}

export async function getStatus(
  jobId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const client = getClient();
    const res = await client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: `status/${jobId}.json`,
      }),
    );
    const body = await res.Body?.transformToString();
    return body ? JSON.parse(body) : null;
  } catch {
    return null;
  }
}
