/**
 * Render dispatch.
 *  - RENDER_PROVIDER=lambda (default): hf-kit submitRender → SQS → HyperFrames Lambda; completion arrives at
 *    /webhooks/render (or the 15s poll fallback) and resumes the suspended workflow step.
 *  - RENDER_PROVIDER=local: scaffold the project in os.tmpdir(), run `hyperframes render`, mux narration/music/SFX
 *    with ffmpeg, upload to R2 `videos/{videoId}/master.mp4`.
 */
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Composition } from "@remawt/shared";
import { hfkit } from "../hfkit.js";
import { putObject } from "../r2.js";
import { env } from "../env.js";
import { log } from "../logger.js";
import { muxAudio, run } from "./ffmpeg.js";

export interface LocalRenderInput {
  videoId: string;
  composition: Composition;
  narrationUrl?: string;
  music?: { url: string } | null;
  sfx?: Array<{ atMs: number; url: string }>;
  quality: "draft" | "standard" | "premium";
}

function hyperframesCommand(): { cmd: string; prefix: string[] } {
  if (process.env.HYPERFRAMES_BIN) return { cmd: process.env.HYPERFRAMES_BIN, prefix: [] };
  const local = join(process.cwd(), "node_modules", ".bin", "hyperframes");
  if (existsSync(local)) return { cmd: local, prefix: [] };
  return { cmd: "npx", prefix: ["-y", `hyperframes@${process.env.HYPERFRAMES_VERSION ?? "0.8.212"}`] };
}

/** Scaffold + `hyperframes render` + ffmpeg mux into `dir`. Returns the muxed master path. */
export async function renderToDir(input: LocalRenderInput, dir: string): Promise<string> {
  hfkit.scaffoldProject(input.composition, dir);
  const silent = join(dir, "render.mp4");
  const { cmd, prefix } = hyperframesCommand();
  const q = input.quality === "draft" ? "draft" : input.quality === "premium" ? "delivery" : "looks";
  const r = await run(cmd, [...prefix, "render", dir, "-o", silent, "-q", q, "-f", String(input.composition.fps ?? 30), "--quiet", "--json"], { cwd: dir, timeoutMs: 15 * 60_000 });
  if (r.code !== 0 || !existsSync(silent)) throw new Error(`hyperframes render failed (${r.code}): ${(r.stderr || r.stdout).slice(-1200)}`);
  const master = join(dir, "master.mp4");
  await muxAudio({
    videoPath: silent,
    narration: input.narrationUrl,
    music: input.music?.url ?? null,
    sfx: (input.sfx ?? []).map((s) => ({ atMs: s.atMs, src: s.url })),
    durationMs: input.composition.durationMs,
    outputPath: master,
  });
  return master;
}

export async function renderLocal(input: LocalRenderInput): Promise<{ masterUrl: string; key: string }> {
  const dir = mkdtempSync(join(tmpdir(), `remawt-hf-${input.videoId}-`));
  try {
    const master = await renderToDir(input, dir);
    const key = `videos/${input.videoId}/master.mp4`;
    const masterUrl = await putObject(key, readFileSync(master), "video/mp4", { videoId: input.videoId, renderer: "local" });
    log.info("local render done", { videoId: input.videoId, masterUrl });
    return { masterUrl, key };
  } finally {
    if (!process.env.KEEP_RENDER_DIRS) rmSync(dir, { recursive: true, force: true });
  }
}

export function isLocalRender(): boolean {
  return env.renderProvider === "local";
}

export { submitRemote, pollRemote };

async function submitRemote(comp: Composition, opts: { videoId: string; audioUrls: string[]; callbackUrl?: string; videoUrls?: string[]; quality?: "draft" | "standard" | "high" }) {
  return hfkit.submitRender(comp, opts);
}
async function pollRemote(jobId: string) {
  return hfkit.pollRender(jobId);
}
