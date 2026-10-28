/** Cloudflare R2 (S3-compatible). Ported from legacy generate-server/lib/storage/r2.ts, trimmed to what v2 needs. */
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { has } from "./env.js";

const BUCKET = () => process.env.R2_BUCKET_NAME || "remawt-videos";
const PUBLIC = () => process.env.R2_PUBLIC_URL?.replace(/[%\s/]+$/, "");
const ENDPOINT = () => process.env.R2_ENDPOINT || (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : "");

let client: S3Client | null = null;
function s3(): S3Client {
  if (!has.r2()) throw new Error("R2 not configured (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)");
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: ENDPOINT(),
      forcePathStyle: !!process.env.R2_FORCE_PATH_STYLE,
      credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
    });
  }
  return client;
}

export function publicUrl(key: string): string {
  const pub = PUBLIC();
  return pub ? `${pub}/${key}` : `https://${BUCKET()}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
}

export async function putObject(key: string, body: Buffer | Uint8Array | string, contentType: string, metadata?: Record<string, string>): Promise<string> {
  await s3().send(new PutObjectCommand({ Bucket: BUCKET(), Key: key, Body: body, ContentType: contentType, Metadata: { "uploaded-at": new Date().toISOString(), ...metadata } }));
  return publicUrl(key);
}

/** Returns the public URL if the object exists (idempotency check before paying again), else null. */
export async function existingObject(key: string): Promise<{ url: string; metadata: Record<string, string> } | null> {
  if (!has.r2()) return null;
  try {
    const head = await s3().send(new HeadObjectCommand({ Bucket: BUCKET(), Key: key }));
    return { url: publicUrl(key), metadata: head.Metadata ?? {} };
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === "NotFound" || name === "NoSuchKey" || (e as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode === 404) return null;
    throw e;
  }
}

export async function getObjectText(key: string): Promise<string | null> {
  if (!has.r2()) return null;
  try {
    const res = await s3().send(new GetObjectCommand({ Bucket: BUCKET(), Key: key }));
    return (await res.Body?.transformToString("utf-8")) ?? null;
  } catch (e) {
    if ((e as { name?: string })?.name === "NoSuchKey") return null;
    throw e;
  }
}

/** Download any URL into a Buffer. */
export async function fetchBuffer(url: string, init?: RequestInit): Promise<Buffer> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
