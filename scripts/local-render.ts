/**
 * Local mirror of the Lambda render path.
 *
 * Bundles remotion/Root.tsx, picks the JsonComposition, and renders it
 * locally with the same `inputProps` Lambda would receive. Use this to
 * iterate on the JSON pipeline + registry components without paying for
 * Lambda invocations.
 *
 * Usage:
 *   pnpm exec tsx scripts/local-render.ts <path-to-video.json> [outFile]
 *
 * Or: pipe JSON via stdin
 *   cat my-video.json | pnpm exec tsx scripts/local-render.ts
 */

import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, mkdirSync } from "node:fs";
import { bundle } from "@remotion/bundler";
import {
  renderMedia,
  selectComposition,
} from "@remotion/renderer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

async function readInputProps(): Promise<Record<string, unknown>> {
  const arg = process.argv[2];
  if (arg && !arg.startsWith("-")) {
    const raw = readFileSync(arg, "utf-8");
    return JSON.parse(raw);
  }
  // Read from stdin
  if (process.stdin.isTTY) {
    throw new Error(
      "No JSON file argument and no stdin. Usage: tsx scripts/local-render.ts <video.json>",
    );
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

async function main() {
  const inputProps = await readInputProps();
  const outFile =
    process.argv[3] || path.join(projectRoot, "out", `local-${Date.now()}.mp4`);
  mkdirSync(path.dirname(outFile), { recursive: true });

  console.log("[Local] Bundling remotion/Root.tsx ...");
  const serveUrl = await bundle({
    entryPoint: path.join(projectRoot, "remotion/Root.tsx"),
    onProgress: (p) => process.stdout.write(`\r[Local] Bundle ${p}%   `),
  });
  process.stdout.write("\n");
  console.log(`[Local] Bundle ready: ${serveUrl}`);

  console.log("[Local] Selecting composition JsonComposition ...");
  const composition = await selectComposition({
    serveUrl,
    id: "JsonComposition",
    inputProps,
  });
  console.log(
    `[Local] Composition: ${composition.durationInFrames} frames @ ${composition.fps} fps, ${composition.width}x${composition.height}`,
  );

  console.log(`[Local] Rendering to ${outFile} ...`);
  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    outputLocation: outFile,
    inputProps,
    concurrency: Number(process.env.LOCAL_RENDER_CONCURRENCY || 4),
    onProgress: ({ progress }) => {
      process.stdout.write(`\r[Local] Render ${(progress * 100).toFixed(1)}%   `);
    },
  });
  process.stdout.write("\n");
  console.log(`[Local] Done. Wrote ${outFile}`);
}

main().catch((err) => {
  console.error("[Local] FAILED:", err);
  process.exit(1);
});
