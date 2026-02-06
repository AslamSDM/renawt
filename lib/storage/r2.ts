/**
 * Cloudflare R2 Storage Integration (Frontend)
 * 
 * Client-side utilities for interacting with R2 storage
 */

import { S3Client, PutObjectCommand, ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";

// R2 Configuration from env
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "remawt-videos";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

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
          
          const url = R2_PUBLIC_URL 
            ? `${R2_PUBLIC_URL}/${key}`
            : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
          
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

    const url = R2_PUBLIC_URL 
      ? `${R2_PUBLIC_URL}/${key}`
      : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

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
