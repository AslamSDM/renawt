import { uploadVideoBufferToR2, isR2Configured } from "../storage/r2";

const HF_RENDER_SERVICE_URL = process.env.HF_RENDER_SERVICE_URL || process.env.RENDER_SERVICE_URL || "http://localhost:4002";

export interface HfRenderJobParams {
  /** Inline HTML. Optional when projectFiles is provided. */
  compositionHtml?: string;
  /** Full project directory: relative path -> file content. */
  projectFiles?: Record<string, string>;
  durationInFrames: number;
  width: number;
  height: number;
  fps?: number;
  quality?: "draft" | "standard" | "high";
  format?: string;
  entryFile?: string;
  assets?: Record<string, string | string[]>;
  projectId?: string;
  callbackUrl?: string;
  jobId?: string;
}

export interface HfJobStatus {
  jobId: string;
  status: "queued" | "active" | "rendering" | "completed" | "failed";
  progress?: number;
  videoUrl?: string;
  error?: string;
  renderTime?: number;
  createdAt: string;
  updatedAt: string;
  r2Key?: string;
}

function hfUrl(path: string): string {
  return `${HF_RENDER_SERVICE_URL}/render-hf${path}`;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = process.env.RENDER_API_KEY;
  if (key) headers["x-render-key"] = key;
  return headers;
}

export async function submitHfRenderJob(params: HfRenderJobParams): Promise<{ jobId: string }> {
  const response = await fetch(hfUrl(""), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HF render service error (${response.status}): ${text}`);
  }
  const result = await response.json();
  return { jobId: result.jobId };
}

export async function pollHfRenderStatus(jobId: string): Promise<HfJobStatus> {
  const response = await fetch(hfUrl(`/${jobId}/status`), {
    headers: authHeaders(),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`Status check failed: ${response.status}`);
  }
  return response.json();
}

export async function submitAndWaitForHfRender(
  params: HfRenderJobParams & { pollIntervalMs?: number; timeoutMs?: number },
): Promise<HfJobStatus> {
  const { jobId } = await submitHfRenderJob(params);
  const pollInterval = params.pollIntervalMs ?? 2000;
  const timeoutMs = params.timeoutMs ?? 30 * 60 * 1000;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const status = await pollHfRenderStatus(jobId);
    if (status.status === "completed") {
      const videoBuffer = await downloadHfRenderedFile(jobId);
      if (isR2Configured()) {
        const fileName = `hf-${jobId}.mp4`;
        const uploadResult = await uploadVideoBufferToR2(videoBuffer, fileName, params.projectId);
        if (uploadResult.success && uploadResult.url) {
          status.videoUrl = uploadResult.url;
          status.r2Key = uploadResult.key;
        } else {
          status.status = "failed";
          status.error = `R2 upload failed: ${uploadResult.error}`;
          return status;
        }
      } else {
        status.status = "failed";
        status.error = "R2 not configured";
        return status;
      }
      await cleanupHfRenderJob(jobId);
      return status;
    }
    if (status.status === "failed") {
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }
  throw new Error(`HF render job ${jobId} timed out after ${timeoutMs}ms`);
}

export async function downloadHfRenderedFile(jobId: string): Promise<Buffer> {
  const response = await fetch(hfUrl(`/${jobId}/file`), {
    headers: authHeaders(),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    throw new Error(`HF file download failed (${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function cleanupHfRenderJob(jobId: string): Promise<void> {
  try {
    await fetch(hfUrl(`/${jobId}/cleanup`), {
      method: "DELETE",
      headers: authHeaders(),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    // ignore cleanup errors
  }
}

export async function isHfRenderServiceAvailable(): Promise<boolean> {
  try {
    const response = await fetch(hfUrl("/health"), { signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch {
    return false;
  }
}
