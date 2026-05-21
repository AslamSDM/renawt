/**
 * URL → Jitter video, end-to-end.
 *
 *   tsx generate-server/scripts/test-url-video.ts \
 *     --url=https://www.apple.com/in/macbook-neo/ \
 *     --screenshot=/Users/aslam/tempy/remawt/generate-server/tmp/test-output/macbook-neo-hero.png \
 *     --hero-url=/jitter/macbook-neo-hero.png \
 *     --duration=16000 \
 *     --render
 *
 * Writes:
 *   tmp/test-output/jitter-doc.json   (validated JitterDoc)
 *   tmp/test-output/brand-report.json (extracted BrandReport)
 *   tmp/test-output/jitter-raw.txt    (raw composer output)
 * If --render: also writes out/jitter-<slug>.mp4 and opens it.
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { spawn } from "child_process";
import * as dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), "../.env") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

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
  const url = flag("url") || "https://www.apple.com/in/macbook-neo/";
  const screenshotPath =
    flag("screenshot") ||
    resolve(process.cwd(), "tmp/test-output/macbook-neo-hero.png");
  const heroUrl = flag("hero-url") || null;
  const durationMs = Number(flag("duration") || "16000");
  const extraNotes = flag("notes") || "";
  const doRender = flag("render") === "true";
  const width = Number(flag("width") || "1920");
  const height = Number(flag("height") || "1080");

  if (!existsSync(screenshotPath)) {
    throw new Error(`Screenshot not found at ${screenshotPath}`);
  }

  const outDir = join(process.cwd(), "tmp", "test-output");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  console.log("[test-url-video] URL:", url);
  console.log("[test-url-video] Screenshot:", screenshotPath);
  console.log("[test-url-video] Hero URL in doc:", heroUrl || "(none)");
  console.log("[test-url-video] Duration:", durationMs, "ms");

  const t0 = Date.now();
  const result = await generateVideoFromScreenshot({
    url,
    screenshotPath,
    heroImageUrl: heroUrl,
    durationMs,
    extraNotes,
    width,
    height,
  });
  const dt = Date.now() - t0;

  writeFileSync(
    join(outDir, "brand-report.json"),
    JSON.stringify(result.brandReport, null, 2),
  );
  writeFileSync(
    join(outDir, "jitter-doc.json"),
    JSON.stringify(result.composer.doc, null, 2),
  );
  writeFileSync(join(outDir, "jitter-raw.txt"), result.composer.rawText);

  const arts = result.composer.doc.conf.artboards;
  const ops = arts.reduce((s, a) => s + a.operations.length, 0);
  console.log(
    `[test-url-video] Composed in ${dt}ms — artboards=${arts.length}, ops=${ops}, customs=${result.composer.doc.customComponents.length}, totalFrames=${result.composer.totalFrames}`,
  );

  if (!doRender) {
    console.log(
      "[test-url-video] Skipping render. Pass --render to also render mp4.",
    );
    return;
  }

  const slug = slugify(url);
  const repoRoot = resolve(process.cwd(), "..");
  const mp4Path = join(repoRoot, "out", `jitter-${slug}.mp4`);
  if (!existsSync(join(repoRoot, "out"))) {
    mkdirSync(join(repoRoot, "out"), { recursive: true });
  }
  const propsPath = join(outDir, "jitter-doc.json");

  console.log("[test-url-video] Rendering →", mp4Path);
  await new Promise<void>((resolveR, rejectR) => {
    const child = spawn(
      "npx",
      [
        "remotion",
        "render",
        "remotion/Root.tsx",
        "JitterComposition",
        mp4Path,
        `--props=${propsPath}`,
      ],
      { cwd: repoRoot, stdio: "inherit" },
    );
    child.on("exit", (code) =>
      code === 0
        ? resolveR()
        : rejectR(new Error(`remotion render exited ${code}`)),
    );
  });

  console.log("[test-url-video] Opening", mp4Path);
  spawn("open", [mp4Path]);
}

main().catch((err) => {
  console.error("[test-url-video] FAILED:", err);
  process.exit(1);
});
