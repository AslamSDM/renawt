/**
 * Core Remotion rendering engine.
 * Handles bundling, composition creation, and video rendering.
 * Returns local file path — R2 upload is handled by generate-server.
 */

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { validateGeneratedCode } from "./codeValidator.js";
import type { RenderResult } from "./types.js";

const OUTPUT_DIR = join(process.cwd(), "public", "renders");
const TEMP_DIR = join(process.cwd(), ".remotion-temp");
const BROWSER_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

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

  // Strip spread/rest operators from import statements (LLM sometimes generates `import { X, ...rest }`)
  finalCode = finalCode.replace(
    /import\s*\{([^}]*)\}\s*from\s+(['"`].*?['"`])/g,
    (match, imports, fromPath) => {
      const cleaned = imports
        .split(",")
        .map((s: string) => s.trim())
        .filter((s: string) => s && !s.startsWith("..."))
        .join(", ");
      return `import { ${cleaned} } from ${fromPath}`;
    },
  );

  if (!code.includes("import React") && !code.includes("import * as React")) {
    finalCode = `import React from 'react';\n${finalCode}`;
  }

  if (!code.includes("from 'remotion'") && !code.includes('from "remotion"')) {
    finalCode = `import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Audio, staticFile } from 'remotion';\n${finalCode}`;
  }

  if (code.includes("<Audio") && !code.includes("staticFile")) {
    finalCode = finalCode.replace(
      /from ['"]remotion['"]/,
      `from 'remotion';\nimport { staticFile } from 'remotion'`,
    );
  }
  if (
    code.includes("<Audio") &&
    !code.includes("Audio,") &&
    !code.includes("Audio }")
  ) {
    finalCode = finalCode.replace(
      /import \{([^}]+)\} from ['"]remotion['"]/,
      (match, imports) =>
        `import {${imports}, Audio, staticFile } from 'remotion'`,
    );
  }

  // Count export defaults and fix duplicates
  const exportDefaultMatches = finalCode.match(/export\s+default\s/g);
  if (exportDefaultMatches && exportDefaultMatches.length > 1) {
    // Keep only the last export default, remove earlier ones
    let count = 0;
    const total = exportDefaultMatches.length;
    finalCode = finalCode.replace(/export\s+default\s/g, (match) => {
      count++;
      return count < total ? "const _unused_export = " : match;
    });
    console.warn(
      `[RenderEngine] Fixed ${total - 1} duplicate export default(s)`,
    );
  } else if (!exportDefaultMatches) {
    // Find actual React component (mixed-case name, not ALL_CAPS constants like BRAND)
    // Prefer VideoComposition, then any component with at least one lowercase letter
    let defaultExportName: string | null = null;
    const preferredNames = ["VideoComposition", "Main", "App", "Root", "Composition"];
    for (const name of preferredNames) {
      if (new RegExp(`(?:const|function)\\s+${name}\\b`).test(finalCode)) {
        defaultExportName = name;
        break;
      }
    }
    if (!defaultExportName) {
      const allMatches = [
        ...finalCode.matchAll(/(?:const|function|class)\s+([A-Z][a-zA-Z0-9]*)/g),
      ];
      for (const m of allMatches) {
        if (/[a-z]/.test(m[1])) { // must have a lowercase letter (not ALL_CAPS)
          defaultExportName = m[1];
          break;
        }
      }
    }
    if (defaultExportName) {
      finalCode += `\nexport default ${defaultExportName};`;
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

  // Security: validate code before writing to disk
  const validation = validateGeneratedCode(finalCode);
  if (!validation.safe) {
    console.error(
      `[RenderEngine] BLOCKED: Dangerous code detected:`,
      validation.violations,
    );
    throw new Error(
      `Code validation failed: ${validation.violations.join(", ")}`,
    );
  }

  writeFileSync(filePath, finalCode, "utf-8");
  console.log(`[RenderEngine] Created temp composition at: ${filePath}`);

  return filePath;
}

function createTempEntryPoint(
  compositionPath: string,
  id: string,
  durationInFrames: number,
  width: number,
  height: number,
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
      width={${width}}
      height={${height}}
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

export async function renderVideo(
  options: RenderOptions,
): Promise<RenderResult> {
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
      onProgress,
    } = options;

    // Create temp files
    const compositionPath = createTempComposition(remotionCode, renderId);
    const entryPath = createTempEntryPoint(
      compositionPath,
      renderId,
      durationInFrames,
      width,
      height,
    );

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
      browserExecutable: BROWSER_PATH,
      chromiumOptions: {
        enableMultiProcessOnLinux: true,
      },
    });

    // Output path
    const outputFileName = `video-${renderId}.${outputFormat}`;
    const outputPath = join(OUTPUT_DIR, outputFileName);

    // Concurrency: capped at 2 to stay within container memory limits.
    // Worker runs 1 job at a time; each Chromium tab needs ~500MB.
    // concurrency=2 means 2 tabs per job (1GB); concurrency=1 for heavy scenes.
    const isThreeJS =
      remotionCode.includes("@react-three") || remotionCode.includes("three/") || remotionCode.includes("ThreeCanvas") || remotionCode.includes("@remotion/three");
    const hasBackdropFilter = remotionCode.includes("backdropFilter") || remotionCode.includes("backdrop-filter");
    const renderConcurrency = 1; // Always 1 to prevent OOM in containerized env
    console.log(
      `[RenderEngine] Concurrency: ${renderConcurrency}`,
    );

    // Render the video
    console.log(`[RenderEngine] Rendering to ${outputPath}...`);
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: outputFormat === "mp4" ? "h264" : "vp8",
      outputLocation: outputPath,
      browserExecutable: BROWSER_PATH,
      chromiumOptions: {
        enableMultiProcessOnLinux: true,
      },
      concurrency: renderConcurrency,
      imageFormat: "jpeg", // JPEG for smaller disk usage (PNG OOMs on 1080x1920 @ 165 frames)
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

    // Return local file path — generate-server handles R2 upload
    return {
      success: true,
      localFilePath: outputPath,
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
