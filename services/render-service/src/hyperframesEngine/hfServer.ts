import { Router } from "express"
import { Queue } from "bullmq"
import IORedis from "ioredis"
import { randomUUID } from "crypto"
import { existsSync, unlinkSync, createReadStream, statSync } from "fs"
import { jobStatuses } from "../worker.js"
import type { RenderRequest, RenderJobStatus } from "../types.js"

const QUEUE_NAME = "hf-render-jobs"

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"
const RENDER_SERVICE_URL =
  process.env.RENDER_SERVICE_URL ||
  `http://localhost:${(process.env.PORT as string) || "4002"}`

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null })

const hfQueue = new Queue<RenderRequest>(QUEUE_NAME, {
  connection: connection as any,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  },
})

export function registerHfRoutes(app: import("express").Express): void {
  const router = Router()

  router.post("/render-hf", async (req, res) => {
    const body = req.body as Record<string, unknown>
    const hasInlineHtml = typeof body.compositionHtml === "string" && (body.compositionHtml as string).length > 0
    const hasProjectFiles =
      typeof body.projectFiles === "object" &&
      body.projectFiles !== null &&
      Object.keys(body.projectFiles as Record<string, unknown>).length > 0
    if (!hasInlineHtml && !hasProjectFiles) {
      return res.status(400).json({ error: "compositionHtml or projectFiles is required" })
    }
    if (!body.durationInFrames) {
      return res.status(400).json({ error: "durationInFrames is required" })
    }

    const jobData: RenderRequest = {
      remotionCode: hasInlineHtml ? (body.compositionHtml as string) : "",
      projectFiles: hasProjectFiles ? (body.projectFiles as Record<string, string>) : undefined,
      durationInFrames: body.durationInFrames as number,
      width: (body.width as number) || 1920,
      height: (body.height as number) || 1080,
      fps: (body.fps as number) || 30,
      outputFormat: (body.format as "mp4" | "webm") || "mp4",
      jobId: body.jobId as string | undefined,
      projectId: body.projectId as string | undefined,
      callbackUrl: body.callbackUrl as string | undefined,
      assets: body.assets as { audioUrls?: string[]; imageUrls?: string[] } | undefined,
    }

    const jobId = body.jobId || randomUUID().slice(0, 12)

    try {
      const job = await hfQueue.add("hf-render", jobData, { jobId: jobId as any })
      const status: RenderJobStatus = {
        jobId: job.id!,
        status: "queued",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      jobStatuses.set(job.id!, status)
      console.log(`[HfService] Job ${job.id} queued`)
      res.status(202).json({ jobId: job.id, status: "queued" })
    } catch (error) {
      console.error("[HfService] Failed to queue job:", error)
      res.status(500).json({
        error: "Failed to queue HyperFrames render job",
        details: error instanceof Error ? error.message : "Unknown error",
      })
    }
  })

  router.get("/render-hf/:jobId/status", async (req, res) => {
    const { jobId } = req.params
    const memStatus = jobStatuses.get(jobId)
    if (memStatus) {
      if (memStatus.status === "completed" && !memStatus.videoUrl) {
        memStatus.videoUrl = `${RENDER_SERVICE_URL}/render-hf/${jobId}/file`
      }
      return res.json(memStatus)
    }
    try {
      const job = await hfQueue.getJob(jobId)
      if (!job) return res.status(404).json({ error: "Job not found" })
      const state = await job.getState()
      const progress = job.progress as number
      const status: RenderJobStatus = {
        jobId,
        status:
          state === "completed"
            ? "completed"
            : state === "failed"
              ? "failed"
              : state === "active"
                ? "rendering"
                : "queued",
        progress: typeof progress === "number" ? progress / 100 : undefined,
        videoUrl:
          state === "completed"
            ? `${RENDER_SERVICE_URL}/render-hf/${jobId}/file`
            : undefined,
        error: state === "failed" ? job.failedReason : undefined,
        createdAt: new Date(job.timestamp).toISOString(),
        updatedAt: new Date().toISOString(),
      }
      res.json(status)
    } catch (error) {
      res.status(500).json({
        error: "Failed to get job status",
        details: error instanceof Error ? error.message : "Unknown error",
      })
    }
  })

  router.get("/render-hf/:jobId/file", async (req, res) => {
    const { jobId } = req.params
    const status = jobStatuses.get(jobId)
    if (!status) return res.status(404).json({ error: "Job not found" })
    if (status.status !== "completed" || !status.localFilePath) {
      return res
        .status(400)
        .json({ error: "Job not completed or file not available" })
    }
    if (!existsSync(status.localFilePath)) {
      return res.status(410).json({ error: "File no longer exists" })
    }
    try {
      const stat = statSync(status.localFilePath)
      res.setHeader("Content-Type", "video/mp4")
      res.setHeader("Content-Length", stat.size)
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="hf-${jobId}.mp4"`,
      )
      const stream = createReadStream(status.localFilePath)
      stream.pipe(res)
    } catch (error) {
      console.error(`[HfService] File download error for ${jobId}:`, error)
      res.status(500).json({ error: "Failed to read file" })
    }
  })

  router.delete("/render-hf/:jobId/cleanup", async (req, res) => {
    const { jobId } = req.params
    const status = jobStatuses.get(jobId)
    if (!status) return res.status(404).json({ error: "Job not found" })
    if (status.localFilePath && existsSync(status.localFilePath)) {
      try {
        unlinkSync(status.localFilePath)
      } catch (e) {
        console.warn(`[HfService] Cleanup warning for ${jobId}:`, e)
      }
    }
    jobStatuses.delete(jobId)
    res.json({ success: true })
  })

  router.get("/render-hf/health", async (_req, res) => {
    try {
      await connection.ping()
      const waiting = await hfQueue.getWaitingCount()
      const active = await hfQueue.getActiveCount()
      res.json({ status: "ok", queue: { waiting, active } })
    } catch (error) {
      res.status(503).json({
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  })

  app.use(router)
}

export { hfQueue, QUEUE_NAME as hfQueueName }
