/**
 * One-shot: capture screenshot → urlToJitter → render mp4.
 *
 *   tsx generate-server/scripts/capture-and-test.ts \
 *     --url=https://remawt.com --duration=16000 --render
 */

import { resolve, join } from "path";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { spawn } from "child_process";
import * as dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), "../.env") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

import { captureForJitter } from "../lib/screenshots/jitterCapture";
import { generateVideoFromScreenshot } from "../lib/agents/urlToJitter";

function flag(name: string, def?: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (arg) return arg.slice(name.length + 3);
  if (process.argv.includes(`--${name}`)) return "true";
  return def;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

async function main() {
  const url = flag("url") || "https://remawt.com";
  const durationMs = Number(flag("duration") || "16000");
  const doRender = flag("render") === "true";
  const width = Number(flag("width") || "1920");
  const height = Number(flag("height") || "1080");

  const slug = slugify(url);
  console.log(`[capture-and-test] URL=${url} slug=${slug}`);

  const cap = await captureForJitter(url, slug, { width, height, settleMs: 3500 });
  console.log(`[capture-and-test] screenshot → ${cap.url}`);

  const outDir = join(process.cwd(), "tmp", "test-output");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const t0 = Date.now();
  const result = await generateVideoFromScreenshot({
    url,
    screenshotPath: cap.url,
    heroImageUrl: cap.url,
    durationMs,
    width,
    height,
  });
  console.log(
    `[capture-and-test] composed in ${Date.now() - t0}ms — arts=${result.composer.doc.conf.artboards.length}, customs=${result.composer.doc.customComponents.length}, frames=${result.composer.totalFrames}`,
  );

  writeFileSync(join(outDir, "brand-report.json"), JSON.stringify(result.brandReport, null, 2));
  writeFileSync(join(outDir, "jitter-doc.json"), JSON.stringify(result.composer.doc, null, 2));
  writeFileSync(join(outDir, "jitter-raw.txt"), result.composer.rawText);

  if (!doRender) {
    console.log("[capture-and-test] skipping render (pass --render to render mp4)");
    return;
  }

  const repoRoot = resolve(process.cwd(), "..");
  const mp4Dir = join(repoRoot, "out");
  if (!existsSync(mp4Dir)) mkdirSync(mp4Dir, { recursive: true });
  const mp4Path = join(mp4Dir, `jitter-${slug}.mp4`);
  const propsPath = join(outDir, "jitter-doc.json");

  console.log(`[capture-and-test] rendering → ${mp4Path}`);
  await new Promise<void>((resolveR, rejectR) => {
    const child = spawn(
      "npx",
      ["remotion", "render", "remotion/Root.tsx", "JitterComposition", mp4Path, `--props=${propsPath}`],
      { cwd: repoRoot, stdio: "inherit" },
    );
    child.on("exit", (code) =>
      code === 0 ? resolveR() : rejectR(new Error(`remotion exit ${code}`)),
    );
  });

  console.log(`[capture-and-test] opening ${mp4Path}`);
  spawn("open", [mp4Path]);
}

main().catch((err) => {
  console.error("[capture-and-test] FAILED:", err);
  process.exit(1);
});
