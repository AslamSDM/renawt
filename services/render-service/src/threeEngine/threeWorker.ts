/**
 * BullMQ worker for the Three.js render engine queue ("three-render-jobs").
 * Concurrency: 1 — each render drives one headless Chromium with WebGL, which
 * is memory/GPU-heavy. Mirrors worker.ts shape but calls renderThreeScene and
 * muxes audio post-render via muxAudioIntoVideo.
 */

import { Worker, Job } from 'bullmq'
import IORedis from 'ioredis'
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { renderThreeScene } from './sceneHost.js'
import { muxAudioIntoVideo } from './muxer.js'
import { jobStatuses } from '../worker.js'
import type { RenderRequest, RenderJobStatus } from '../types.js'
import type { SceneSpec } from './sceneRuntimeSpec.js'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const QUEUE_NAME = 'three-render-jobs'

const OUTPUT_DIR = join(process.cwd(), 'public', 'renders')
const AUDIO_DIR = join(process.cwd(), 'public', 'audio')

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })
if (!existsSync(AUDIO_DIR)) mkdirSync(AUDIO_DIR, { recursive: true })

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null })

function timeoutFor(durationInFrames: number, fps: number): number {
  const seconds = durationInFrames / (fps || 30)
  const videoMinutes = seconds / 60
  return videoMinutes >= 10 ? 30 * 60 * 1000 : 10 * 60 * 1000
}

async function downloadAudio(url: string, dest: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`audio download failed: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(dest, buf)
}

export function startThreeWorker() {
  const worker = new Worker<RenderRequest>(
    QUEUE_NAME,
    async (job: Job<RenderRequest>) => {
      const { remotionCode, durationInFrames, outputFormat, width, height, fps, callbackUrl, assets } = job.data

      console.log(`[ThreeWorker] Processing job ${job.id}...`)

      const status: RenderJobStatus = {
        jobId: job.id!,
        status: 'rendering',
        progress: 0,
        createdAt: new Date(job.timestamp).toISOString(),
        updatedAt: new Date().toISOString(),
      }
      jobStatuses.set(job.id!, status)

      const renderId = randomUUID().slice(0, 8)
      const fmt = outputFormat === 'webm' ? 'webm' : 'mp4'
      const silentPath = join(OUTPUT_DIR, `three-${renderId}-silent.${fmt}`)
      const finalPath = join(OUTPUT_DIR, `three-${renderId}.${fmt}`)

      try {
        let spec: SceneSpec
        try {
          spec = JSON.parse(remotionCode)
        } catch {
          throw new Error('remotionCode is not valid SceneSpec JSON')
        }
        if (!spec || !Array.isArray(spec.objects)) {
          throw new Error('SceneSpec missing objects array')
        }

        const w = width ?? spec.width ?? 1920
        const h = height ?? spec.height ?? 1080
        const f = fps ?? spec.fps ?? 30
        const dur = durationInFrames ?? spec.durationInFrames ?? 0
        const timeoutMs = timeoutFor(dur, f)

        const renderPromise = renderThreeScene(spec, {
          width: w,
          height: h,
          fps: f,
          durationInFrames: dur,
          outputFormat: fmt,
          outputPath: silentPath,
          onProgress: (progress) => {
            status.progress = progress
            status.status = 'rendering'
            status.updatedAt = new Date().toISOString()
            jobStatuses.set(job.id!, { ...status })
            job.updateProgress(Math.round(progress * 100))
          },
        })

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Three render timed out after ${timeoutMs / 60000} min`)), timeoutMs)
        )

        const result = await Promise.race([renderPromise, timeoutPromise])

        if (!result.success) {
          status.status = 'failed'
          status.error = result.error
          status.updatedAt = new Date().toISOString()
          jobStatuses.set(job.id!, { ...status })
          return result
        }

        let localFilePath = result.localFilePath || silentPath

        if (assets?.audioUrls?.[0]) {
          const audioPath = join(AUDIO_DIR, `three-${renderId}-audio.${(assets.audioUrls[0].split('.').pop() || 'mp3').toLowerCase()}`)
          try {
            await downloadAudio(assets.audioUrls[0], audioPath)
            const mux = muxAudioIntoVideo(localFilePath, audioPath, finalPath)
            if (!mux.ok) throw new Error(mux.error || 'audio mux failed')
            try { unlinkSync(audioPath) } catch {}
            try { unlinkSync(localFilePath) } catch {}
            localFilePath = finalPath
          } catch (muxErr) {
            console.warn(`[ThreeWorker] audio mux failed, keeping silent video:`, muxErr)
            try { unlinkSync(audioPath) } catch {}
          }
        }

        status.status = 'completed'
        status.localFilePath = localFilePath
        status.renderTime = result.renderTime
        status.updatedAt = new Date().toISOString()
        jobStatuses.set(job.id!, { ...status })

        if (callbackUrl) {
          try {
            await fetch(callbackUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(status),
              signal: AbortSignal.timeout(10000),
            })
          } catch (err) {
            console.warn(`[ThreeWorker] Callback failed:`, err)
          }
        }

        return { success: true, localFilePath, renderTime: result.renderTime }
      } catch (error) {
        status.status = 'failed'
        status.error = error instanceof Error ? error.message : 'Unknown error'
        status.updatedAt = new Date().toISOString()
        jobStatuses.set(job.id!, { ...status })
        throw error
      }
    },
    { connection: connection as any, concurrency: 1 },
  )

  worker.on('completed', (job) => console.log(`[ThreeWorker] Job ${job.id} completed`))
  worker.on('failed', (job, err) => console.error(`[ThreeWorker] Job ${job?.id} failed:`, err.message))
  worker.on('error', (err) => console.error('[ThreeWorker] Worker error:', err))

  console.log('[ThreeWorker] Three render worker started, listening for jobs...')
  return worker
}