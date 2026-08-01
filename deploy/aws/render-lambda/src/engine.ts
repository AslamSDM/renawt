import { createRenderJob, executeRenderJob, type RenderConfigInput } from "@hyperframes/producer"
import { mkdirSync, writeFileSync, existsSync, rmSync } from "fs"
import { join } from "path"
import { randomUUID } from "crypto"

const BASE_TEMP = "/tmp/hf-renders"

export interface HfRenderInput {
  compositionHtml: string
  width: number
  height: number
  fps: number
  durationInFrames: number
  quality?: string
  outputFormat?: string
  outputPath: string
  entryFile?: string
  assets?: Record<string, string>
  projectFiles?: Record<string, string>
}

export interface HfRenderResult {
  success: boolean
  localFilePath?: string
  error?: string
  renderTime?: number
}

export type OnProgress = (job: unknown, message: string) => void

export async function renderHf(
  input: HfRenderInput,
  onProgress?: OnProgress,
): Promise<HfRenderResult> {
  const startTime = Date.now()
  const workDir = join(BASE_TEMP, randomUUID())

  try {
    if (!existsSync(BASE_TEMP)) {
      mkdirSync(BASE_TEMP, { recursive: true })
    }
    mkdirSync(workDir, { recursive: true })

    if (input.projectFiles && Object.keys(input.projectFiles).length > 0) {
      for (const [relativePath, content] of Object.entries(input.projectFiles)) {
        const fullPath = join(workDir, relativePath)
        const dir = fullPath.substring(0, fullPath.lastIndexOf("/"))
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true })
        }
        writeFileSync(fullPath, content, "utf-8")
      }
    }

    const entryFileName = input.entryFile || "index.html"
    if (input.compositionHtml || !input.projectFiles) {
      writeFileSync(join(workDir, entryFileName), input.compositionHtml, "utf-8")
    }

    if (input.assets) {
      for (const [relativePath, content] of Object.entries(input.assets)) {
        const fullPath = join(workDir, relativePath)
        const dir = fullPath.substring(0, fullPath.lastIndexOf("/"))
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true })
        }
        writeFileSync(fullPath, content, "utf-8")
      }
    }

    const config: RenderConfigInput = {
      fps: { num: input.fps, den: 1 },
      quality: (input.quality as "draft" | "standard" | "high") || "standard",
      format: (input.outputFormat as "mp4" | "webm" | "mov" | "png-sequence" | "gif") || "mp4",
      entryFile: input.entryFile,
    }

    const job = createRenderJob(config)

    await executeRenderJob(job, workDir, input.outputPath, onProgress)

    const renderTime = Date.now() - startTime

    return {
      success: true,
      localFilePath: input.outputPath,
      renderTime,
    }
  } catch (error) {
    const renderTime = Date.now() - startTime
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown render error",
      renderTime,
    }
  } finally {
    if (existsSync(workDir)) {
      try {
        rmSync(workDir, { recursive: true, force: true })
      } catch {
        // ignore cleanup errors
      }
    }
  }
}
