import { readFileSync } from "node:fs";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Minimal R2 (S3 API) helper ported from legacy storage/r2.ts. Env names unchanged:
 * R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ENDPOINT, R2_PUBLIC_URL, R2_FORCE_PATH_STYLE.
 * Env is read per call so tests and long-lived processes see updates.
 */
function env() {
  const accountId = process.env.R2_ACCOUNT_ID;
  return {
    accountId,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET_NAME || "remawt-videos",
    publicUrl: process.env.R2_PUBLIC_URL?.replace(/[%\s/]+$/, ""),
    endpoint: process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : ""),
  };
}

export function isR2Configured(): boolean {
  const e = env();
  return !!(e.accountId && e.accessKeyId && e.secretAccessKey);
}

let cached: { key: string; client: S3Client } | null = null;
function client(): S3Client {
  const e = env();
  if (!isR2Configured()) throw new Error("R2 not configured (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)");
  const key = `${e.endpoint}|${e.accessKeyId}`;
  if (cached?.key === key) return cached.client;
  const c = new S3Client({ region: "auto", endpoint: e.endpoint, forcePathStyle: !!process.env.R2_FORCE_PATH_STYLE, credentials: { accessKeyId: e.accessKeyId!, secretAccessKey: e.secretAccessKey! } });
  cached = { key, client: c };
  return c;
}

export function publicUrl(key: string): string {
  const e = env();
  if (!e.publicUrl) throw new Error("R2_PUBLIC_URL is not set — cannot build a public asset url");
  return `${e.publicUrl}/${key}`;
}

export async function uploadBuffer(body: Buffer | string, key: string, contentType: string): Promise<{ url: string; key: string }> {
  await client().send(new PutObjectCommand({ Bucket: env().bucket, Key: key, Body: body, ContentType: contentType }));
  return { url: publicUrl(key), key };
}

export async function uploadFile(path: string, key: string, contentType: string): Promise<{ url: string; key: string }> {
  return uploadBuffer(readFileSync(path), key, contentType);
}

export async function getJson<T = Record<string, unknown>>(key: string): Promise<T | null> {
  try {
    const res = await client().send(new GetObjectCommand({ Bucket: env().bucket, Key: key }));
    const body = await res.Body?.transformToString();
    return body ? (JSON.parse(body) as T) : null;
  } catch {
    return null;
  }
}

export async function putJson(key: string, value: unknown): Promise<void> {
  await client().send(new PutObjectCommand({ Bucket: env().bucket, Key: key, Body: JSON.stringify(value), ContentType: "application/json" }));
}

export async function deleteKey(key: string): Promise<void> {
  try { await client().send(new DeleteObjectCommand({ Bucket: env().bucket, Key: key })); } catch { /* ignore */ }
}

/** Render status object written by the render Lambda: `status/{jobId}.json`. */
export const statusKey = (jobId: string) => `status/${jobId}.json`;
