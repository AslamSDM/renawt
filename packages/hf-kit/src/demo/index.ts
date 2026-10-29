/**
 * pnpm --filter @remawt/hf-kit demo [--no-render] [--only=<id>]
 * Composes a 45 s video per FORMAT (+ a `video-edit` footage case) with a fake VoiceTrack and the
 * `ledger` skin into os.tmpdir()/remawt-hfkit-demo/<id>/, runs the kit lint and `hyperframes lint`,
 * and renders draft MP4s when the hyperframes CLI is available.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Composition, ScenePlan } from "@remawt/shared";
import { composeVideo } from "../compose";
import { lintComposition } from "../lint";
import { scaffoldProject } from "../project";
import { hyperframesVersion, runHyperframesLint, runHyperframesRender } from "../cli";
import { FORMATS, demoAssets, demoKit, demoPlan, demoScript, fakeVoice } from "./fixtures";
import { THREE_DEMO_IDS, isThreeDemo, threeDemo } from "./three";

const args = process.argv.slice(2);
const noRender = args.includes("--no-render");
const only = args.find((a) => a.startsWith("--only="))?.slice(7);
const ROOT = join(tmpdir(), "remawt-hfkit-demo");

function ffmpeg(argv: string[]): boolean {
  return spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...argv]).status === 0;
}

/** Narration stand-in (soft tone) so local renders have an audio stream. */
function makeTone(path: string, sec: number): boolean {
  return ffmpeg(["-f", "lavfi", "-i", `sine=frequency=220:duration=${sec}`, "-af", "volume=0.15", "-c:a", "libmp3lame", "-q:a", "6", path]);
}

