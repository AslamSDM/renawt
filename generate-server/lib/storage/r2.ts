/**
 * Cloudflare R2 Storage Integration
 * 
 * R2 is S3-compatible, so we use the AWS SDK with R2 endpoint
 */

import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { readFileSync } from "fs";
import { randomUUID } from "crypto";

// R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "remawt-videos";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // Custom domain or public R2 URL

// Check if R2 is configured
export const isR2Configured = (): boolean => {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
};

// Initialize S3 client for R2
const getR2Client = (): S3Client => {
  if (!isR2Configured()) {
    throw new Error("R2 not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY env vars.");
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

export interface AudioFile {
  key: string;
  name: string;
  url: string;
  bpm?: number;
  duration?: number;
}

/**
 * Upload a video file to R2
 */
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
      : `videos/${randomUUID()}/${fileName}`;

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

    // Build public URL
    const publicUrl = R2_PUBLIC_URL 
      ? `${R2_PUBLIC_URL}/${key}`
      : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

    console.log(`[R2] Video uploaded successfully: ${key}`);
    
    return {
      success: true,
      url: publicUrl,
      key,
    };
  } catch (error) {
    console.error("[R2] Upload failed:", error);
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

    const publicUrl = R2_PUBLIC_URL 
      ? `${R2_PUBLIC_URL}/${key}`
      : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

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
          const name = key.split("/").pop() || key;
          
          // Try to get metadata
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
            name: name.replace(".mp3", ""),
            url,
            bpm,
            duration,
          });
        }
      }
    }

    console.log(`[R2] Found ${audioFiles.length} audio files`);
    return audioFiles;
  } catch (error) {
    console.error("[R2] Failed to list audio files:", error);
    return [];
  }
}

/**
 * Get a presigned URL for an audio file (for temporary access)
 */
export async function getAudioPresignedUrl(key: string, expiresIn: number = 3600): Promise<string | null> {
  try {
    const client = getR2Client();
    
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error("[R2] Failed to get presigned URL:", error);
    return null;
  }
}

/**
 * Download audio file from R2 to local storage
 */
export async function downloadAudioFromR2(
  key: string,
  localPath: string
): Promise<boolean> {
  try {
    const client = getR2Client();
    const { writeFileSync } = await import("fs");
    
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const response = await client.send(command);
    
    if (response.Body) {
      const chunks: Buffer[] = [];
      // @ts-ignore - Body is a stream
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      writeFileSync(localPath, buffer);
      console.log(`[R2] Audio downloaded: ${key} -> ${localPath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("[R2] Failed to download audio:", error);
    return false;
  }
}

/**
 * Get the default audio file from R2
 */
export async function getDefaultAudio(): Promise<AudioFile | null> {
  try {
    const audioFiles = await listAudioFiles();
    
    if (audioFiles.length === 0) {
      console.warn("[R2] No audio files found in R2");
      return null;
    }
    
    // Return first audio file or look for a default one
    const defaultAudio = audioFiles.find(a => 
      a.name.toLowerCase().includes("default") || 
      a.name.toLowerCase().includes("audio1")
    );
    
    return defaultAudio || audioFiles[0];
  } catch (error) {
    console.error("[R2] Failed to get default audio:", error);
    return null;
  }
}
