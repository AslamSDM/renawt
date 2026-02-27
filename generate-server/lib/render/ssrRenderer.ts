/**
 * SERVER-SIDE REMOTION RENDERER
 *
 * Writes generated Remotion code to file, bundles, and renders to video.
 * Uses Remotion's programmatic API for server-side rendering.
 * Uploads rendered videos to Cloudflare R2.
 */

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { uploadVideoToR2, isR2Configured } from "../storage/r2";

// Output directory for rendered videos
const OUTPUT_DIR = join(process.cwd(), "public", "renders");
const TEMP_DIR = join(process.cwd(), ".remotion-temp");

// Ensure directories exist
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}
if (!existsSync(TEMP_DIR)) {
  mkdirSync(TEMP_DIR, { recursive: true });
}

export interface RenderOptions {
  remotionCode: string;
  outputFormat?: "mp4" | "webm";
  width?: number;
  height?: number;
  fps?: number;
  durationInFrames: number;
  projectId?: string; // For R2 organization
}

export interface RenderResult {
  success: boolean;
  videoUrl?: string;
  error?: string;
  renderTime?: number;
  r2Key?: string;
}

/**
 * Create a temporary composition file from generated code
 */
function createTempComposition(code: string, id: string): string {
  const filePath = join(TEMP_DIR, `composition-${id}.tsx`);

  // Strip markdown code fences if present (LLM output artifact)
  let finalCode = code
    .replace(/^```(?:tsx?|jsx?|javascript)?\s*\n?/i, "")
    .replace(/\n?```\s*$/, "")
    .trim();

  // Ensure the code has proper imports and default export

  // If code doesn't have React import, add it
  if (
    !finalCode.includes("import React") &&
    !finalCode.includes("import * as React")
  ) {
    finalCode = `import React from 'react';\n${finalCode}`;
  }

  // If code doesn't have remotion imports, add common ones
  if (
    !finalCode.includes("from 'remotion'") &&
    !finalCode.includes('from "remotion"')
  ) {
    finalCode = `import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Audio, staticFile } from 'remotion';\n${finalCode}`;
  }

  // Ensure Audio and staticFile are imported if Audio is used
  if (finalCode.includes("<Audio") && !finalCode.includes("staticFile")) {
    finalCode = finalCode.replace(
      /from ['"]remotion['"]/,
      `from 'remotion';\nimport { staticFile } from 'remotion'`,
    );
  }
  if (
    finalCode.includes("<Audio") &&
    !finalCode.includes("Audio,") &&
    !finalCode.includes("Audio }")
  ) {
    finalCode = finalCode.replace(
      /import \{([^}]+)\} from ['"]remotion['"]/,
      (match, imports) =>
        `import {${imports}, Audio, staticFile } from 'remotion'`,
    );
  }

  // Check if there's a default export - if not, try to find and add one
  if (!finalCode.includes("export default")) {
    // Try to find component declarations and export the LAST one
    // (the last one is typically the main composition, while earlier ones are helpers)
    const componentMatches = [
      ...finalCode.matchAll(/(?:const|function|class)\s+([A-Z][a-zA-Z0-9]*)/g),
    ];
    if (componentMatches.length > 0) {
      const mainComponent = componentMatches[componentMatches.length - 1][1];
      finalCode += `\nexport default ${mainComponent};`;
    } else {
      // Fallback: create a simple wrapper
      finalCode += `
// No component found, creating placeholder
const DefaultComposition = () => (
  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', color: '#fff', fontSize: 32 }}>
    No valid component found in code
  </div>
);
export default DefaultComposition;`;
    }
  }

  writeFileSync(filePath, finalCode, "utf-8");
  console.log(`[SSR] Created temp composition at: ${filePath}`);

  return filePath;
}

/**
 * Check if code already has its own RemotionRoot / registerRoot entry point.
 * If so, we can use the composition file directly as the entry point.
 */
function codeHasOwnEntryPoint(code: string): boolean {
  return (
    code.includes("registerRoot") ||
    (code.includes("RemotionRoot") && code.includes("<Composition"))
  );
}

/**
 * Create a self-contained entry point from code that already has RemotionRoot.
 * We just need to add registerRoot if it's missing.
 */
function createSelfContainedEntryPoint(code: string, id: string): string {
  const entryPath = join(TEMP_DIR, `entry-${id}.tsx`);

  let entryCode = code;

  // If code exports RemotionRoot but doesn't call registerRoot, add it
  if (!entryCode.includes("registerRoot")) {
    entryCode += `\nimport { registerRoot } from 'remotion';\nregisterRoot(RemotionRoot);`;
  }

  writeFileSync(entryPath, entryCode, "utf-8");
  console.log(`[SSR] Created self-contained entry point at: ${entryPath}`);

  return entryPath;
}

/**
 * Create a temporary entry point that registers the composition
 */
function createTempEntryPoint(
  compositionPath: string,
  id: string,
  durationInFrames: number,
): string {
  const entryPath = join(TEMP_DIR, `entry-${id}.tsx`);

  // Create entry point that imports and registers the composition
  // Must call registerRoot() for Remotion bundler to work
  const entryCode = `
import React from 'react';
import { Composition, registerRoot } from 'remotion';
import VideoComposition from './composition-${id}';

const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="GeneratedVideo"
      component={VideoComposition}
      durationInFrames={${durationInFrames}}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};

registerRoot(RemotionRoot);
`;

  writeFileSync(entryPath, entryCode, "utf-8");
  console.log(`[SSR] Created temp entry point at: ${entryPath}`);

  return entryPath;
}

/**
 * Render a video from generated Remotion code
 */
export async function renderVideo(
  options: RenderOptions,
): Promise<RenderResult> {
  const startTime = Date.now();
  const renderId = randomUUID().slice(0, 8);

  console.log(`[SSR] Starting render ${renderId}...`);

  try {
    const {
      remotionCode,
      outputFormat = "mp4",
      width = 1920,
      height = 1080,
      fps = 30,
      durationInFrames,
      projectId,
    } = options;

    // Detect if code uses Three.js / WebGL
    const usesThreeJs =
      remotionCode.includes("@react-three") ||
      remotionCode.includes("@remotion/three") ||
      remotionCode.includes("ThreeCanvas") ||
      remotionCode.includes("EffectComposer") ||
      remotionCode.includes("from 'three'") ||
      remotionCode.includes('from "three"') ||
      remotionCode.includes("<Canvas");

    // Detect if code already has its own entry point (RemotionRoot + Composition)
    const hasOwnEntryPoint = codeHasOwnEntryPoint(remotionCode);
    console.log(
      `[SSR] Uses Three.js: ${usesThreeJs}, Has own entry point: ${hasOwnEntryPoint}`,
    );

    let entryPath: string;
    let compositionId: string;

    if (hasOwnEntryPoint) {
      // Code already has RemotionRoot with Composition — use it directly
      console.log("[SSR] Code has its own entry point, using directly...");
      entryPath = createSelfContainedEntryPoint(remotionCode, renderId);

      // Extract the composition ID from the code
      const compIdMatch = remotionCode.match(/id=["']([^"']+)["']/);
      compositionId = compIdMatch ? compIdMatch[1] : "GeneratedVideo";
      console.log(`[SSR] Detected composition ID: ${compositionId}`);
    } else {
      // Simple component code — wrap it in our own entry point
      const compositionPath = createTempComposition(remotionCode, renderId);
      entryPath = createTempEntryPoint(
        compositionPath,
        renderId,
        durationInFrames,
      );
      compositionId = "GeneratedVideo";
    }

    // Bundle the composition with public directory for static files (audio)
    console.log("[SSR] Bundling composition...");
    const publicDir = join(process.cwd(), "public");
    const bundleLocation = await bundle({
      entryPoint: entryPath,
      webpackOverride: (config) => config,
      publicDir, // Include public folder for staticFile() to work
    });
    console.log(`[SSR] Bundle created at: ${bundleLocation}`);
    console.log(`[SSR] Public dir: ${publicDir}`);

    // Select the composition
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      chromiumOptions: {
        gl: usesThreeJs ? "angle" : "swangle",
      },
    });

    // Output path
    const outputFileName = `video-${renderId}.${outputFormat}`;
    const outputPath = join(OUTPUT_DIR, outputFileName);

    // Three.js needs concurrency=1 for WebGL context, otherwise use higher
    const concurrency = usesThreeJs ? 1 : 8;
    console.log(
      `[SSR] Rendering to ${outputPath}... (concurrency=${concurrency})`,
    );
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: outputFormat === "mp4" ? "h264" : "vp8",
      outputLocation: outputPath,
      chromiumOptions: {
        gl: usesThreeJs ? "angle" : "swangle",
      },
      concurrency,
      onProgress: ({ progress }) => {
        console.log(`[SSR] Render progress: ${Math.round(progress * 100)}%`);
      },
    });

    // Cleanup temp files
    try {
      unlinkSync(entryPath);
      // Also clean up composition file if it was created separately
      const compositionPath = join(TEMP_DIR, `composition-${renderId}.tsx`);
      if (existsSync(compositionPath)) unlinkSync(compositionPath);
    } catch (e) {
      console.warn("[SSR] Cleanup warning:", e);
    }

    const renderTime = Date.now() - startTime;
    console.log(`[SSR] Render complete in ${renderTime}ms`);

    // Upload to R2 if configured
    const serverBase =
      process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`;
    let finalVideoUrl = `${serverBase}/renders/${outputFileName}`;
    let r2Key: string | undefined;

    if (isR2Configured()) {
      console.log(`[SSR] Uploading to R2...`);
      const uploadResult = await uploadVideoToR2(outputPath, projectId);

      if (uploadResult.success && uploadResult.url) {
        console.log(`[SSR] Uploaded to R2: ${uploadResult.url}`);
        finalVideoUrl = uploadResult.url;
        r2Key = uploadResult.key;

        // Optionally delete local file after successful R2 upload
        try {
          unlinkSync(outputPath);
          console.log(`[SSR] Local file cleaned up`);
        } catch (e) {
          console.warn(`[SSR] Could not clean up local file:`, e);
        }
      } else {
        console.error(`[SSR] R2 upload failed: ${uploadResult.error}`);
      }
    } else {
      console.log(`[SSR] R2 not configured, using local storage`);
    }

    return {
      success: true,
      videoUrl: finalVideoUrl,
      renderTime,
    };
  } catch (error) {
    console.error("[SSR] Render error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown render error",
    };
  }
}

/**
 * Quick render using existing composition from Root.tsx
 * Useful when you just want to render a pre-defined composition
 */
export async function renderExistingComposition(
  compositionId: string,
  outputFormat: "mp4" | "webm" = "mp4",
): Promise<RenderResult> {
  const startTime = Date.now();
  const renderId = randomUUID().slice(0, 8);

  console.log(`[SSR] Rendering existing composition: ${compositionId}`);

  try {
    const entryPoint = join(process.cwd(), "remotion", "Root.tsx");

    // Bundle
    const bundleLocation = await bundle({
      entryPoint,
      webpackOverride: (config) => config,
    });

    // Select composition
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      chromiumOptions: {
        gl: "swangle",
      },
    });

    // Output
    const outputFileName = `${compositionId}-${renderId}.${outputFormat}`;
    const outputPath = join(OUTPUT_DIR, outputFileName);

    // Render
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: outputFormat === "mp4" ? "h264" : "vp8",
      outputLocation: outputPath,
      chromiumOptions: {
        gl: "swangle",
      },
      onProgress: ({ progress }) => {
        console.log(`[SSR] Progress: ${Math.round(progress * 100)}%`);
      },
    });

    return {
      success: true,
      videoUrl: `/renders/${outputFileName}`,
      renderTime: Date.now() - startTime,
    };
  } catch (error) {
    console.error("[SSR] Render error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
