/**
 * Direct workflow for remawt.com — bypasses vision (Gemini cap hit),
 * uses a hand-built BrandReport sourced from the actual site,
 * pulls jitter template inspirations from the new registry,
 * composes JitterDoc via CF Kimi fallback, renders mp4.
 *
 *   tsx generate-server/scripts/test-remawt-direct.ts
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { spawn } from "child_process";
import * as dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), "../.env") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

import { briefFromBrandReport, type BrandReport } from "../lib/agents/urlToJitter";
import { generateJitterDoc } from "../lib/agents/jitterComposer";
import { pickTrack, moodToMusicKeyword } from "../lib/audio/musicPicker";

const URL = "https://remawt.com";

const BRAND_REPORT: BrandReport = {
  productName: "Remawt",
  tagline: "AI-Powered Video Generation",
  headlines: [
    "Create stunning videos from any URL",
    "AI-Powered Video Generation",
    "From script to screen in seconds",
  ],
  features: [
    { title: "AI-Powered Generation", description: "Smart Scripts" },
    { title: "Pro Rendering", description: "Studio Quality" },
    { title: "Beat Synchronized", description: "Perfect Timing" },
    { title: "Export Anywhere", description: "4K Quality" },
  ],
  cta: "Start creating",
  brand: {
    primary: "#fafafa",
    secondary: "#a78bfa",
    accent: "#22d3ee",
    background: "#0a0a0a",
    textColor: "#fafafa",
    fontFamily: "Inter",
    fontWeightDisplay: 800,
    mood: "techy",
  },
  layout: "centered",
  heroDescription:
    "Dark hero with a large typewriter headline cycling through video categories, a play-button preview, and floating product UI cards on a near-black background.",
};

async function main() {
  const outDir = join(process.cwd(), "tmp", "test-output");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  // Pick music + align duration to beats
  const music = await pickTrack({
    mood: moodToMusicKeyword(BRAND_REPORT.brand.mood),
    preferredBpm: 124,
  });
  console.log(`[remawt-direct] music: "${music.title}" @ ${music.bpm}bpm`);
  const reqDur = 8000;
  const alignedDur = Math.max(
    music.beatMs * 8,
    Math.round(reqDur / music.beatMs) * music.beatMs,
  );

  const brief = briefFromBrandReport(BRAND_REPORT, {
    durationMs: Math.round(alignedDur),
    heroImageUrl: "/jitter/remawt-com.png",
    width: 1920,
    height: 1080,
    extraNotes:
      "Dark-tech aesthetic. Typewriter intro then card-style feature reveals with violet→cyan accents.",
  });
  brief.audio = { url: music.url, bpm: music.bpm, volume: 0.6 };
  // CF Kimi K2.6 struggles past ~16k output — drop inspirations to keep output budget for the doc.
  brief.templateInspirations = [];

  console.log(`[remawt-direct] brief ready (${Math.round(alignedDur)}ms)`);

  const t0 = Date.now();
  const composer = await generateJitterDoc(brief, { maxAttempts: 5 });
  console.log(
    `[remawt-direct] composed in ${Date.now() - t0}ms — arts=${composer.doc.conf.artboards.length}, ops=${composer.doc.conf.artboards.reduce((s, a) => s + a.operations.length, 0)}, customs=${composer.doc.customComponents.length}, frames=${composer.totalFrames}`,
  );

  writeFileSync(join(outDir, "brand-report.json"), JSON.stringify(BRAND_REPORT, null, 2));
  writeFileSync(join(outDir, "jitter-doc.json"), JSON.stringify(composer.doc, null, 2));
  writeFileSync(join(outDir, "jitter-raw.txt"), composer.rawText);

  const repoRoot = resolve(process.cwd(), "..");
  const mp4Dir = join(repoRoot, "out");
  if (!existsSync(mp4Dir)) mkdirSync(mp4Dir, { recursive: true });
  const mp4Path = join(mp4Dir, "jitter-remawt-com.mp4");
  const propsPath = join(outDir, "jitter-doc.json");
  console.log(`[remawt-direct] rendering → ${mp4Path}`);
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
  console.log(`[remawt-direct] opening ${mp4Path}`);
  spawn("open", [mp4Path]);
}

main().catch((err) => {
  console.error("[remawt-direct] FAILED:", err);
  process.exit(1);
});