function makeFootage(path: string, sec: number): boolean {
  return ffmpeg(["-f", "lavfi", "-i", `testsrc2=size=1080x1920:rate=30:duration=${sec}`, "-f", "lavfi", "-i", `sine=frequency=440:duration=${sec}`, "-af", "volume=0.1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "28", "-c:a", "aac", "-shortest", path]);
}

interface Row { id: string; scenes: number; kitLint: string; hfLint: string; render: string }

function videoEdit(dir: string): Composition {
  const kit = demoKit("ledger");
  mkdirSync(join(dir, "assets"), { recursive: true });
  makeFootage(join(dir, "assets", "footage.mp4"), 12);
  const userVideo = { id: "uv-1", kind: "user-video" as const, url: "assets/footage.mp4", source: "upload", width: 1080, height: 1920 };
  const words = "So here is the thing about compound interest that nobody tells you when you are young".split(" ")
    .map((w, i) => ({ w, s: 200 + i * 520, e: 200 + i * 520 + 420 }));
  const plan: ScenePlan = {
    totalMs: 0, musicMood: "calm", sfxCues: [],
    scenes: [
      { id: "talk-1", beatId: "hook", startMs: 0, durationMs: 3000, block: "video-segment", data: { inMs: 0, outMs: 3000, crop: "cover" }, assetIds: ["uv-1"] },
      { id: "stat", beatId: "reveal", startMs: 3000, durationMs: 3000, block: "counter", headline: "$10,000 at 7% for 30 years", data: { value: 76123, prefix: "$", label: "without adding a cent" }, assetIds: [] },
      { id: "talk-2", beatId: "setup", startMs: 6000, durationMs: 3500, block: "video-segment", data: { inMs: 4000, outMs: 7500, crop: "blur-pad" }, assetIds: ["uv-1"] },
      { id: "list", beatId: "reveal", startMs: 9500, durationMs: 3500, block: "bullet-stack", headline: "Why it works", data: { items: ["Returns earn returns", "Time does the heavy lifting", "Start early, start small"] }, assetIds: [] },
      { id: "talk-3", beatId: "loop", startMs: 13000, durationMs: 3000, block: "video-segment", data: { inMs: 8000, outMs: 11000, crop: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 } }, assetIds: ["uv-1"] },
      { id: "lt", beatId: "hook", startMs: 400, durationMs: 2400, block: "overlay-lower-third", data: { name: "Maya Chen", title: "Personal finance educator" }, assetIds: [] },
      { id: "kw", beatId: "setup", startMs: 6600, durationMs: 1600, block: "overlay-keyword", data: { text: "compound interest" }, assetIds: [] },
      { id: "prog", beatId: "loop", startMs: 13200, durationMs: 2600, block: "overlay-progress", data: { current: 3, total: 3, label: "Recap" }, assetIds: [] },
    ],
  };
  const voice = { audioUrl: "", durationMs: 0, words, provider: "transcript", voiceId: "user" };
  return composeVideo({ script: demoScript(FORMATS[0]), voice, plan, kit, assets: [userVideo], media: { userVideo } });
}

async function main() {
  const hfv = hyperframesVersion();
  console.log(`[demo] output: ${ROOT}  hyperframes CLI: ${hfv ?? "unavailable"}`);
  const rows: Row[] = [];
  const targets = [...FORMATS.map((f) => f.id), "video-edit", ...THREE_DEMO_IDS].filter((id) => !only || id === only || (only === "3d" && isThreeDemo(id)));
  for (const id of targets) {
    const dir = join(ROOT, id);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(join(dir, "assets"), { recursive: true });
    let comp: Composition;
    if (id === "video-edit") comp = videoEdit(dir);
    else if (isThreeDemo(id)) comp = threeDemo(id, { audioUrl: makeTone(join(dir, "assets", "narration.mp3"), 8) ? "assets/narration.mp3" : "" });
    else {
      const format = FORMATS.find((f) => f.id === id)!;
      const script = demoScript(format);
      const hasTone = makeTone(join(dir, "assets", "narration.mp3"), 45);
      const voice = fakeVoice(script, 45000, hasTone ? "assets/narration.mp3" : "");
      comp = composeVideo({ script, voice, plan: demoPlan(format, voice), kit: demoKit("ledger"), assets: demoAssets() });
    }
    scaffoldProject(comp, dir);
    writeFileSync(join(dir, "composition.json"), JSON.stringify(comp, null, 2));
    const kl = lintComposition(comp);
    const hl = await runHyperframesLint(dir);
    let render = noRender ? "skipped" : hfv ? "" : "no CLI";
    if (!noRender && hfv) {
      const out = join(dir, `${id}.mp4`);
      const t0 = Date.now();
      const r = await runHyperframesRender(dir, out, "draft");
      render = r?.ok && existsSync(out) ? `ok ${(statSync(out).size / 1e6).toFixed(1)}MB ${Math.round((Date.now() - t0) / 1000)}s → ${out}` : `failed: ${(r?.stderr || r?.stdout || "").trim().split("\n").slice(-3).join(" | ")}`;
    }
    rows.push({
      id, scenes: comp.sceneFiles.length,
      kitLint: kl.ok ? `ok (${kl.warnings.length} warn)` : `${kl.errors.length} errors: ${kl.errors.slice(0, 3).join(" ; ")}`,
      hfLint: hl ? (hl.errors.length ? `${hl.errors.length} errors: ${hl.errors.slice(0, 3).join(" ; ")}` : `ok (${hl.warnings.length} warn)`) : "n/a",
      render,
    });
    console.log(`[demo] ${id}: kit lint ${rows.at(-1)!.kitLint} | hyperframes lint ${rows.at(-1)!.hfLint} | render ${render}`);
    if (hl && (hl.errors.length || hl.warnings.length)) writeFileSync(join(dir, "hf-lint.json"), hl.stdout);
  }
  writeFileSync(join(ROOT, "summary.json"), JSON.stringify(rows, null, 2));
  console.table(rows.map((r) => ({ ...r, render: r.render.slice(0, 60) })));
  if (rows.some((r) => !r.kitLint.startsWith("ok"))) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
