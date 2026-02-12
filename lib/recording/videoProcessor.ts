/**
 * Background video processor for cursor replacement and zoom effects.
 * Calls the Python CV service /process endpoint to produce processed videos,
 * then uploads results to R2.
 */

import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFile } from "fs/promises";

const CV_SERVICE_URL = process.env.CV_SERVICE_URL || "http://localhost:8001";
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

interface VideoProcessingJob {
  recordingId: string;
  videoUrl: string;
  cursorData: any[];
  zoomPoints: any[];
  cursorStyle: string;
  projectId: string;
  status: "pending" | "processing" | "complete" | "failed";
  processedVideoUrl?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  progress?: number;
}

class VideoProcessor {
  private queue: VideoProcessingJob[] = [];
  private isProcessing: boolean = false;
  private tempDir: string = join(tmpdir(), "video-processing");

  constructor() {
    this.ensureTempDir();
  }

  private async ensureTempDir(): Promise<void> {
    if (!existsSync(this.tempDir)) {
      await mkdir(this.tempDir, { recursive: true });
    }
  }

  /**
   * Queue a recording for video processing (cursor replacement + zoom)
   */
  async processRecording(
    recordingId: string,
    videoUrl: string,
    cursorData: any[],
    zoomPoints: any[],
    cursorStyle: string,
    projectId: string
  ): Promise<string | undefined> {
    const existing = this.queue.find((j) => j.recordingId === recordingId);
    if (existing) {
      console.log(`[VideoProcessor] Job ${recordingId} already queued (${existing.status})`);
      return existing.processedVideoUrl;
    }

    const job: VideoProcessingJob = {
      recordingId,
      videoUrl,
      cursorData,
      zoomPoints,
      cursorStyle,
      projectId,
      status: "pending",
      progress: 0,
    };

    this.queue.push(job);
    console.log(`[VideoProcessor] Queued ${recordingId} (${this.queue.length} total)`);

    if (!this.isProcessing) {
      await this.runQueue();
    } else {
      // Wait for this job to finish
      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (job.status === "complete" || job.status === "failed") {
            clearInterval(check);
            resolve();
          }
        }, 1000);
      });
    }

    return job.processedVideoUrl;
  }

  private async runQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (true) {
      const job = this.queue.find((j) => j.status === "pending");
      if (!job) break;

      job.status = "processing";
      job.startedAt = new Date();
      job.progress = 5;

      try {
        await this.processJob(job);
      } catch (error) {
        job.status = "failed";
        job.error = error instanceof Error ? error.message : "Unknown error";
        job.completedAt = new Date();
        console.error(`[VideoProcessor] Failed ${job.recordingId}:`, job.error);
      }
    }

    this.isProcessing = false;
  }

  private async processJob(job: VideoProcessingJob): Promise<void> {
    const tempVideoPath = join(this.tempDir, `${job.recordingId}_input.mp4`);
    const tempOutputPath = join(this.tempDir, `${job.recordingId}_processed.mp4`);

    try {
      // 1. Download video from R2
      console.log(`[VideoProcessor] Downloading ${job.videoUrl}...`);
      const response = await fetch(job.videoUrl);
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }
      const buffer = await response.arrayBuffer();
      await writeFile(tempVideoPath, Buffer.from(buffer));
      job.progress = 20;

      // 2. Call Python CV service /process endpoint
      console.log(`[VideoProcessor] Calling CV service /process...`);
      const processResponse = await fetch(`${CV_SERVICE_URL}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_path: tempVideoPath,
          cursor_data: job.cursorData,
          zoom_points: job.zoomPoints,
          cursor_style: job.cursorStyle === "hand" ? "hand" : "normal",
          output_path: tempOutputPath,
        }),
      });

      if (!processResponse.ok) {
        const errText = await processResponse.text();
        throw new Error(`CV service /process failed: ${processResponse.status} - ${errText}`);
      }

      const result = await processResponse.json();
      console.log(`[VideoProcessor] CV processing done: ${result.message}`);
      job.progress = 70;

      // 3. Upload processed video to R2
      console.log(`[VideoProcessor] Uploading processed video to R2...`);
      const processedBuffer = await readFile(tempOutputPath);
      const r2Key = `recordings/${job.projectId}/${job.recordingId}_processed.mp4`;
      const r2Client = getR2Client();

      await r2Client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: r2Key,
          Body: processedBuffer,
          ContentType: "video/mp4",
          Metadata: {
            "recording-id": job.recordingId,
            "processed-at": new Date().toISOString(),
          },
        })
      );

      const processedUrl = R2_PUBLIC_URL
        ? `${R2_PUBLIC_URL}/${r2Key}`
        : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${r2Key}`;

      job.processedVideoUrl = processedUrl;
      job.status = "complete";
      job.completedAt = new Date();
      job.progress = 100;

      console.log(`[VideoProcessor] Complete: ${processedUrl}`);
    } finally {
      // Clean up temp files
      for (const f of [tempVideoPath, tempOutputPath]) {
        try {
          if (existsSync(f)) await unlink(f);
        } catch {}
      }
    }
  }

  /**
   * Get processing status for a recording
   */
  getJobStatus(recordingId: string): VideoProcessingJob | undefined {
    return this.queue.find((j) => j.recordingId === recordingId);
  }

  /**
   * Get processed video URL if available
   */
  getProcessedVideoUrl(recordingId: string): string | undefined {
    const job = this.queue.find(
      (j) => j.recordingId === recordingId && j.status === "complete"
    );
    return job?.processedVideoUrl;
  }
}

// Singleton
export const videoProcessor = new VideoProcessor();
