/**
 * Cloudflare R2 Storage Integration (Frontend)
 * 
 * Client-side utilities for interacting with R2 storage
 */

import { S3Client, PutObjectCommand, ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync } from "fs";
import { randomUUID } from "crypto";

// R2 Configuration from env
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "remawt-videos";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/[%\s/]+$/, '');

export const isR2Configured = (): boolean => {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
};

/**
 * Build a PUBLIC url for an object key. R2_PUBLIC_URL must point at the bucket's
 * public domain (the `pub-*.r2.dev` url or a bound custom domain). The S3 API
 * endpoint (`<bucket>.<account>.r2.cloudflarestorage.com`) is NOT public — it
 * returns `Authorization` to anonymous GETs — so we refuse to mint that url.
 * Throwing here fails the upload loudly instead of persisting a dead url that
 * renders as a blank image/logo downstream.
 */
export function publicUrlForKey(key: string): string {
  if (!R2_PUBLIC_URL) {
    throw new Error(
      "R2_PUBLIC_URL is not set — cannot build a public asset url. Set it to the bucket's public r2.dev/custom domain.",
    );
  }
  return `${R2_PUBLIC_URL}/${key}`;
}

/**
 * Rewrite a private R2 S3-endpoint url (`<bucket>.<account>.r2.cloudflarestorage.com/<key>`)
 * into the public domain url. Anonymous GETs to the S3 endpoint are blocked by
 * the browser (ORB / `net::ERR_BLOCKED_BY_ORB`), so any such url stored on a
 * doc renders as a blank image. This heals already-persisted bad urls at read
 * time. Non-private urls (and anything we can't parse) pass through unchanged.
 */
export function toPublicR2Url<T extends string | null | undefined>(url: T): T {
  if (!url || typeof url !== "string") return url;
  const m = url.match(/^https?:\/\/[^/]*\.r2\.cloudflarestorage\.com\/(.+)$/);
  if (!m) return url;
  if (!R2_PUBLIC_URL) return url; // can't rewrite without a public domain
  return `${R2_PUBLIC_URL}/${m[1]}` as T;
}

/**
 * Deep-walk any object/array and rewrite every private R2 url string in place
 * to its public form. Used to heal a stored JitterDoc before it reaches the
 * browser <Player> (which ORB-blocks the private S3 endpoint).
 */
export function sanitizeR2UrlsDeep<T>(value: T): T {
  if (typeof value === "string") return toPublicR2Url(value) as T;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = sanitizeR2UrlsDeep(value[i]);
    return value;
  }
  if (value && typeof value === "object") {
    for (const k of Object.keys(value as Record<string, unknown>)) {
      (value as Record<string, unknown>)[k] = sanitizeR2UrlsDeep(
        (value as Record<string, unknown>)[k],
      );
    }
    return value;
  }
  return value;
}

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

export interface AudioFile {
  key: string;
  name: string;
  url: string;
  bpm?: number;
  duration?: number;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

/**
 * Get a list of available audio files from R2
 */
export async function listAudioFiles(): Promise<AudioFile[]> {
  try {
    const client = getR2Client();
    
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: "audio/",
    });

    const response = await client.send(command);
    const audioFiles: AudioFile[] = [];

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key && obj.Key.endsWith(".mp3")) {
          const key = obj.Key;
          const name = key.split("/").pop()?.replace(".mp3", "") || key;
          
          let bpm: number | undefined;
          let duration: number | undefined;
          
          try {
            const headCommand = new HeadObjectCommand({
              Bucket: R2_BUCKET_NAME,
              Key: key,
            });
            const headResponse = await client.send(headCommand);
            
            if (headResponse.Metadata) {
              bpm = headResponse.Metadata["bpm"] ? parseInt(headResponse.Metadata["bpm"]) : undefined;
              duration = headResponse.Metadata["duration"] ? parseInt(headResponse.Metadata["duration"]) : undefined;
            }
          } catch (e) {
            // Metadata might not exist
          }
          
          const url = publicUrlForKey(key);
          
          audioFiles.push({
            key,
            name,
            url,
            bpm,
            duration,
          });
        }
      }
    }

    return audioFiles;
  } catch (error) {
    console.error("[R2] Failed to list audio files:", error);
    return [];
  }
}

/**
 * Upload a video buffer to R2 (for render-service proxy)
 */
export async function uploadVideoBufferToR2(
  buffer: Buffer,
  fileName: string,
  projectId?: string
): Promise<UploadResult> {
  try {
    const client = getR2Client();
    const key = projectId
      ? `projects/${projectId}/videos/${fileName}`
      : `videos/${randomUUID()}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: "video/mp4",
      Metadata: {
        "uploaded-at": new Date().toISOString(),
        "project-id": projectId || "unknown",
      },
    });

    await client.send(command);

    const publicUrl = publicUrlForKey(key);

    console.log(`[R2] Video buffer uploaded: ${key}`);

    return {
      success: true,
      url: publicUrl,
      key,
    };
  } catch (error) {
    console.error("[R2] Video buffer upload failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown upload error",
    };
  }
}

/**
 * Upload audio file to R2
 */
export async function uploadAudioToR2(
  file: File,
  metadata?: { bpm?: number; duration?: number }
): Promise<UploadResult> {
  try {
    const client = getR2Client();
    const key = `audio/${file.name}`;
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: "audio/mpeg",
      Metadata: {
        "uploaded-at": new Date().toISOString(),
        ...(metadata?.bpm && { "bpm": metadata.bpm.toString() }),
        ...(metadata?.duration && { "duration": metadata.duration.toString() }),
      },
    });

    await client.send(command);

    const url = publicUrlForKey(key);

    return {
      success: true,
      url,
      key,
    };
  } catch (error) {
    console.error("[R2] Audio upload failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown upload error",
    };
  }
}

/**
 * Upload screenshot buffer to R2 (for scraper use)
 */
export async function uploadScreenshotBufferToR2(
  buffer: Buffer,
  fileName: string,
  section: string
): Promise<UploadResult> {
  try {
    const client = getR2Client();
    const key = `screenshots/${section}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: "image/png",
      Metadata: {
        "uploaded-at": new Date().toISOString(),
        "section": section,
      },
    });

    await client.send(command);

    const publicUrl = publicUrlForKey(key);

    console.log(`[R2] Screenshot uploaded: ${key}`);

    return {
      success: true,
      url: publicUrl,
      key,
    };
  } catch (error) {
    console.error("[R2] Screenshot buffer upload failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown upload error",
    };
  }
}

/**
 * Upload screenshot to R2 for persistence
 */
export async function uploadScreenshotToR2(
  filePath: string,
  projectId: string,
  section: string
): Promise<UploadResult> {
  try {
    const client = getR2Client();
    const fileContent = readFileSync(filePath);
    const fileName = filePath.split("/").pop() || `screenshot-${Date.now()}.png`;
    const key = `projects/${projectId}/screenshots/${section}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: fileContent,
      ContentType: "image/png",
      Metadata: {
        "uploaded-at": new Date().toISOString(),
        "project-id": projectId,
        "section": section,
      },
    });

    await client.send(command);

    const publicUrl = publicUrlForKey(key);

    console.log(`[R2] Screenshot uploaded: ${key}`);

    return {
      success: true,
      url: publicUrl,
      key,
    };
  } catch (error) {
    console.error("[R2] Screenshot upload failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown upload error",
    };
  }
}
