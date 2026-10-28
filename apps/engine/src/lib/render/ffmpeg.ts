/**
 * FFmpeg helpers: mux narration + music bed + SFX into a rendered silent (or replaceable-audio) video,
 * and grab a thumbnail frame. Ported/extended from deploy/aws/render-lambda/src/muxer.ts.
 */
import { spawn } from "node:child_process";

export function run(cmd: string, args: string[], opts: { cwd?: string; timeoutMs?: number } = {}): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: opts.cwd, stdio: ["ignore", "pipe", "pipe"], env: process.env });
    let stdout = "", stderr = "";
    p.stdout.on("data", (d) => { stdout += d; if (stdout.length > 2e6) stdout = stdout.slice(-1e6); });
    p.stderr.on("data", (d) => { stderr += d; if (stderr.length > 2e6) stderr = stderr.slice(-1e6); });
    const timer = opts.timeoutMs ? setTimeout(() => { p.kill("SIGKILL"); reject(new Error(`${cmd} timed out after ${opts.timeoutMs}ms`)); }, opts.timeoutMs) : null;
    p.on("error", (e) => { if (timer) clearTimeout(timer); reject(e); });
    p.on("close", (code) => { if (timer) clearTimeout(timer); resolve({ code: code ?? 1, stdout, stderr }); });
  });
}

export interface MuxInput {
  videoPath: string;
  narration?: string;         // path or URL
  music?: string | null;      // path or URL
  musicVolume?: number;       // linear, default 0.12 (~-18 dB under narration)
  sfx?: Array<{ atMs: number; src: string; volume?: number }>;
  durationMs: number;
  outputPath: string;
}

/** Build the ffmpeg argv for muxing (exported for tests/inspection). */
export function buildMuxArgs(m: MuxInput): string[] {
  const args = ["-y", "-i", m.videoPath];
  const labels: string[] = [];
  const filters: string[] = [];
  let idx = 1;
  if (m.narration) {
    args.push("-i", m.narration);
    filters.push(`[${idx}:a]aresample=44100,volume=1.0[nar]`);
    labels.push("[nar]");
    idx++;
  }
  if (m.music) {
    args.push("-stream_loop", "-1", "-i", m.music);
    const vol = m.musicVolume ?? 0.12;
    const fadeStart = Math.max(0, m.durationMs / 1000 - 1.5).toFixed(2);
    filters.push(`[${idx}:a]aresample=44100,volume=${vol},afade=t=in:d=0.6,afade=t=out:st=${fadeStart}:d=1.5[mus]`);
    labels.push("[mus]");
    idx++;
  }
  for (const [k, s] of (m.sfx ?? []).entries()) {
    args.push("-i", s.src);
    const d = Math.max(0, Math.round(s.atMs));
    filters.push(`[${idx}:a]aresample=44100,adelay=${d}|${d},volume=${s.volume ?? 0.5}[sfx${k}]`);
    labels.push(`[sfx${k}]`);
    idx++;
  }
  const secs = (m.durationMs / 1000).toFixed(3);
  if (!labels.length) {
    args.push("-map", "0:v", "-c:v", "copy", "-an", "-t", secs, m.outputPath);
    return args;
  }
  filters.push(`${labels.join("")}amix=inputs=${labels.length}:duration=longest:dropout_transition=0:normalize=0,alimiter=limit=0.95[aout]`);
  args.push("-filter_complex", filters.join(";"), "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", secs, "-movflags", "+faststart", m.outputPath);
  return args;
}

export async function muxAudio(m: MuxInput): Promise<void> {
  const r = await run("ffmpeg", buildMuxArgs(m), { timeoutMs: 5 * 60_000 });
  if (r.code !== 0) throw new Error(`ffmpeg mux failed: ${r.stderr.slice(-800)}`);
}

export async function extractThumbnail(videoSrc: string, outPath: string, atSec = 1.2): Promise<void> {
  const r = await run("ffmpeg", ["-y", "-ss", String(atSec), "-i", videoSrc, "-frames:v", "1", "-vf", "scale=720:-2", "-q:v", "3", outPath], { timeoutMs: 120_000 });
  if (r.code !== 0) throw new Error(`ffmpeg thumbnail failed: ${r.stderr.slice(-500)}`);
}

export async function probeDurationMs(src: string): Promise<number | null> {
  try {
    const r = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", src], { timeoutMs: 60_000 });
    const s = parseFloat(r.stdout.trim());
    return Number.isFinite(s) ? Math.round(s * 1000) : null;
  } catch {
    return null;
  }
}
