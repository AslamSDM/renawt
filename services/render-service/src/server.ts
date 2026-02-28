/**
 * Render Service - Processes video rendering jobs via BullMQ queue.
 *
 * POST /render  - Submit a render job
 * GET  /render/:jobId/status - Check job status
 * GET  /health  - Health check
 */

import express from "express";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { existsSync, unlinkSync, createReadStream, statSync } from "fs";
import { startWorker, jobStatuses } from "./worker.js";
import type { RenderRequest, RenderJobStatus } from "./types.js";
import { randomUUID } from "crypto";

const app = express();
const PORT = Number(process.env.PORT) || 4002;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const QUEUE_NAME = "render-jobs";

app.use(express.json({ limit: "50mb" }));

// Redis connection for BullMQ queue
const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

const renderQueue = new Queue<RenderRequest>(QUEUE_NAME, {
  connection: connection as any,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: { age: 3600 }, // Keep completed jobs for 1 hour
    removeOnFail: { age: 86400 }, // Keep failed jobs for 24 hours
  },
});

// Start the worker
startWorker();

/**
 * POST /render - Submit a render job
 */
app.post("/render", async (req, res) => {
  const body = req.body as RenderRequest;

  if (!body.remotionCode) {
    return res.status(400).json({ error: "remotionCode is required" });
  }

  if (!body.durationInFrames) {
    return res.status(400).json({ error: "durationInFrames is required" });
  }

  const jobId = body.jobId || randomUUID().slice(0, 12);

  try {
    const job = await renderQueue.add("render", body, {
      jobId: jobId as any,
    });

    // Initialize job status
    const status: RenderJobStatus = {
      jobId: job.id!,
      status: "queued",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    jobStatuses.set(job.id!, status);

    console.log(`[RenderService] Job ${job.id} queued`);

    res.status(202).json({
      jobId: job.id,
      status: "queued",
    });
  } catch (error) {
    console.error("[RenderService] Failed to queue job:", error);
    res.status(500).json({
      error: "Failed to queue render job",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /render/:jobId/status - Check job status and progress
 */
app.get("/render/:jobId/status", async (req, res) => {
  const { jobId } = req.params;

  // Check in-memory status first
  const memStatus = jobStatuses.get(jobId);
  if (memStatus) {
    return res.json(memStatus);
  }

  // Fall back to BullMQ job lookup
  try {
    const job = await renderQueue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const state = await job.getState();
    const progress = job.progress as number;

    const status: RenderJobStatus = {
      jobId,
      status: state === "completed" ? "completed" : state === "failed" ? "failed" : state === "active" ? "rendering" : "queued",
      progress: typeof progress === "number" ? progress / 100 : undefined,
      videoUrl: state === "completed" ? (job.returnvalue as any)?.videoUrl : undefined,
      error: state === "failed" ? job.failedReason : undefined,
      createdAt: new Date(job.timestamp).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get job status",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /render/:jobId/file - Download the rendered video file
 */
app.get("/render/:jobId/file", async (req, res) => {
  const { jobId } = req.params;

  const status = jobStatuses.get(jobId);
  if (!status) {
    return res.status(404).json({ error: "Job not found" });
  }

  if (status.status !== "completed" || !status.localFilePath) {
    return res.status(400).json({ error: "Job not completed or file not available" });
  }

  if (!existsSync(status.localFilePath)) {
    return res.status(410).json({ error: "File no longer exists" });
  }

  try {
    const stat = statSync(status.localFilePath);
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Disposition", `attachment; filename="video-${jobId}.mp4"`);

    const stream = createReadStream(status.localFilePath);
    stream.pipe(res);
  } catch (error) {
    console.error(`[RenderService] File download error for ${jobId}:`, error);
    res.status(500).json({ error: "Failed to read file" });
  }
});

/**
 * DELETE /render/:jobId/cleanup - Delete local file after generate-server has uploaded to R2
 */
app.delete("/render/:jobId/cleanup", async (req, res) => {
  const { jobId } = req.params;

  const status = jobStatuses.get(jobId);
  if (!status) {
    return res.status(404).json({ error: "Job not found" });
  }

  if (status.localFilePath && existsSync(status.localFilePath)) {
    try {
      unlinkSync(status.localFilePath);
      console.log(`[RenderService] Cleaned up file for job ${jobId}`);
    } catch (e) {
      console.warn(`[RenderService] Cleanup warning for ${jobId}:`, e);
    }
  }

  // Remove from in-memory status
  jobStatuses.delete(jobId);

  res.json({ success: true });
});

/**
 * GET /health - Health check
 */
app.get("/health", async (_req, res) => {
  try {
    // Check Redis connection
    await connection.ping();

    const waiting = await renderQueue.getWaitingCount();
    const active = await renderQueue.getActiveCount();

    res.json({
      status: "ok",
      queue: {
        waiting,
        active,
        totalProcessed: jobStatuses.size,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /metrics - Detailed metrics
 */
app.get("/metrics", async (_req, res) => {
  try {
    const waiting = await renderQueue.getWaitingCount();
    const active = await renderQueue.getActiveCount();
    const completed = await renderQueue.getCompletedCount();
    const failed = await renderQueue.getFailedCount();

    res.json({
      queue: { waiting, active, completed, failed },
      inMemoryJobs: jobStatuses.size,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get metrics" });
  }
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[RenderService] Shutting down...");
  await renderQueue.close();
  await connection.quit();
  process.exit(0);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[RenderService] Running on :${PORT}`);
  console.log(`[RenderService] POST /render - Submit render job`);
  console.log(`[RenderService] GET /render/:jobId/status - Check status`);
});
