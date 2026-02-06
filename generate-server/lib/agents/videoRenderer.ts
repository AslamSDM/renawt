/**
 * VIDEO RENDERER AGENT
 *
 * Renders the Remotion code to a video file.
 * If rendering fails, passes the error to the fixer agent.
 * Uploads videos to Cloudflare R2.
 */

import { renderVideo } from "../render/ssrRenderer";
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

    const result = await renderVideo({
      remotionCode,
      durationInFrames: totalDuration,
      outputFormat: "mp4",
      width: 1920,
      height: 1080,
      fps: 30,
      projectId: state.projectId || undefined,
    });

    if (result.success) {
      console.log("[VideoRenderer] Render successful!");
      console.log(`[VideoRenderer] Video URL: ${result.videoUrl}`);
      console.log(`[VideoRenderer] Render time: ${result.renderTime}ms`);

      return {
        videoUrl: result.videoUrl || null,
        currentStep: "complete",
        lastRenderError: null,
      };
    } else {
      console.error("[VideoRenderer] Render failed:", result.error);
      
      return {
        errors: [...state.errors, `Render failed: ${result.error}`],
        lastRenderError: result.error || "Unknown render error",
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
