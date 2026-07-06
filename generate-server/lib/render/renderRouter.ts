/**
 * Render router — picks the render engine and submit options based on the
 * generate request. The 2D Remotion path and the 3D Three.js path share the
 * same `submitAndWaitForRender` client surface; this module just packages the
 * right `SubmitRenderOptions` for each.
 *
 * Routing rules:
 *   mode === "3d"            → engine "three"  (GPU node via THREE_RENDER_SERVICE_URL)
 *   mode === "2d" or default → engine "remotion"
 *
 * For the 3D path the caller passes a `SceneSpec` (already built by
 * sceneBuilder); it is serialized into the `remotionCode` field (reused as a
 * JSON carrier so the client API stays a single shape).
 */

import {
  submitAndWaitForRender,
  type RenderJobStatus,
  type SubmitRenderOptions,
  type RenderEngine,
} from "./renderClient";
import type { SceneSpec } from "../video/sceneSpec";

export interface RouteRemotionArgs {
  mode: "2d";
  remotionCode: string;
  durationInFrames: number;
  outputFormat?: "mp4" | "webm";
  width?: number;
  height?: number;
  fps?: number;
  projectId?: string;
  onProgress?: (s: RenderJobStatus) => void;
}

export interface RouteThreeArgs {
  mode: "3d";
  spec: SceneSpec;
  outputFormat?: "mp4" | "webm";
  projectId?: string;
  audioUrls?: string[];
  imageUrls?: string[];
  onProgress?: (s: RenderJobStatus) => void;
}

export type RenderRouteArgs = RouteRemotionArgs | RouteThreeArgs;

/**
 * Route a render request to the appropriate engine and wait for completion.
 * Returns the final `RenderJobStatus` (with R2 url when R2 is configured).
 */
export async function routeRender(
  args: RenderRouteArgs,
): Promise<RenderJobStatus> {
  if (args.mode === "2d") {
    const opts: SubmitRenderOptions = {
      engine: "remotion",
      remotionCode: args.remotionCode,
      durationInFrames: args.durationInFrames,
      outputFormat: args.outputFormat,
      width: args.width,
      height: args.height,
      fps: args.fps,
      projectId: args.projectId,
    };
    return submitAndWaitForRender(opts, args.onProgress);
  }

  // 3D — Three.js engine
  const spec = args.spec;
  const durationInFrames = spec.durationInFrames;
  const options: SubmitRenderOptions = {
    engine: "three" satisfies RenderEngine,
    // Reuse the `remotionCode` field as a SceneSpec JSON carrier — the
    // render-service /render-three route validates it parses as JSON with an
    // `objects` array before enqueueing.
    remotionCode: JSON.stringify(spec),
    durationInFrames,
    outputFormat: args.outputFormat,
    width: spec.width,
    height: spec.height,
    fps: spec.fps,
    projectId: args.projectId,
    assets: {
      audioUrls: args.audioUrls,
      imageUrls: args.imageUrls,
    },
  };
  return submitAndWaitForRender(options, args.onProgress);
}

/**
 * Default engine for a given duration. Long 3D videos go to the GPU node;
 * short 2D videos stay on the CPU/Lambda Remotion path. Exposed for callers
 * that want to log the routing decision.
 */
export function pickEngine(mode: "2d" | "3d"): RenderEngine {
  return mode === "3d" ? "three" : "remotion";
}