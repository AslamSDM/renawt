/**
 * Background video processor for cursor replacement and zoom effects.
 * Uses FFmpeg for video decode/encode with Node.js frame-by-frame processing
 * via sharp (no Python CV service dependency for /process).
 */

import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { spawn } from "child_process";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFile } from "fs/promises";
import {
  interpolateCursorPosition,
  getActiveZoom,
  processFrame,
} from "./cursorOverlay";

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

/**
 * Probe video metadata using ffprobe
 */
async function probeVideo(
  videoPath: string
): Promise<{ width: number; height: number; fps: number; totalFrames: number }> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn("ffprobe", [
      "-v", "quiet",
      "-print_format", "json",
      "-show_streams",
      "-show_format",
      videoPath,
    ]);

    let stdout = "";
    let stderr = "";
    ffprobe.stdout.on("data", (d) => (stdout += d));
    ffprobe.stderr.on("data", (d) => (stderr += d));
    ffprobe.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe failed (code ${code}): ${stderr}`));
      }
      try {
        const info = JSON.parse(stdout);
        const videoStream = info.streams?.find(
          (s: any) => s.codec_type === "video"
        );
        if (!videoStream) {
          return reject(new Error("No video stream found"));
        }

        const width = videoStream.width;
        const height = videoStream.height;
        // Parse fps from r_frame_rate (e.g. "30/1")
        const [num, den] = (videoStream.r_frame_rate || "30/1")
          .split("/")
          .map(Number);
        const fps = den ? num / den : 30;
        const totalFrames = videoStream.nb_frames
          ? parseInt(videoStream.nb_frames)
          : Math.round(parseFloat(info.format?.duration || "0") * fps);

        resolve({ width, height, fps, totalFrames });
      } catch (e) {
        reject(new Error(`Failed to parse ffprobe output: ${e}`));
      }
    });
  });
}

/**
 * Process video using FFmpeg decode → Node.js frame processing → FFmpeg encode pipeline.
 * Decodes to raw RGBA frames, processes each frame with cursorOverlay, then re-encodes.
 */
async function processVideoWithFFmpeg(
  inputPath: string,
  outputPath: string,
  cursorData: any[],
  zoomPoints: any[],
  cursorStyle: string,
  onProgress?: (pct: number) => void
): Promise<void> {
  const { width, height, fps, totalFrames } = await probeVideo(inputPath);
  console.log(
    `[VideoProcessor] FFmpeg pipeline: ${width}x${height} @ ${fps}fps, ~${totalFrames} frames`
  );
  console.log(
    `[VideoProcessor] Cursor data: ${cursorData.length} events, Zoom points: ${zoomPoints.length}`
  );

  const frameSize = width * height * 4; // RGBA

  return new Promise((resolve, reject) => {
    // Decoder: FFmpeg → raw RGBA frames piped to stdout
    const decoder = spawn("ffmpeg", [
      "-i", inputPath,
      "-f", "rawvideo",
      "-pix_fmt", "rgba",
      "-v", "quiet",
      "pipe:1",
    ]);

    // Encoder: raw RGBA frames from stdin → H.264 MP4
    const encoder = spawn("ffmpeg", [
      "-y",
      "-f", "rawvideo",
      "-pix_fmt", "rgba",
      "-s", `${width}x${height}`,
      "-r", String(fps),
      "-i", "pipe:0",
      // Re-mux audio from the original file
      "-i", inputPath,
      "-map", "0:v",
      "-map", "1:a?",
      "-c:v", "libx264",
      "-preset", "medium",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "-shortest",
      "-v", "quiet",
      outputPath,
    ]);

    let frameCount = 0;
    let accumulatedBuffer = Buffer.alloc(0);
    let processingError: Error | null = null;

    decoder.stderr.on("data", (d) => {
      const msg = d.toString();
      if (msg.includes("Error")) {
        console.error(`[VideoProcessor] FFmpeg decode error: ${msg}`);
      }
    });

    encoder.stderr.on("data", (d) => {
      const msg = d.toString();
      if (msg.includes("Error")) {
        console.error(`[VideoProcessor] FFmpeg encode error: ${msg}`);
      }
    });

    decoder.stdout.on("data", async (chunk: Buffer) => {
      accumulatedBuffer = Buffer.concat([accumulatedBuffer, chunk]);

      // Process complete frames
      while (accumulatedBuffer.length >= frameSize) {
        // Pause the decoder to apply backpressure while we process
        decoder.stdout.pause();

        const rawFrame = accumulatedBuffer.subarray(0, frameSize);
        accumulatedBuffer = accumulatedBuffer.subarray(frameSize);

        const timeMs = (frameCount / fps) * 1000;
        const timeSec = frameCount / fps;

        try {
          // Interpolate cursor position
          const cursor = interpolateCursorPosition(cursorData, timeMs);

          // Get zoom state
          const zoom = getActiveZoom(zoomPoints, timeSec);

          // Process the frame (blur cursor, overlay, zoom)
          const processedFrame = await processFrame(
            rawFrame,
            width,
            height,
            cursor.x,
            cursor.y,
            cursor.isClick,
            cursorStyle === "hand" ? "hand" : "normal",
            zoom.cx,
            zoom.cy,
            zoom.scale
          );

          // Write processed frame to encoder
          const canWrite = encoder.stdin.write(processedFrame);
          if (!canWrite) {
            await new Promise<void>((r) => encoder.stdin.once("drain", r));
          }
        } catch (err) {
          processingError =
            err instanceof Error ? err : new Error(String(err));
          decoder.kill();
          encoder.stdin.end();
          return;
        }

        frameCount++;
        if (totalFrames > 0 && frameCount % 50 === 0) {
          const pct = Math.round((frameCount / totalFrames) * 100);
          onProgress?.(pct);
          console.log(
            `[VideoProcessor] Progress: ${pct}% (${frameCount}/${totalFrames})`
          );
        }

        // Resume decoder for next chunk
        decoder.stdout.resume();
      }
    });

    decoder.on("close", () => {
      // All frames decoded; signal encoder that input is done
      encoder.stdin.end();
    });

    encoder.on("close", (code) => {
      if (processingError) {
        return reject(processingError);
      }
      if (code !== 0) {
        return reject(
          new Error(`FFmpeg encoder exited with code ${code}`)
        );
      }
      console.log(
        `[VideoProcessor] FFmpeg processing complete: ${frameCount} frames processed`
      );
      resolve();
    });

    decoder.on("error", (err) =>
      reject(new Error(`FFmpeg decoder error: ${err.message}`))
    );
    encoder.on("error", (err) =>
      reject(new Error(`FFmpeg encoder error: ${err.message}`))
    );
  });
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
      console.log(
        `[VideoProcessor] Job ${recordingId} already queued (${existing.status})`
      );
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
    console.log(
      `[VideoProcessor] Queued ${recordingId} (${this.queue.length} total)`
    );

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
        console.error(
          `[VideoProcessor] Failed ${job.recordingId}:`,
          job.error
        );
      }
    }

    this.isProcessing = false;
  }

  private async processJob(job: VideoProcessingJob): Promise<void> {
    const tempVideoPath = join(this.tempDir, `${job.recordingId}_input.mp4`);
    const tempOutputPath = join(
      this.tempDir,
      `${job.recordingId}_processed.mp4`
    );

    try {
      // 1. Download video from R2
      console.log(`[VideoProcessor] Downloading ${job.videoUrl}...`);
      const response = await fetch(job.videoUrl);
      if (!response.ok) {
        throw new Error(
          `Download failed: ${response.status} ${response.statusText}`
        );
      }
      const buffer = await response.arrayBuffer();
      await writeFile(tempVideoPath, Buffer.from(buffer));
      const downloadSize = buffer.byteLength;
      console.log(
        `[VideoProcessor] Downloaded to ${tempVideoPath} (${(downloadSize / 1024 / 1024).toFixed(2)} MB)`
      );
      job.progress = 20;

      // 2. Process video using FFmpeg pipeline (replaces Python CV service)
      console.log(
        `[VideoProcessor] Starting FFmpeg pipeline with cursor_style=${job.cursorStyle}, ${job.cursorData.length} cursor points, ${job.zoomPoints.length} zoom points`
      );
      await processVideoWithFFmpeg(
        tempVideoPath,
        tempOutputPath,
        job.cursorData,
        job.zoomPoints,
        job.cursorStyle,
        (pct) => {
          // Map 0-100 processing progress into 20-70 job progress range
          job.progress = 20 + Math.round(pct * 0.5);
        }
      );
      job.progress = 70;

      // 3. Upload processed video to R2
      const processedBuffer = await readFile(tempOutputPath);
      console.log(
        `[VideoProcessor] Uploading processed video to R2 (${(processedBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)...`
      );
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

      const elapsed = (
        (job.completedAt.getTime() - (job.startedAt?.getTime() || 0)) /
        1000
      ).toFixed(1);
      console.log(
        `[VideoProcessor] Complete: ${processedUrl} (${elapsed}s elapsed)`
      );
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
