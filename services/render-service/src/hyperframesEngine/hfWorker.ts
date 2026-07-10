import { spawnSync } from "child_process"
import { Worker, Job } from "bullmq"
import IORedis from "ioredis"
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs"
import { join } from "path"
import { randomUUID } from "crypto"
import { renderHf, type HfRenderInput } from "./hfEngine.js"
import { muxAudioIntoVideo } from "../threeEngine/muxer.js"
import { jobStatuses } from "../worker.js"
import type { RenderRequest, RenderJobStatus } from "../types.js"

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"
const QUEUE_NAME = "hf-render-jobs"

const OUTPUT_DIR = join(process.cwd(), "public", "renders")
const AUDIO_DIR = join(process.cwd(), "public", "audio")

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
  if (!res.ok || !res.body)
    throw new Error(`audio download failed: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(dest, buf)
}

export function startHfWorker() {
  const worker = new Worker<RenderRequest>(
    QUEUE_NAME,
    async (job: Job<RenderRequest>) => {
      const {
        remotionCode,
        durationInFrames,
        outputFormat,
        width,
        height,
        fps,
        callbackUrl,
        assets,
      } = job.data

      console.log(`[HfWorker] Processing job ${job.id}...`)

      const status: RenderJobStatus = {
        jobId: job.id!,
        status: "rendering",
        progress: 0,
        createdAt: new Date(job.timestamp).toISOString(),
        updatedAt: new Date().toISOString(),
      }
      jobStatuses.set(job.id!, status)

      const renderId = randomUUID().slice(0, 8)
      const fmt = outputFormat === "webm" ? "webm" : "mp4"
      const silentPath = join(OUTPUT_DIR, `hf-${renderId}-silent.${fmt}`)
      const finalPath = join(OUTPUT_DIR, `hf-${renderId}.${fmt}`)

      try {
        const w = width ?? 1920
        const h = height ?? 1080
        const f = fps ?? 30
        const dur = durationInFrames ?? 0
        const timeoutMs = timeoutFor(dur, f)
        const quality = (job.data as any).quality || "standard"

        const renderPromise = renderHf(
          {
            compositionHtml: remotionCode,
            projectFiles: job.data.projectFiles,
            width: w,
            height: h,
            fps: f,
            durationInFrames: dur,
            quality,
            outputFormat: fmt,
            outputPath: silentPath,
          },
          (_job: unknown, _message: string) => {
            status.status = "rendering"
            status.updatedAt = new Date().toISOString()
            jobStatuses.set(job.id!, { ...status })
            job.updateProgress(50)
          },
        )

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(`HF render timed out after ${timeoutMs / 60000} min`),
              ),
            timeoutMs,
          ),
        )

        const result = await Promise.race([renderPromise, timeoutPromise])

        if (!result.success) {
          status.status = "failed"
          status.error = result.error
          status.updatedAt = new Date().toISOString()
          jobStatuses.set(job.id!, { ...status })
          return result
        }

        let localFilePath = result.localFilePath || silentPath

        if (assets?.audioUrls?.length) {
          const mixedAudioPath = join(AUDIO_DIR, `hf-${renderId}-mixed.mp3`)
          try {
            if (assets.audioUrls.length === 1) {
              const audioPath = join(
                AUDIO_DIR,
                `hf-${renderId}-audio.${(assets.audioUrls[0].split(".").pop() || "mp3").toLowerCase()}`,
              )
              await downloadAudio(assets.audioUrls[0], audioPath)
              const mux = muxAudioIntoVideo(localFilePath, audioPath, finalPath)
              if (!mux.ok) throw new Error(mux.error || "audio mux failed")
              try { unlinkSync(audioPath) } catch {}
            } else {
              // Multiple audio sources: download all, mix with ffmpeg, then mux
              const audioPaths: string[] = []
              for (let i = 0; i < assets.audioUrls.length; i++) {
                const ext = (assets.audioUrls[i].split(".").pop() || "mp3").toLowerCase()
                const p = join(AUDIO_DIR, `hf-${renderId}-audio-${i}.${ext}`)
                await downloadAudio(assets.audioUrls[i], p)
                audioPaths.push(p)
              }
              // Mix all audio tracks together
              const mixResult = spawnSync('ffmpeg', [
                ...audioPaths.flatMap((p, i) => ['-i', p]),
                '-filter_complex', audioPaths.map((_, i) => `[${i}:a]`).join('') + `amix=inputs=${audioPaths.length}:duration=first:dropout_transition=2`,
                '-c:a', 'aac',
                '-y',
                mixedAudioPath,
              ], { stdio: 'inherit' })
              if (mixResult.status !== 0) throw new Error(`audio mix failed with status ${mixResult.status}`)
              const mux = muxAudioIntoVideo(localFilePath, mixedAudioPath, finalPath)
              if (!mux.ok) throw new Error(mux.error || "audio mux failed")
              for (const p of audioPaths) { try { unlinkSync(p) } catch {} }
            }
            try { unlinkSync(mixedAudioPath) } catch {}
            try { unlinkSync(localFilePath) } catch {}
            localFilePath = finalPath
          } catch (muxErr) {
            console.warn(`[HfWorker] audio mux failed, keeping silent video:`, muxErr)
            try { unlinkSync(mixedAudioPath) } catch {}
            for (const p of []) { try { unlinkSync(p) } catch {} }
          }
        }

        status.status = "completed"
        status.localFilePath = localFilePath
        status.renderTime = result.renderTime
        status.updatedAt = new Date().toISOString()
        jobStatuses.set(job.id!, { ...status })

        if (callbackUrl) {
          try {
            await fetch(callbackUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(status),
              signal: AbortSignal.timeout(10000),
            })
          } catch (err) {
            console.warn(`[HfWorker] Callback failed:`, err)
          }
        }

        return { success: true, localFilePath, renderTime: result.renderTime }
      } catch (error) {
        status.status = "failed"
        status.error =
          error instanceof Error ? error.message : "Unknown error"
        status.updatedAt = new Date().toISOString()
        jobStatuses.set(job.id!, { ...status })
        throw error
      }
    },
    { connection: connection as any, concurrency: 1 },
  )

  worker.on("completed", (job) =>
    console.log(`[HfWorker] Job ${job.id} completed`),
  )
  worker.on("failed", (job, err) =>
    console.error(`[HfWorker] Job ${job?.id} failed:`, err.message),
  )
  worker.on("error", (err) => console.error("[HfWorker] Worker error:", err))

  console.log("[HfWorker] HyperFrames render worker started, listening for jobs...")
  return worker
}
