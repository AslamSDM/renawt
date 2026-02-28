/**
 * VIDEO RENDERER AGENT
 *
 * Renders the Remotion code to a video file via the render microservice.
 * If rendering fails, passes the error to the fixer agent.
 * Generate-server handles R2 upload after downloading from render-service.
 */

import { submitAndWaitForRender } from "../render/renderClient";
import type { VideoGenerationStateType } from "./state";

export async function videoRendererNode(
  state: VideoGenerationStateType,
): Promise<Partial<VideoGenerationStateType>> {
  console.log("[VideoRenderer] Starting render attempt...");

  const remotionCode = state.remotionCode;
  if (!remotionCode) {
    return {
      errors: [...state.errors, "No Remotion code available for rendering"],
      currentStep: "error",
    };
  }

  const script = state.videoScript;
  const totalDuration = script?.totalDuration || 300;

  try {
    console.log(`[VideoRenderer] Render attempt ${state.renderAttempts + 1}...`);

    const status = await submitAndWaitForRender(
      {
        remotionCode,
        durationInFrames: totalDuration,
        outputFormat: "mp4",
        width: 1920,
        height: 1080,
        fps: 30,
        projectId: state.projectId || undefined,
      },
      (progress) => {
        console.log(`[VideoRenderer] Service progress: ${JSON.stringify(progress)}`);
      },
    );

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
        errors: [...state.errors, `Render failed: ${status.error}`],
        lastRenderError: status.error || "Unknown render error",
        currentStep: "fixing",
        renderAttempts: state.renderAttempts + 1,
      };
    }
  } catch (error) {
    console.error("[VideoRenderer] Unexpected error:", error);

    return {
      errors: [...state.errors, `Render error: ${error}`],
      lastRenderError: error instanceof Error ? error.message : "Unknown error",
      currentStep: "fixing",
      renderAttempts: state.renderAttempts + 1,
    };
  }
}
