/**
 * pnpm --filter @remawt/hf-kit demo:sketch [--no-render] [--only=<id>] [--frames=<dir>]
 * Hand-drawn (Excalidraw-style) demos: did-you-know + chart-explains with the `sketch` skin and
 * wish-i-knew with `sketch-paper`, composed into os.tmpdir()/remawt-hfkit-demo/sketch-<id>/.
 * Runs the kit lint, `hyperframes lint` and `hyperframes check`, renders a draft MP4 and, with
 * --frames, extracts 4 frames per scene-sample (360 px wide) for a visual check.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { composeVideo } from "../compose";
import { lintComposition } from "../lint";
import { scaffoldProject } from "../project";
import { hyperframesVersion, runHyperframesLint, runHyperframesRender } from "../cli";
import { FORMATS, demoAssets, demoKit, demoPlan, demoScript, fakeVoice } from "./fixtures";

const args = process.argv.slice(2);
const noRender = args.includes("--no-render");
const only = args.find((a) => a.startsWith("--only="))?.slice(7);
const framesDir = args.find((a) => a.startsWith("--frames="))?.slice(9);
const ROOT = join(tmpdir(), "remawt-hfkit-demo");
const DEMOS: Array<{ id: string; format: string; skin: string }> = [
  { id: "did-you-know", format: "did-you-know", skin: "sketch" },
  { id: "chart-explains", format: "chart-explains", skin: "sketch" },
  { id: "wish-i-knew", format: "wish-i-knew", skin: "sketch-paper" },
];

function ffmpeg(argv: string[]): boolean {
  return spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...argv]).status === 0;
}

function hyperframesCheck(dir: string): string {
  const r = spawnSync("npx", ["hyperframes", "check", "--json", dir], { encoding: "utf8", timeout: 600_000, cwd: join(import.meta.dirname, "..", ".."), env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: "1" } });
  const out = r.stdout ?? "";
  writeFileSync(join(dir, "hf-check.json"), out || r.stderr || "");
  try {
    const j = JSON.parse(out.slice(out.indexOf("{")));
    const errs = (j.errors ?? j.issues?.filter((i: { severity?: string }) => i.severity === "error") ?? []).length;
    return `${j.ok === false || errs ? "issues" : "ok"} (errors ${errs})`;
  } catch {
    return r.status === 0 ? "ok" : `exit ${r.status}`;
  }
}

async function main() {
  const hfv = hyperframesVersion();
  console.log(`[demo:sketch] output: ${ROOT}  hyperframes CLI: ${hfv ?? "unavailable"}`);
  const rows: Array<Record<string, string>> = [];
  for (const demo of DEMOS.filter((d) => !only || d.id === only)) {
    const dir = join(ROOT, `sketch-${demo.id}`);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(join(dir, "assets"), { recursive: true });
    const format = FORMATS.find((f) => f.id === demo.format)!;
    const script = demoScript(format);
    const tone = ffmpeg(["-f", "lavfi", "-i", "sine=frequency=220:duration=45", "-af", "volume=0.15", "-c:a", "libmp3lame", "-q:a", "6", join(dir, "assets", "narration.mp3")]);
    const voice = fakeVoice(script, 45000, tone ? "assets/narration.mp3" : "");
    const t0 = Date.now();
    const comp = composeVideo({ script, voice, plan: demoPlan(format, voice), kit: demoKit(demo.skin), assets: demoAssets() });
    const composeMs = Date.now() - t0;
    scaffoldProject(comp, dir);
    writeFileSync(join(dir, "composition.json"), JSON.stringify(comp, null, 2));
    const kl = lintComposition(comp);
    const hl = await runHyperframesLint(dir);
    if (hl) writeFileSync(join(dir, "hf-lint.json"), hl.stdout);
    const check = hfv ? hyperframesCheck(dir) : "n/a";
    let render = noRender ? "skipped" : hfv ? "" : "no CLI";
    const out = join(dir, `sketch-${demo.id}.mp4`);
    if (!noRender && hfv) {
      const r = await runHyperframesRender(dir, out, "draft");
      render = r?.ok && existsSync(out) ? `ok ${(statSync(out).size / 1e6).toFixed(1)}MB → ${out}` : `failed: ${(r?.stderr || r?.stdout || "").trim().split("\n").slice(-3).join(" | ")}`;
    }
    if (framesDir && existsSync(out)) {
      mkdirSync(framesDir, { recursive: true });
      // 4 frames: early mid-draw, mid-draw, later, end state of a scene.
      const times = demo.id === "chart-explains" ? [5.6, 8.5, 14, 26] : demo.id === "wish-i-knew" ? [1.5, 6.2, 9.2, 30] : [1.2, 2.6, 6.5, 16];
      times.forEach((t, k) => ffmpeg(["-ss", String(t), "-i", out, "-frames:v", "1", "-vf", "scale=360:-2", join(framesDir, `sketch-${demo.id}-${k + 1}-${t}s.png`)]));
    }
    rows.push({
      id: demo.id, skin: demo.skin, composeMs: String(composeMs),
      kitLint: kl.ok ? `ok (${kl.warnings.length} warn)` : `${kl.errors.length} errors: ${kl.errors.slice(0, 3).join(" ; ")}`,
      hfLint: hl ? (hl.errors.length ? `${hl.errors.length} errors: ${hl.errors.slice(0, 2).join(" ; ")}` : `ok (${hl.warnings.length} warn)`) : "n/a",
      check, render,
    });
    console.log(`[demo:sketch] ${demo.id}:`, rows[rows.length - 1]);
  }
  writeFileSync(join(ROOT, "sketch-summary.json"), JSON.stringify(rows, null, 2));
  if (rows.some((r) => !r.kitLint.startsWith("ok"))) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
