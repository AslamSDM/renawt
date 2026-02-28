/**
 * HTTP client for the render microservice.
 * Submits render jobs, polls status, downloads rendered files, and uploads to R2.
 */

import { uploadVideoBufferToR2, isR2Configured } from "../storage/r2";

const RENDER_SERVICE_URL = process.env.RENDER_SERVICE_URL || "http://localhost:4002";
const POLL_INTERVAL = 2000; // 2 seconds

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
}

/**
 * Submit a render job to the render service
 */
export async function submitRenderJob(options: SubmitRenderOptions): Promise<{ jobId: string }> {
  console.log("[RenderClient] Submitting render job...");

  const response = await fetch(`${RENDER_SERVICE_URL}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  timeoutMs: number = 10 * 60 * 1000, // 10 minutes (matches worker timeout)
): Promise<RenderJobStatus> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(`${RENDER_SERVICE_URL}/render/${jobId}/status`, {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }

      const status: RenderJobStatus = await response.json();

      onProgress?.(status);

      if (status.status === "completed" || status.status === "failed") {
        return status;
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
    } catch (error) {
      console.warn(`[RenderClient] Poll error for ${jobId}:`, error);
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
    }
  }

  throw new Error(`Render job ${jobId} timed out after ${timeoutMs}ms`);
}

/**
 * Download rendered video file from render-service
 */
async function downloadRenderedFile(jobId: string): Promise<Buffer> {
  console.log(`[RenderClient] Downloading file for job ${jobId}...`);

  const response = await fetch(`${RENDER_SERVICE_URL}/render/${jobId}/file`, {
    signal: AbortSignal.timeout(60000), // 1 minute for large files
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`File download failed (${response.status}): ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  console.log(`[RenderClient] Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)}MB`);

  return buffer;
}

/**
 * Cleanup rendered file on render-service
 */
async function cleanupRenderJob(jobId: string): Promise<void> {
  try {
    await fetch(`${RENDER_SERVICE_URL}/render/${jobId}/cleanup`, {
      method: "DELETE",
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
  const { jobId } = await submitRenderJob(options);
  const status = await pollRenderStatus(jobId, onProgress);

  if (status.status !== "completed") {
    return status;
  }

  // Download the rendered file from the sandboxed container
  try {
    const videoBuffer = await downloadRenderedFile(jobId);

    // Upload to R2 if configured
    if (isR2Configured()) {
      console.log("[RenderClient] Uploading to R2...");
      const fileName = `video-${jobId}.mp4`;
      const uploadResult = await uploadVideoBufferToR2(videoBuffer, fileName, options.projectId);

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
    await cleanupRenderJob(jobId);
  } catch (error) {
    console.error("[RenderClient] File download/upload failed:", error);
    status.status = "failed";
    status.error = error instanceof Error ? error.message : "File transfer failed";
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
