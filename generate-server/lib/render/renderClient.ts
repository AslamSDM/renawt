/**
 * HTTP client for the render microservice.
 * Submits render jobs, polls status, downloads rendered files, and uploads to R2.
 */

import { uploadVideoBufferToR2, isR2Configured } from "../storage/r2";

const RENDER_SERVICE_URL =
  process.env.RENDER_SERVICE_URL || "http://localhost:4002";
const RENDER_API_KEY = process.env.RENDER_API_KEY || "";
const THREE_RENDER_SERVICE_URL =
  process.env.THREE_RENDER_SERVICE_URL || RENDER_SERVICE_URL;
const THREE_RENDER_API_KEY =
  process.env.THREE_RENDER_API_KEY || RENDER_API_KEY;
const POLL_INTERVAL_MIN = 2000; // Start at 2 seconds
const POLL_INTERVAL_MAX = 10000; // Cap at 10 seconds
const POLL_BACKOFF_FACTOR = 1.3; // Exponential backoff factor

function authHeaders(engine: RenderEngine = "remotion"): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = engine === "three" ? THREE_RENDER_API_KEY : RENDER_API_KEY;
  if (key) headers["x-render-key"] = key;
  return headers;
}

export type RenderEngine = "remotion" | "three";

function engineBaseUrl(engine: RenderEngine): string {
  return engine === "three" ? THREE_RENDER_SERVICE_URL : RENDER_SERVICE_URL;
}

function engineRoute(engine: RenderEngine, suffix: string): string {
  const base = engineBaseUrl(engine);
  return engine === "three" ? `${base}/render-three${suffix}` : `${base}/render${suffix}`;
}

export interface RenderJobStatus {
  jobId: string;
  status: "queued" | "active" | "rendering" | "completed" | "failed";
  progress?: number;
  localFilePath?: string;
  videoUrl?: string;
  r2Key?: string;
  error?: string;
  renderTime?: number;
}

export interface SubmitRenderOptions {
  remotionCode: string;
  durationInFrames: number;
  outputFormat?: "mp4" | "webm";
  width?: number;
  height?: number;
  fps?: number;
  projectId?: string;
  callbackUrl?: string;
  /**
   * Render engine to target.
   * - "remotion" (default): posts `remotionCode` as Remotion TSX to /render.
   * - "three": posts `remotionCode` as a SceneSpec JSON string to /render-three.
   */
  engine?: RenderEngine;
  assets?: { audioUrls?: string[]; imageUrls?: string[] };
}

/**
 * Submit a render job to the render service
 */
export async function submitRenderJob(
  options: SubmitRenderOptions,
): Promise<{ jobId: string }> {
  const engine = options.engine ?? "remotion";
  console.log(`[RenderClient] Submitting ${engine} render job...`);

  const response = await fetch(engineRoute(engine, ""), {
    method: "POST",
    headers: authHeaders(engine),
    body: JSON.stringify(options),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Render service error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  console.log(`[RenderClient] Job submitted: ${result.jobId}`);

  return { jobId: result.jobId };
}

/**
 * Poll render job status until completion or failure
 */
export async function pollRenderStatus(
  jobId: string,
  onProgress?: (status: RenderJobStatus) => void,
  timeoutMs: number = 20 * 60 * 1000, // 20 minutes for slow VPS renders
  engine: RenderEngine = "remotion",
): Promise<RenderJobStatus> {
  const startTime = Date.now();
  let pollInterval = POLL_INTERVAL_MIN;

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(
        engineRoute(engine, `/${jobId}/status`),
        {
          headers: authHeaders(engine),
          signal: AbortSignal.timeout(10000),
        },
      );

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }

      const status: RenderJobStatus = await response.json();

      onProgress?.(status);

      if (status.status === "completed" || status.status === "failed") {
        return status;
      }

      // Exponential backoff: start at 2s, grow to 10s max
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      pollInterval = Math.min(pollInterval * POLL_BACKOFF_FACTOR, POLL_INTERVAL_MAX);
    } catch (error) {
      console.warn(`[RenderClient] Poll error for ${jobId}:`, error);
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      pollInterval = Math.min(pollInterval * POLL_BACKOFF_FACTOR, POLL_INTERVAL_MAX);
    }
  }

  throw new Error(`Render job ${jobId} timed out after ${timeoutMs}ms`);
}

