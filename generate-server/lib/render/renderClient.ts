/**
 * HTTP client for the render microservice.
 * Submits render jobs, polls status, handles callbacks.
 */

const RENDER_SERVICE_URL = process.env.RENDER_SERVICE_URL || "http://localhost:4002";
const POLL_INTERVAL = 2000; // 2 seconds

export interface RenderJobStatus {
  jobId: string;
  status: "queued" | "active" | "rendering" | "uploading" | "completed" | "failed";
  progress?: number;
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
  timeoutMs: number = 5 * 60 * 1000, // 5 minutes
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
 * Submit a render job and wait for completion
 */
export async function submitAndWaitForRender(
  options: SubmitRenderOptions,
  onProgress?: (status: RenderJobStatus) => void,
): Promise<RenderJobStatus> {
  const { jobId } = await submitRenderJob(options);
  return pollRenderStatus(jobId, onProgress);
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
