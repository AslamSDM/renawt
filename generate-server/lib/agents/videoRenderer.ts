/**
 * VIDEO RENDERER AGENT
 *
 * Two render paths chosen by RENDER_PROVIDER env:
 *   - "lambda": frame-level parallelism via Remotion Lambda (uses videoJson)
 *   - "http"  : existing render microservice (uses remotionCode string)
 * Default: "http" (back-compat).
 */

import { submitAndWaitForRender } from "../render/renderClient";
import { submitAndWaitForLambdaRender } from "../render/lambdaRenderClient";
import type { VideoGenerationStateType } from "./state";

const PROVIDER = (process.env.RENDER_PROVIDER || "http").toLowerCase();

export async function videoRendererNode(
  state: VideoGenerationStateType,
): Promise<Partial<VideoGenerationStateType>> {
  console.log(`[VideoRenderer] Starting render attempt (provider=${PROVIDER})...`);

  // Resolve dimensions from aspect ratio
  const ASPECT_DIMS: Record<string, { width: number; height: number }> = {
    "16:9": { width: 1920, height: 1080 },
    "9:16": { width: 1080, height: 1920 },
    "1:1": { width: 1080, height: 1080 },
    "4:5": { width: 1080, height: 1350 },
  };
  const ar = (state.userPreferences as any)?.aspectRatio || "16:9";
  const { width, height } = ASPECT_DIMS[ar] || ASPECT_DIMS["16:9"];
  console.log(`[VideoRenderer] Aspect ratio: ${ar} → ${width}x${height}`);

  try {
    let status;

    if (PROVIDER === "lambda") {
      const videoJson = state.videoJson;
      if (!videoJson) {
        return {
          errors: ["RENDER_PROVIDER=lambda but no videoJson in state"],
          currentStep: "error",
        };
      }
      // Override dims to match aspect-ratio choice (jsonComposer may default)
      videoJson.width = width;
      videoJson.height = height;
      status = await submitAndWaitForLambdaRender(
        { videoJson, projectId: state.projectId || undefined, outputFormat: "mp4" },
        (s) => console.log(`[VideoRenderer] Lambda progress: ${(s.progress ?? 0) * 100 | 0}%`),
      );
    } else {
      const remotionCode = state.remotionCode;
      if (!remotionCode) {
        return {
          errors: ["No Remotion code available for rendering"],
          currentStep: "error",
        };
      }
      const script = state.videoScript;
      const totalDuration = script?.totalDuration || 300;
      console.log(
        `[VideoRenderer] HTTP render attempt ${state.renderAttempts + 1}...`,
      );
      status = await submitAndWaitForRender(
        {
          remotionCode,
          durationInFrames: totalDuration,
          outputFormat: "mp4",
          width,
          height,
          fps: 30,
          projectId: state.projectId || undefined,
        },
        (progress) => {
          console.log(
            `[VideoRenderer] Service progress: ${JSON.stringify(progress)}`,
          );
        },
      );
    }

    if (status.status === "completed" && status.videoUrl) {
      console.log("[VideoRenderer] Render completed!");
      console.log(`[VideoRenderer] Video URL: ${status.videoUrl}`);

      return {
        videoUrl: status.videoUrl,
        currentStep: "complete",
        lastRenderError: null,
      };
    } else {
      console.error("[VideoRenderer] Render failed:", status.error);
      return {
        errors: [`Render failed: ${status.error}`],
        lastRenderError: status.error || "Unknown render error",
        currentStep: "fixing",
        renderAttempts: state.renderAttempts + 1,
      };
    }
  } catch (error) {
    console.error("[VideoRenderer] Unexpected error:", error);

    return {
      errors: [`Render error: ${error}`],
      lastRenderError: error instanceof Error ? error.message : "Unknown error",
      currentStep: "fixing",
      renderAttempts: state.renderAttempts + 1,
    };
  }
}