/**
 * Download rendered video file from render-service
 */
async function downloadRenderedFile(
  jobId: string,
  engine: RenderEngine = "remotion",
): Promise<Buffer> {
  console.log(`[RenderClient] Downloading file for job ${jobId}...`);

  const response = await fetch(engineRoute(engine, `/${jobId}/file`), {
    headers: authHeaders(engine),
    signal: AbortSignal.timeout(60000), // 1 minute for large files
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`File download failed (${response.status}): ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  console.log(
    `[RenderClient] Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)}MB`,
  );

  return buffer;
}

/**
 * Cleanup rendered file on render-service
 */
async function cleanupRenderJob(
  jobId: string,
  engine: RenderEngine = "remotion",
): Promise<void> {
  try {
    await fetch(engineRoute(engine, `/${jobId}/cleanup`), {
      method: "DELETE",
      headers: authHeaders(engine),
      signal: AbortSignal.timeout(10000),
    });
    console.log(`[RenderClient] Cleanup sent for job ${jobId}`);
  } catch (error) {
    console.warn(`[RenderClient] Cleanup failed for ${jobId}:`, error);
  }
}

/**
 * Submit a render job, wait for completion, download file, upload to R2, and cleanup
 */
export async function submitAndWaitForRender(
  options: SubmitRenderOptions,
  onProgress?: (status: RenderJobStatus) => void,
): Promise<RenderJobStatus> {
  const engine = options.engine ?? "remotion";
  const { jobId } = await submitRenderJob(options);
  // 10-min 3D videos can take ~30 min on GPU; default 20 min is too short.
  const timeoutMs = engine === "three" ? 35 * 60 * 1000 : 20 * 60 * 1000;
  const status = await pollRenderStatus(jobId, onProgress, timeoutMs, engine);

  if (status.status !== "completed") {
    return status;
  }

  // Download the rendered file from the sandboxed container
  try {
    const videoBuffer = await downloadRenderedFile(jobId, engine);

    // Upload to R2 if configured
    if (isR2Configured()) {
      console.log("[RenderClient] Uploading to R2...");
      const fileName = `video-${jobId}.mp4`;
      const uploadResult = await uploadVideoBufferToR2(
        videoBuffer,
        fileName,
        options.projectId,
      );

      if (uploadResult.success && uploadResult.url) {
        console.log(`[RenderClient] Uploaded to R2: ${uploadResult.url}`);
        status.videoUrl = uploadResult.url;
        status.r2Key = uploadResult.key;
      } else {
        console.error(`[RenderClient] R2 upload failed: ${uploadResult.error}`);
        status.status = "failed";
        status.error = `R2 upload failed: ${uploadResult.error}`;
        return status;
      }
    } else {
      console.warn("[RenderClient] R2 not configured, no video URL available");
      status.status = "failed";
      status.error = "R2 not configured — cannot deliver video";
      return status;
    }

    // Cleanup the file on render-service
    await cleanupRenderJob(jobId, engine);
  } catch (error) {
    console.error("[RenderClient] File download/upload failed:", error);
    status.status = "failed";
    status.error =
      error instanceof Error ? error.message : "File transfer failed";
  }

  return status;
}

/**
 * Check if the render service is available
 */
export async function isRenderServiceAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${RENDER_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Check if the Three.js render service (GPU node) is available
 */
export async function isThreeRenderServiceAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${THREE_RENDER_SERVICE_URL}/render-three/health`, {
      headers: authHeaders("three"),
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
