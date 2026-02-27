/**
 * Core Remotion rendering engine.
 * Handles bundling, composition creation, and video rendering.
 */

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { uploadVideoToR2, isR2Configured } from "./r2Upload.js";
import type { RenderResult } from "./types.js";

const OUTPUT_DIR = join(process.cwd(), "public", "renders");
const TEMP_DIR = join(process.cwd(), ".remotion-temp");

// Ensure directories exist
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}
if (!existsSync(TEMP_DIR)) {
  mkdirSync(TEMP_DIR, { recursive: true });
}

function createTempComposition(code: string, id: string): string {
  const filePath = join(TEMP_DIR, `composition-${id}.tsx`);

  let finalCode = code;

  if (!code.includes("import React") && !code.includes("import * as React")) {
    finalCode = `import React from 'react';\n${finalCode}`;
  }

  if (!code.includes("from 'remotion'") && !code.includes('from "remotion"')) {
    finalCode = `import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Audio, staticFile } from 'remotion';\n${finalCode}`;
  }

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

  if (!code.includes("export default")) {
    const componentMatch = code.match(
      /(?:const|function|class)\s+([A-Z][a-zA-Z0-9]*)/
    );
    if (componentMatch) {
      finalCode += `\nexport default ${componentMatch[1]};`;
    } else {
      finalCode += `
const DefaultComposition = () => (
  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', color: '#fff', fontSize: 32 }}>
    No valid component found in code
  </div>
);
export default DefaultComposition;`;
    }
  }

  writeFileSync(filePath, finalCode, "utf-8");
  console.log(`[RenderEngine] Created temp composition at: ${filePath}`);

  return filePath;
}

function createTempEntryPoint(
  compositionPath: string,
  id: string,
  durationInFrames: number
): string {
  const entryPath = join(TEMP_DIR, `entry-${id}.tsx`);

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
  console.log(`[RenderEngine] Created temp entry point at: ${entryPath}`);

  return entryPath;
}

export interface RenderOptions {
  remotionCode: string;
  durationInFrames: number;
  outputFormat?: "mp4" | "webm";
  width?: number;
  height?: number;
  fps?: number;
  projectId?: string;
  onProgress?: (progress: number) => void;
}

export async function renderVideo(options: RenderOptions): Promise<RenderResult> {
  const startTime = Date.now();
  const renderId = randomUUID().slice(0, 8);

  console.log(`[RenderEngine] Starting render ${renderId}...`);

  try {
    const {
      remotionCode,
      outputFormat = "mp4",
      width = 1920,
      height = 1080,
      fps = 30,
      durationInFrames,
      projectId,
      onProgress,
    } = options;

    // Create temp files
    const compositionPath = createTempComposition(remotionCode, renderId);
    const entryPath = createTempEntryPoint(compositionPath, renderId, durationInFrames);

    // Bundle the composition
    console.log("[RenderEngine] Bundling composition...");
    const publicDir = join(process.cwd(), "public");
    const bundleLocation = await bundle({
      entryPoint: entryPath,
      webpackOverride: (config) => config,
      publicDir,
    });
    console.log(`[RenderEngine] Bundle created at: ${bundleLocation}`);

    // Select the composition
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: "GeneratedVideo",
    });

    // Output path
    const outputFileName = `video-${renderId}.${outputFormat}`;
    const outputPath = join(OUTPUT_DIR, outputFileName);

    // Render the video
    console.log(`[RenderEngine] Rendering to ${outputPath}...`);
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: outputFormat === "mp4" ? "h264" : "vp8",
      outputLocation: outputPath,
      onProgress: ({ progress }) => {
        console.log(`[RenderEngine] Progress: ${Math.round(progress * 100)}%`);
        onProgress?.(progress);
      },
    });

    // Cleanup temp files
    try {
      unlinkSync(compositionPath);
      unlinkSync(entryPath);
    } catch (e) {
      console.warn("[RenderEngine] Cleanup warning:", e);
    }

    const renderTime = Date.now() - startTime;
    console.log(`[RenderEngine] Render complete in ${renderTime}ms`);

    // Upload to R2 if configured
    let finalVideoUrl = `/renders/${outputFileName}`;
    let r2Key: string | undefined;

    if (isR2Configured()) {
      console.log("[RenderEngine] Uploading to R2...");
      const uploadResult = await uploadVideoToR2(outputPath, projectId);

      if (uploadResult.success && uploadResult.url) {
        console.log(`[RenderEngine] Uploaded to R2: ${uploadResult.url}`);
        finalVideoUrl = uploadResult.url;
        r2Key = uploadResult.key;

        try {
          unlinkSync(outputPath);
          console.log("[RenderEngine] Local file cleaned up");
        } catch (e) {
          console.warn("[RenderEngine] Could not clean up local file:", e);
        }
      } else {
        console.error(`[RenderEngine] R2 upload failed: ${uploadResult.error}`);
      }
    }

    return {
      success: true,
      videoUrl: finalVideoUrl,
      r2Key,
      renderTime,
    };
  } catch (error) {
    console.error("[RenderEngine] Render error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown render error",
    };
  }
}
