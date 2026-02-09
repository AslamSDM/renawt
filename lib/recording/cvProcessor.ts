/**
 * Background processor for CV cursor detection
 * Queues videos for processing and tracks status
 */

import { detectCursorWithCV, checkCVServiceHealth } from "@/lib/agents/cvCursorBridge";
import { detectZoomPoints } from "@/lib/recording/cursorTracker";
import { writeFile, mkdir, readFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// R2 Configuration for uploading cursor data
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "remawt-videos";

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

interface ProcessingJob {
  recordingId: string;
  videoUrl: string;
  projectId: string;
  status: "pending" | "processing" | "complete" | "failed";
  cursorData?: any[];
  zoomPoints?: any[];
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  progress?: number; // 0-100
}

class CVProcessor {
  private queue: ProcessingJob[] = [];
  private isProcessing: boolean = false;
  private maxConcurrent: number = 2;
  private activeJobs: number = 0;
  private tempDir: string = join(tmpdir(), "cv-processing");

  constructor() {
    // Ensure temp directory exists
    this.ensureTempDir();
  }

  private async ensureTempDir(): Promise<void> {
    if (!existsSync(this.tempDir)) {
      await mkdir(this.tempDir, { recursive: true });
    }
  }

  /**
   * Add a video to the processing queue
   */
  async addJob(
    recordingId: string,
    videoUrl: string,
    projectId: string
  ): Promise<void> {
    // Check if already in queue
    const existing = this.queue.find((j) => j.recordingId === recordingId);
    if (existing) {
      console.log(`[CV Processor] Job ${recordingId} already in queue (${existing.status})`);
      return;
    }

    // Check CV service health first
    const isHealthy = await checkCVServiceHealth();
    if (!isHealthy) {
      console.warn("[CV Processor] CV service not healthy, queuing for later processing");
    }

    const job: ProcessingJob = {
      recordingId,
      videoUrl,
      projectId,
      status: "pending",
    };

    this.queue.push(job);
    console.log(`[CV Processor] Added job ${recordingId} to queue (${this.queue.length} total)`);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    console.log("[CV Processor] Starting queue processing...");

    while (this.queue.length > 0 && this.activeJobs < this.maxConcurrent) {
      const pendingJobs = this.queue.filter(
        (j) => j.status === "pending" && !j.startedAt
      );

      if (pendingJobs.length === 0) break;

      // Process multiple jobs concurrently
      const jobsToProcess = pendingJobs.slice(0, this.maxConcurrent - this.activeJobs);
      
      for (const job of jobsToProcess) {
        this.activeJobs++;
        job.status = "processing";
        job.startedAt = new Date();

        // Process in background (don't await)
        this.processJob(job).finally(() => {
          this.activeJobs--;
        });
      }
    }

    // Wait for all active jobs to complete
    while (this.activeJobs > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    this.isProcessing = false;
    console.log("[CV Processor] Queue processing complete");
  }

  /**
   * Process a single job
   */
  private async processJob(job: ProcessingJob): Promise<void> {
    const tempVideoPath = join(this.tempDir, `${job.recordingId}.mp4`);

    try {
      console.log(`[CV Processor] Processing ${job.recordingId}...`);
      job.progress = 10;

      // Download video from R2
      console.log(`[CV Processor] Downloading video from ${job.videoUrl}...`);
      await this.downloadVideo(job.videoUrl, tempVideoPath);
      job.progress = 30;

      // Run CV detection
      console.log(`[CV Processor] Running CV detection...`);
      const cursorData = await detectCursorWithCV(tempVideoPath);
      job.progress = 70;

      // Detect zoom points
      console.log(`[CV Processor] Detecting zoom points...`);
      const zoomPoints = detectZoomPoints(cursorData);
      job.progress = 90;

      // Save results locally
      const resultPath = join(this.tempDir, `${job.recordingId}_cursor.json`);
      const cursorDataPayload = {
        recordingId: job.recordingId,
        cursorData,
        zoomPoints,
        detectedAt: new Date().toISOString(),
        source: "cv_detection",
      };
      
      await writeFile(
        resultPath,
        JSON.stringify(cursorDataPayload, null, 2)
      );

      // Upload cursor data to R2 alongside the video
      console.log(`[CV Processor] Uploading cursor data to R2...`);
      try {
        const r2Client = getR2Client();
        const cursorKey = `recordings/${job.projectId}/${job.recordingId}_cursor.json`;
        
        const cursorJsonBuffer = Buffer.from(JSON.stringify(cursorDataPayload));
        
        await r2Client.send(
          new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: cursorKey,
            Body: cursorJsonBuffer,
            ContentType: "application/json",
            Metadata: {
              "recording-id": job.recordingId,
              "source": "cv_detection",
              "detected-at": new Date().toISOString(),
            },
          })
        );
        
        const cursorUrl = job.videoUrl.replace(/\/[^\/]+$/, `/${job.recordingId}_cursor.json`);
        console.log(`[CV Processor] ✓ Cursor data uploaded to: ${cursorUrl}`);
        
        // Store the R2 URL with the job
        (job as any).cursorDataUrl = cursorUrl;
      } catch (uploadError) {
        console.warn(`[CV Processor] Failed to upload cursor data to R2:`, uploadError);
        // Continue anyway - local file is still available
      }

      job.cursorData = cursorData;
      job.zoomPoints = zoomPoints;
      job.status = "complete";
      job.completedAt = new Date();
      job.progress = 100;

      console.log(
        `[CV Processor] ✓ Completed ${job.recordingId}: ${cursorData.length} cursors, ${zoomPoints.length} zooms`
      );

      // Clean up temp video
      try {
        await unlink(tempVideoPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : "Unknown error";
      job.completedAt = new Date();
      console.error(`[CV Processor] ✗ Failed ${job.recordingId}:`, job.error);

      // Clean up on failure
      try {
        const { unlink } = await import("fs/promises");
        if (existsSync(tempVideoPath)) {
          await unlink(tempVideoPath);
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Download video from URL to local path
   */
  private async downloadVideo(url: string, destPath: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    await writeFile(destPath, Buffer.from(buffer));
  }

  /**
   * Get job status
   */
  getJobStatus(recordingId: string): ProcessingJob | undefined {
    return this.queue.find((j) => j.recordingId === recordingId);
  }

  /**
   * Get all jobs for a project
   */
  getProjectJobs(projectId: string): ProcessingJob[] {
    return this.queue.filter((j) => j.projectId === projectId);
  }

  /**
   * Get completed cursor data
   */
  getCompletedData(recordingId: string): {
    cursorData: any[];
    zoomPoints: any[];
    source: string;
  } | null {
    const job = this.queue.find(
      (j) => j.recordingId === recordingId && j.status === "complete"
    );
    if (job && job.cursorData && job.zoomPoints) {
      return {
        cursorData: job.cursorData,
        zoomPoints: job.zoomPoints,
        source: "cv_detection",
      };
    }
    return null;
  }

  /**
   * Load cursor data from saved JSON file
   */
  async loadSavedData(recordingId: string): Promise<{
    cursorData: any[];
    zoomPoints: any[];
    source: string;
  } | null> {
    const resultPath = join(this.tempDir, `${recordingId}_cursor.json`);
    if (!existsSync(resultPath)) {
      return null;
    }

    try {
      const { readFile } = await import("fs/promises");
      const data = JSON.parse(await readFile(resultPath, "utf-8"));
      return {
        cursorData: data.cursorData,
        zoomPoints: data.zoomPoints,
        source: data.source || "cv_detection",
      };
    } catch (e) {
      console.error(`[CV Processor] Failed to load saved data for ${recordingId}:`, e);
      return null;
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(recordingId: string): Promise<void> {
    const job = this.queue.find((j) => j.recordingId === recordingId);
    if (job && job.status === "failed") {
      job.status = "pending";
      job.error = undefined;
      job.startedAt = undefined;
      job.completedAt = undefined;
      job.progress = 0;
      console.log(`[CV Processor] Retrying job ${recordingId}`);

      if (!this.isProcessing) {
        this.processQueue();
      }
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    pending: number;
    processing: number;
    complete: number;
    failed: number;
  } {
    return {
      total: this.queue.length,
      pending: this.queue.filter((j) => j.status === "pending").length,
      processing: this.queue.filter((j) => j.status === "processing").length,
      complete: this.queue.filter((j) => j.status === "complete").length,
      failed: this.queue.filter((j) => j.status === "failed").length,
    };
  }
}

// Singleton instance
export const cvProcessor = new CVProcessor();
