/**
 * Render via Remotion Lambda — frame-level parallelism.
 *
 * Renders the JsonComposition that's deployed as part of the Site,
 * passing the video JSON as inputProps. Remotion auto-splits frames
 * across N concurrent Lambda invocations.
 *
 * Mirrors the surface of `renderClient.ts` (submitAndWaitForRender).
 */

import {
  renderMediaOnLambda,
  getRenderProgress,
  type AwsRegion,
} from "@remotion/lambda/client";
import type { VideoJson } from "../video/videoJson";
import {
  uploadVideoBufferToR2,
  isR2Configured,
} from "../storage/r2";
import type { RenderJobStatus } from "./renderClient";

const REGION = (process.env.REMOTION_AWS_REGION || "us-east-1") as AwsRegion;
const FUNCTION_NAME =
  process.env.REMOTION_LAMBDA_FUNCTION_NAME ||
  process.env.REMOTION_FUNCTION_NAME ||
  "";
const SERVE_URL = process.env.REMOTION_SERVE_URL || "";
const COMPOSITION_ID =
  process.env.REMOTION_COMPOSITION_ID || "JsonComposition";
const FRAMES_PER_LAMBDA = process.env.REMOTION_FRAMES_PER_LAMBDA
  ? Number(process.env.REMOTION_FRAMES_PER_LAMBDA)
  : undefined;

const POLL_INTERVAL_MIN = 2000;
const POLL_INTERVAL_MAX = 10000;
const POLL_BACKOFF = 1.3;

function assertConfigured(): void {
  const missing: string[] = [];
  if (!FUNCTION_NAME) missing.push("REMOTION_LAMBDA_FUNCTION_NAME");
  if (!SERVE_URL) missing.push("REMOTION_SERVE_URL");
  if (!process.env.REMOTION_AWS_ACCESS_KEY_ID && !process.env.AWS_ACCESS_KEY_ID) {
    missing.push("REMOTION_AWS_ACCESS_KEY_ID");
  }
  if (
    !process.env.REMOTION_AWS_SECRET_ACCESS_KEY &&
    !process.env.AWS_SECRET_ACCESS_KEY
  ) {
    missing.push("REMOTION_AWS_SECRET_ACCESS_KEY");
  }
  if (missing.length) {
    throw new Error(
      `Lambda render not configured. Missing env: ${missing.join(", ")}`,
    );
  }
}

export interface LambdaRenderOptions {
  videoJson: VideoJson;
  projectId?: string;
  outputFormat?: "mp4" | "webm";
}

export async function submitAndWaitForLambdaRender(
  options: LambdaRenderOptions,
  onProgress?: (status: RenderJobStatus) => void,
): Promise<RenderJobStatus> {
  assertConfigured();

  const { videoJson, projectId, outputFormat = "mp4" } = options;
  const totalFrames = videoJson.scenes.reduce(
    (s, x) => s + x.durationInFrames,
    0,
  );

  console.log(
    `[LambdaRender] Invoking ${FUNCTION_NAME} for composition ${COMPOSITION_ID} (${totalFrames} frames)`,
  );

  const invocation = await renderMediaOnLambda({
    region: REGION,
    functionName: FUNCTION_NAME,
    serveUrl: SERVE_URL,
    composition: COMPOSITION_ID,
    inputProps: videoJson as unknown as Record<string, unknown>,
    codec: outputFormat === "webm" ? "vp8" : "h264",
    forceDurationInFrames: totalFrames,
    forceFps: videoJson.fps,
    forceWidth: videoJson.width,
    forceHeight: videoJson.height,
    framesPerLambda: FRAMES_PER_LAMBDA,
    downloadBehavior: { type: "download", fileName: "video.mp4" },
  });

  const { renderId, bucketName } = invocation;
  console.log(`[LambdaRender] Started renderId=${renderId} bucket=${bucketName}`);

  const status: RenderJobStatus = {
    jobId: renderId,
    status: "rendering",
    progress: 0,
  };

  let pollInterval = POLL_INTERVAL_MIN;
  const startTime = Date.now();
  const TIMEOUT_MS = 20 * 60 * 1000;

  while (Date.now() - startTime < TIMEOUT_MS) {
    const progress = await getRenderProgress({
      renderId,
      bucketName,
      functionName: FUNCTION_NAME,
      region: REGION,
    });

    if (progress.fatalErrorEncountered) {
      const err =
        progress.errors?.[0]?.message ||
        "Lambda render failed (no error details)";
      console.error(`[LambdaRender] Fatal error: ${err}`);
      return {
        ...status,
        status: "failed",
        error: err,
      };
    }

    status.progress = progress.overallProgress;
    onProgress?.(status);

    if (progress.done) {
      console.log(
        `[LambdaRender] Done in ${(progress.timeToFinish ?? 0) / 1000}s`,
      );
      const lambdaUrl = progress.outputFile;
      if (!lambdaUrl) {
        return { ...status, status: "failed", error: "No output URL" };
      }

      // Download from S3 (Lambda serves a presigned URL) and upload to R2
      // for parity with the HTTP render path.
      try {
        if (!isR2Configured()) {
          // Caller still gets the S3 URL — usable but not in our R2 bucket
          return {
            ...status,
            status: "completed",
            videoUrl: lambdaUrl,
          };
        }

        const resp = await fetch(lambdaUrl);
        if (!resp.ok) throw new Error(`S3 download failed: ${resp.status}`);
        const buf = Buffer.from(await resp.arrayBuffer());
        const fileName = `video-${renderId}.${outputFormat === "webm" ? "webm" : "mp4"}`;
        const upload = await uploadVideoBufferToR2(buf, fileName, projectId);
        if (!upload.success || !upload.url) {
          throw new Error(`R2 upload failed: ${upload.error}`);
        }
        return {
          ...status,
          status: "completed",
          videoUrl: upload.url,
          r2Key: upload.key,
        };
      } catch (e) {
        console.error("[LambdaRender] Post-render transfer failed:", e);
        return {
          ...status,
          status: "failed",
          error: e instanceof Error ? e.message : "transfer failed",
        };
      }
    }

    await new Promise((r) => setTimeout(r, pollInterval));
    pollInterval = Math.min(pollInterval * POLL_BACKOFF, POLL_INTERVAL_MAX);
  }

  return {
    ...status,
    status: "failed",
    error: `Timed out after ${TIMEOUT_MS}ms`,
  };
}

export function isLambdaConfigured(): boolean {
  try {
    assertConfigured();
    return true;
  } catch {
    return false;
  }
}
