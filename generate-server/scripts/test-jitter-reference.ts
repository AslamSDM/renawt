/**
 * Test the jitter-reference flow on a local reference mp4.
 *
 *   tsx generate-server/scripts/test-jitter-reference.ts            (defaults to ../out/refe2.mp4)
 *   tsx generate-server/scripts/test-jitter-reference.ts <path>
 *   ARGS via flags:
 *     --sections=4   (default 4)
 *     --duration=    (ignored — derived from clip durations)
 *     --no-render    (compose only, no mp4 render)
 *     --desc="..."   (override the user content brief)
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { spawn } from "child_process";
import * as dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), "../.env") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

import { generateJitterFromReference } from "../lib/agents/jitterReferenceOrchestrator";
import { pickTrack } from "../lib/audio/musicPicker";

function flag(name: string, def?: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (arg) return arg.slice(name.length + 3);
  if (process.argv.includes(`--${name}`)) return "true";
  return def;
}

async function main() {
  const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const refPath =
    positional[0] ||
    resolve(process.cwd(), "..", "out", "refe2.mp4");
  const sections = Number(flag("sections") || "4");
  const desc =
    flag("desc") ||
    "A 15s product launch video for Flowdeck — an AI productivity SaaS that auto-builds your roadmap. Tagline: 'Plan less. Ship more.' Feature pills: 'AI tasks', 'Auto-roadmap', 'Zero meetings'. Brand: dark navy + magenta accent.";
  const doRender = flag("render") !== "true" ? flag("no-render") !== "true" : true;

  if (!existsSync(refPath)) {
    throw new Error(`Reference video not found: ${refPath}`);
  }

  const outDir = join(process.cwd(), "tmp", "test-output");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  console.log("[test-jitter-ref] reference:", refPath);
  console.log("[test-jitter-ref] sections:", sections);

  // Pick an audio track to drive the beat grid (so per-clip composers all
  // align ops to the same BPM).
  const music = await pickTrack({ mood: "product", preferredBpm: 124 });
  console.log(
    `[test-jitter-ref] music: "${music.title}" @ ${music.bpm} BPM (beat=${Math.round(music.beatMs)}ms)`,
  );

  const t0 = Date.now();
  const result = await generateJitterFromReference({
    referenceVideoPath: refPath,
    description: desc,
    clipSections: sections,
    audio: { url: music.url, bpm: music.bpm, volume: 0.6 },
    // Narration to test the voice-over pipeline.
    narration: flag("no-narration") === "true"
      ? null
      : {
          text:
            flag("narration") ||
            "Meet Flowdeck. The roadmap that builds itself. Plan less. Ship more.",
          volume: 0.85,
        },
    // Pull a few stock topics so any clip that wants photography can use them.
    stockImageTopics: flag("no-stock") === "true"
      ? undefined
      : ["minimal workspace", "abstract gradient", "team productivity"],
    width: 1920,
    height: 1080,
  });
  const dt = Date.now() - t0;

  writeFileSync(
    join(outDir, "jitter-ref-doc.json"),
    JSON.stringify(result.doc, null, 2),
  );
  writeFileSync(
    join(outDir, "jitter-ref-reports.json"),
    JSON.stringify(result.reports, null, 2),
  );

  const arts = result.doc.conf.artboards;
  const ops = arts.reduce((s, a) => s + a.operations.length, 0);
  console.log(
    `[test-jitter-ref] composed in ${dt}ms — clips=${result.clips.length}, artboards=${arts.length}, ops=${ops}, customs=${result.doc.customComponents.length}, durationMs=${arts.reduce((s, a) => s + a.duration, 0)}`,
  );

  if (!doRender) {
    console.log("[test-jitter-ref] --no-render; stopping.");
    return;
  }

  const repoRoot = resolve(process.cwd(), "..");
  const renderDir = join(repoRoot, "out");
  if (!existsSync(renderDir)) mkdirSync(renderDir, { recursive: true });
  const propsPath = join(outDir, "jitter-ref-doc.json");
  const mp4Path = join(renderDir, `jitter-reference.mp4`);

  console.log("[test-jitter-ref] rendering →", mp4Path);
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

  console.log("[test-jitter-ref] opening", mp4Path);
  spawn("open", [mp4Path]);
}

main().catch((err) => {
  console.error("[test-jitter-ref] FAILED:", err);
  process.exit(1);
});
