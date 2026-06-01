/**
 * One-off smoke harness for JitterComposition (Stream R validation).
 *
 * Bundles remotion/Root.tsx, selects the "JitterComposition" composition with
 * the given inputProps, prints computed metadata, then renders an mp4.
 *
 * Usage:
 *   pnpm exec tsx remotion/scripts/jitter-smoke-render.ts <in.json> [out.mp4]
 */

import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, mkdirSync } from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");

async function main() {
  const inArg = process.argv[2];
  if (!inArg) throw new Error("usage: jitter-smoke-render.ts <in.json> [out.mp4]");
  const inputProps = JSON.parse(readFileSync(inArg, "utf-8"));
  const outFile =
    process.argv[3] || path.join(projectRoot, "out", `jitter-smoke-${Date.now()}.mp4`);
  mkdirSync(path.dirname(outFile), { recursive: true });

  console.log("[Smoke] Bundling remotion/Root.tsx ...");
  const serveUrl = await bundle({
    entryPoint: path.join(projectRoot, "remotion/Root.tsx"),
    onProgress: (p) => process.stdout.write(`\r[Smoke] Bundle ${p}%   `),
  });
  process.stdout.write("\n");

  console.log("[Smoke] Selecting JitterComposition ...");
  const composition = await selectComposition({
    serveUrl,
    id: "JitterComposition",
    inputProps,
  });
  console.log(
    `[Smoke] Metadata: ${composition.durationInFrames} frames @ ${composition.fps} fps, ${composition.width}x${composition.height}`,
  );

  console.log(`[Smoke] Rendering to ${outFile} ...`);
  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    outputLocation: outFile,
    inputProps,
    concurrency: Number(process.env.LOCAL_RENDER_CONCURRENCY || 4),
    onProgress: ({ progress }) => {
      process.stdout.write(`\r[Smoke] Render ${(progress * 100).toFixed(1)}%   `);
    },
  });
  process.stdout.write("\n");
  console.log(`[Smoke] Done. Wrote ${outFile}`);
}

main().catch((err) => {
  console.error("[Smoke] FAILED:", err);
  process.exit(1);
});
