/**
 * SERVER-SIDE REMOTION RENDERER
 *
 * Writes generated Remotion code to file, bundles, and renders to video.
 * Uses Remotion's programmatic API for server-side rendering.
 */

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

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
}

export interface RenderResult {
  success: boolean;
  videoUrl?: string;
  error?: string;
  renderTime?: number;
}

/**
 * Create a temporary composition file from generated code
 */
function createTempComposition(code: string, id: string): string {
  const filePath = join(TEMP_DIR, `composition-${id}.tsx`);

  // Ensure the code has proper imports and default export
  let finalCode = code;

  // If code doesn't have React import, add it
  if (!code.includes("import React") && !code.includes("import * as React")) {
    finalCode = `import React from 'react';\n${finalCode}`;
  }

  // If code doesn't have remotion imports, add common ones
  if (!code.includes("from 'remotion'") && !code.includes('from "remotion"')) {
    finalCode = `import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Audio, staticFile } from 'remotion';\n${finalCode}`;
  }

  // Ensure Audio and staticFile are imported if Audio is used
  if (code.includes("<Audio") && !code.includes("staticFile")) {
    finalCode = finalCode.replace(
      /from ['"]remotion['"]/,
      `from 'remotion';\nimport { staticFile } from 'remotion'`
    );
  }
  if (code.includes("<Audio") && !code.includes("Audio,") && !code.includes("Audio }")) {
    finalCode = finalCode.replace(
      /import \{([^}]+)\} from ['"]remotion['"]/,
      (match, imports) => `import {${imports}, Audio, staticFile } from 'remotion'`
    );
  }

  // Check if there's a default export - if not, try to find and add one
  if (!code.includes("export default")) {
    // Try to find a component declaration and export it
    // Common patterns: const VideoComposition, const MyVideo, function Video, etc.
    const componentMatch = code.match(
      /(?:const|function|class)\s+([A-Z][a-zA-Z0-9]*)/,
    );
    if (componentMatch) {
      finalCode += `\nexport default ${componentMatch[1]};`;
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
    } = options;

    // Create temp files
    const compositionPath = createTempComposition(remotionCode, renderId);
    const entryPath = createTempEntryPoint(
      compositionPath,
      renderId,
      durationInFrames,
    );

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
      id: "GeneratedVideo",
    });

    // Output path
    const outputFileName = `video-${renderId}.${outputFormat}`;
    const outputPath = join(OUTPUT_DIR, outputFileName);

    // Render the video
    console.log(`[SSR] Rendering to ${outputPath}...`);
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: outputFormat === "mp4" ? "h264" : "vp8",
      outputLocation: outputPath,
      onProgress: ({ progress }) => {
        console.log(`[SSR] Render progress: ${Math.round(progress * 100)}%`);
      },
    });

    // Cleanup temp files
    try {
      unlinkSync(compositionPath);
      unlinkSync(entryPath);
    } catch (e) {
      console.warn("[SSR] Cleanup warning:", e);
    }

    const renderTime = Date.now() - startTime;
    console.log(`[SSR] Render complete in ${renderTime}ms`);

    return {
      success: true,
      videoUrl: `/renders/${outputFileName}`,
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
