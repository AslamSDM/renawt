/**
 * BullMQ worker for processing render jobs.
 * Concurrency: 1 per container (rendering is CPU/memory intensive).
 */

import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { renderVideo } from "./renderEngine.js";
import type { RenderRequest, RenderJobStatus } from "./types.js";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const QUEUE_NAME = "render-jobs";

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Store job statuses in memory (for polling)
export const jobStatuses = new Map<string, RenderJobStatus>();

export function startWorker() {
  const worker = new Worker<RenderRequest>(
    QUEUE_NAME,
    async (job: Job<RenderRequest>) => {
      const { remotionCode, durationInFrames, outputFormat, width, height, fps, projectId, callbackUrl } = job.data;

      console.log(`[Worker] Processing job ${job.id}...`);

      // Update status
      const status: RenderJobStatus = {
        jobId: job.id!,
        status: "rendering",
        progress: 0,
        createdAt: new Date(job.timestamp).toISOString(),
        updatedAt: new Date().toISOString(),
      };
      jobStatuses.set(job.id!, status);

      try {
        const result = await renderVideo({
          remotionCode,
          durationInFrames,
          outputFormat,
          width,
          height,
          fps,
          projectId,
          onProgress: (progress) => {
            status.progress = progress;
            status.status = "rendering";
            status.updatedAt = new Date().toISOString();
            jobStatuses.set(job.id!, { ...status });

            // Update job progress for BullMQ dashboard
            job.updateProgress(Math.round(progress * 100));
          },
        });

        if (result.success) {
          status.status = "completed";
          status.videoUrl = result.videoUrl;
          status.r2Key = result.r2Key;
          status.renderTime = result.renderTime;
        } else {
          status.status = "failed";
          status.error = result.error;
        }

        status.updatedAt = new Date().toISOString();
        jobStatuses.set(job.id!, { ...status });

        // Send callback if configured
        if (callbackUrl) {
          try {
            await fetch(callbackUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(status),
              signal: AbortSignal.timeout(10000),
            });
            console.log(`[Worker] Callback sent to ${callbackUrl}`);
          } catch (err) {
            console.warn(`[Worker] Callback failed:`, err);
          }
        }

        return result;
      } catch (error) {
        status.status = "failed";
        status.error = error instanceof Error ? error.message : "Unknown error";
        status.updatedAt = new Date().toISOString();
        jobStatuses.set(job.id!, { ...status });

        throw error;
      }
    },
    {
      connection: connection as any,
      concurrency: 1, // One render at a time per container
      limiter: {
        max: 1,
        duration: 1000,
      },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[Worker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[Worker] Worker error:", err);
  });

  console.log("[Worker] Render worker started, listening for jobs...");

  return worker;
}

// Cleanup old job statuses (keep for 1 hour)
setInterval(() => {
  const now = Date.now();
  for (const [jobId, status] of jobStatuses) {
    const updatedAt = new Date(status.updatedAt).getTime();
    if (now - updatedAt > 60 * 60 * 1000) {
      jobStatuses.delete(jobId);
    }
  }
}, 60 * 1000);
