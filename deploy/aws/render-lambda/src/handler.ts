import { randomUUID } from "crypto"
import { existsSync, unlinkSync } from "fs"
import { join } from "path"
import { renderHf } from "./engine.js"
import { muxAudioIntoVideo } from "./muxer.js"
import { uploadFileToR2, putStatus } from "./r2.js"

interface RenderRequest {
  jobId?: string
  remotionCode?: string
  compositionHtml?: string
  projectFiles?: Record<string, string>
  durationInFrames: number
  outputFormat?: "mp4" | "webm"
  width?: number
  height?: number
  fps?: number
  quality?: string
  projectId?: string
  callbackUrl?: string
  assets?: {
    audioUrls?: string[]
    imageUrls?: string[]
  }
}

interface RenderJobStatus {
  jobId: string
  status: "queued" | "rendering" | "completed" | "failed"
  progress?: number
  videoUrl?: string
  r2Key?: string
  error?: string
  renderTime?: number
  createdAt: string
  updatedAt: string
}

const TMP_DIR = "/tmp"
const MAX_VIDEO_SECONDS = 12 * 60 // Lambda hard cap: 15 min timeout

async function downloadFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`download failed: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const { writeFileSync } = await import("fs")
  writeFileSync(dest, buf)
}

function renderJobId(body: RenderRequest): string {
  return body.jobId || randomUUID().slice(0, 12)
}

export async function handler(event: unknown): Promise<void> {
  const sqsEvent = event as { Records?: Array<{ body?: string }> }
  const record = sqsEvent?.Records?.[0]
  if (!record?.body) {
    console.error("[render-lambda] no SQS records")
    return
  }

  const body = JSON.parse(record.body) as RenderRequest
  const jobId = renderJobId(body)

  const status: RenderJobStatus = {
    jobId,
    status: "queued",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  await putStatus(jobId, status)

  const seconds = body.durationInFrames / (body.fps || 30)
  if (seconds > MAX_VIDEO_SECONDS) {
    const error = `video is ${Math.round(seconds)}s — Lambda max render is ${MAX_VIDEO_SECONDS}s. Use Fargate for longer videos`
    console.error(`[render-lambda] ${jobId}: ${error}`)
    await putStatus(jobId, { ...status, status: "failed", error, updatedAt: new Date().toISOString() })
    return
  }

  try {
    status.status = "rendering"
    await putStatus(jobId, status)

    const fmt = body.outputFormat === "webm" ? "webm" : "mp4"
    const silentPath = join(TMP_DIR, `hf-${jobId}-silent.${fmt}`)
    const finalPath = join(TMP_DIR, `hf-${jobId}.${fmt}`)

    let lastProgress = 0
    const result = await renderHf(
      {
        compositionHtml: body.compositionHtml || body.remotionCode || "",
        projectFiles: body.projectFiles,
        width: body.width ?? 1920,
        height: body.height ?? 1080,
        fps: body.fps ?? 30,
        durationInFrames: body.durationInFrames,
        quality: body.quality || "standard",
        outputFormat: fmt,
        outputPath: silentPath,
      },
      (_job: unknown, _message: string) => {
        const progress = Math.min(50, lastProgress + 1)
        lastProgress = progress
        putStatus(jobId, { ...status, status: "rendering", progress })
      },
    )

    if (!result.success) {
      await putStatus(jobId, {
        ...status,
        status: "failed",
        error: result.error || "render failed",
        updatedAt: new Date().toISOString(),
      })
      return
    }

    let localFilePath = silentPath
    const audioUrls = body.assets?.audioUrls || []

    if (audioUrls.length > 0) {
      try {
        if (audioUrls.length === 1) {
          const ext = (audioUrls[0].split(".").pop() || "mp3").toLowerCase()
          const audioPath = join(TMP_DIR, `hf-${jobId}-audio.${ext}`)
          await downloadFile(audioUrls[0], audioPath)
          const mux = muxAudioIntoVideo(localFilePath, audioPath, finalPath)
          if (!mux.ok) throw new Error(mux.error || "audio mux failed")
          try { unlinkSync(audioPath) } catch {}
        } else {
          const audioPaths: string[] = []
          for (let i = 0; i < audioUrls.length; i++) {
            const ext = (audioUrls[i].split(".").pop() || "mp3").toLowerCase()
            const p = join(TMP_DIR, `hf-${jobId}-audio-${i}.${ext}`)
            await downloadFile(audioUrls[i], p)
            audioPaths.push(p)
          }
          const { spawnSync } = await import("child_process")
          const mixedPath = join(TMP_DIR, `hf-${jobId}-mixed.mp3`)
          const mixResult = spawnSync("ffmpeg", [
            ...audioPaths.flatMap((p) => ["-i", p]),
            "-filter_complex",
            audioPaths.map((_, i) => `[${i}:a]`).join("") + `amix=inputs=${audioPaths.length}:duration=first:dropout_transition=2`,
            "-c:a", "aac",
            "-y",
            mixedPath,
          ], { stdio: "pipe" })
          if (mixResult.status !== 0) throw new Error(`audio mix failed with status ${mixResult.status}`)
          const mux = muxAudioIntoVideo(localFilePath, mixedPath, finalPath)
          if (!mux.ok) throw new Error(mux.error || "audio mux failed")
          for (const p of audioPaths) { try { unlinkSync(p) } catch {} }
          try { unlinkSync(mixedPath) } catch {}
        }
        try { unlinkSync(localFilePath) } catch {}
        localFilePath = finalPath
      } catch (muxErr) {
        console.warn(`[render-lambda] audio mux failed, keeping silent video:`, muxErr)
      }
    }

    if (!existsSync(localFilePath)) {
      throw new Error("render produced no output file")
    }

    const fileName = localFilePath.split("/").pop() || `hf-${jobId}.mp4`
    const key = body.projectId
      ? `projects/${body.projectId}/videos/${fileName}`
      : `videos/${randomUUID()}/${fileName}`

    const uploaded = await uploadFileToR2(localFilePath, key, "video/mp4")

    const finalStatus: RenderJobStatus = {
      jobId,
      status: "completed",
      progress: 100,
      videoUrl: uploaded.url,
      r2Key: uploaded.key,
      renderTime: result.renderTime,
      createdAt: status.createdAt,
      updatedAt: new Date().toISOString(),
    }
    await putStatus(jobId, finalStatus)

    try { unlinkSync(localFilePath) } catch {}

    console.log(`[render-lambda] ${jobId} completed in ${result.renderTime}ms → ${uploaded.url}`)

    if (body.callbackUrl) {
      try {
        await fetch(body.callbackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalStatus),
          signal: AbortSignal.timeout(10000),
        })
      } catch (err) {
        console.warn(`[render-lambda] callback failed:`, err)
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown render error"
    console.error(`[render-lambda] ${jobId} failed:`, error)
    await putStatus(jobId, {
      ...status,
      status: "failed",
      error: msg,
      updatedAt: new Date().toISOString(),
    })
  }
}
