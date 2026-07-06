/**
 * Express route registration for the Three.js render engine. Mirrors the
 * existing /render routes under /render-three/... and enqueues jobs on a
 * separate "three-render-jobs" BullMQ queue. The existing /render routes are
 * left untouched.
 */

import { Router } from 'express'
import { Queue } from 'bullmq'
import IORedis from 'ioredis'
import { randomUUID } from 'crypto'
import { existsSync, unlinkSync, createReadStream, statSync } from 'fs'
import { jobStatuses } from '../worker.js'
import type { RenderRequest, RenderJobStatus } from '../types.js'
import type { SceneSpec } from './sceneRuntimeSpec.js'

const QUEUE_NAME = 'three-render-jobs'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const RENDER_SERVICE_URL = process.env.RENDER_SERVICE_URL || `http://localhost:${(process.env.PORT as string) || '4002'}`

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null })

const threeQueue = new Queue<RenderRequest>(QUEUE_NAME, {
  connection: connection as any,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  },
})

function parseSceneSpec(raw: string): SceneSpec | null {
  let parsed: any
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || !Array.isArray(parsed.objects)) return null
  return parsed as SceneSpec
}

/**
 * Register the Three.js render engine routes on the given Express app. Adds
 * POST /render-three and the /render-three/:jobId/{status,file,cleanup} and
 * /render-three/health routes. Does not modify existing /render routes.
 */
export function registerThreeRoutes(app: import('express').Express): void {
  const router = Router()

  router.post('/render-three', async (req, res) => {
    const body = req.body as RenderRequest
    if (!body.remotionCode) {
      return res.status(400).json({ error: 'remotionCode (SceneSpec JSON) is required' })
    }
    if (!body.durationInFrames) {
      return res.status(400).json({ error: 'durationInFrames is required' })
    }
    const spec = parseSceneSpec(body.remotionCode)
    if (!spec) {
      return res.status(400).json({ error: 'remotionCode must be valid SceneSpec JSON with an objects array' })
    }

    const jobId = body.jobId || randomUUID().slice(0, 12)
    try {
      const job = await threeQueue.add('three-render', body, { jobId: jobId as any })
      const status: RenderJobStatus = {
        jobId: job.id!,
        status: 'queued',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      jobStatuses.set(job.id!, status)
      console.log(`[ThreeService] Job ${job.id} queued`)
      res.status(202).json({ jobId: job.id, status: 'queued' })
    } catch (error) {
      console.error('[ThreeService] Failed to queue job:', error)
      res.status(500).json({
        error: 'Failed to queue three render job',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  router.get('/render-three/:jobId/status', async (req, res) => {
    const { jobId } = req.params
    const memStatus = jobStatuses.get(jobId)
    if (memStatus) {
      if (memStatus.status === 'completed' && !memStatus.videoUrl) {
        memStatus.videoUrl = `${RENDER_SERVICE_URL}/render-three/${jobId}/file`
      }
      return res.json(memStatus)
    }
    try {
      const job = await threeQueue.getJob(jobId)
      if (!job) return res.status(404).json({ error: 'Job not found' })
      const state = await job.getState()
      const progress = job.progress as number
      const status: RenderJobStatus = {
        jobId,
        status: state === 'completed' ? 'completed' : state === 'failed' ? 'failed' : state === 'active' ? 'rendering' : 'queued',
        progress: typeof progress === 'number' ? progress / 100 : undefined,
        videoUrl: state === 'completed' ? `${RENDER_SERVICE_URL}/render-three/${jobId}/file` : undefined,
        error: state === 'failed' ? job.failedReason : undefined,
        createdAt: new Date(job.timestamp).toISOString(),
        updatedAt: new Date().toISOString(),
      }
      res.json(status)
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get job status',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  router.get('/render-three/:jobId/file', async (req, res) => {
    const { jobId } = req.params
    const status = jobStatuses.get(jobId)
    if (!status) return res.status(404).json({ error: 'Job not found' })
    if (status.status !== 'completed' || !status.localFilePath) {
      return res.status(400).json({ error: 'Job not completed or file not available' })
    }
    if (!existsSync(status.localFilePath)) {
      return res.status(410).json({ error: 'File no longer exists' })
    }
    try {
      const stat = statSync(status.localFilePath)
      res.setHeader('Content-Type', 'video/mp4')
      res.setHeader('Content-Length', stat.size)
      res.setHeader('Content-Disposition', `attachment; filename="three-${jobId}.mp4"`)
      const stream = createReadStream(status.localFilePath)
      stream.pipe(res)
    } catch (error) {
      console.error(`[ThreeService] File download error for ${jobId}:`, error)
      res.status(500).json({ error: 'Failed to read file' })
    }
  })

  router.delete('/render-three/:jobId/cleanup', async (req, res) => {
    const { jobId } = req.params
    const status = jobStatuses.get(jobId)
    if (!status) return res.status(404).json({ error: 'Job not found' })
    if (status.localFilePath && existsSync(status.localFilePath)) {
      try { unlinkSync(status.localFilePath) } catch (e) { console.warn(`[ThreeService] Cleanup warning for ${jobId}:`, e) }
    }
    jobStatuses.delete(jobId)
    res.json({ success: true })
  })

  router.get('/render-three/health', async (_req, res) => {
    try {
      await connection.ping()
      const waiting = await threeQueue.getWaitingCount()
      const active = await threeQueue.getActiveCount()
      res.json({ status: 'ok', queue: { waiting, active } })
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  app.use(router)
}