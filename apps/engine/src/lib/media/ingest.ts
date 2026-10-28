/**
 * User media ingest: probe, normalise to 1080x1920 @30fps (smart center crop or blurred pad), extract
 * speech audio for STT, and cut the kept transcript segments into a trimmed narration track.
 * All scratch files live in os.tmpdir(); durable outputs go to R2.
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../render/ffmpeg.js";

export interface Probe { width: number; height: number; durationMs: number; fps: number; hasAudio: boolean; rotation: number }

export async function probe(src: string): Promise<Probe> {
  const r = await run("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", src], { timeoutMs: 120_000 });
  if (r.code !== 0) throw new Error(`ffprobe failed: ${r.stderr.slice(-400)}`);
  const d = JSON.parse(r.stdout) as { streams: Array<{ codec_type: string; width?: number; height?: number; r_frame_rate?: string; tags?: { rotate?: string }; side_data_list?: Array<{ rotation?: number }> }>; format: { duration?: string } };
  const v = d.streams.find((s) => s.codec_type === "video");
  const rotation = Math.abs(Number(v?.tags?.rotate ?? v?.side_data_list?.find((x) => x.rotation !== undefined)?.rotation ?? 0)) % 180;
  const [num, den] = (v?.r_frame_rate ?? "30/1").split("/").map(Number);
  const w = v?.width ?? 0, h = v?.height ?? 0;
  return {
    width: rotation === 90 ? h : w, height: rotation === 90 ? w : h,
    durationMs: Math.round(parseFloat(d.format.duration ?? "0") * 1000),
    fps: den ? num / den : 30,
    hasAudio: d.streams.some((s) => s.codec_type === "audio"),
    rotation,
  };
}

export type FitMode = "scale" | "crop" | "blurpad";

/** 9:16-ish → scale; wide (≥16:10) → center crop (talking heads are centred); square/4:5 → blurred pad keeps the whole frame. */
export function chooseFit(p: Pick<Probe, "width" | "height">, aspectHint?: string): FitMode {
  const ar = p.width / Math.max(1, p.height);
  if (Math.abs(ar - 9 / 16) < 0.03) return "scale";
  if (aspectHint === "1:1" || aspectHint === "4:5") return "blurpad";
  if (ar >= 1.55) return "crop";
  return "blurpad";
}

export function normalizeArgs(src: string, out: string, fit: FitMode): string[] {
  const enc = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-movflags", "+faststart"];
  if (fit === "blurpad") {
    const fc = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:2[bg];[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,fps=30,setsar=1[v]";
    return ["-y", "-i", src, "-filter_complex", fc, "-map", "[v]", "-map", "0:a?", ...enc, out];
  }
  const vf = fit === "crop" ? "scale=-2:1920,crop=1080:1920,fps=30,setsar=1" : "scale=1080:1920,fps=30,setsar=1";
  return ["-y", "-i", src, "-vf", vf, "-map", "0:v:0", "-map", "0:a?", ...enc, out];
}

export async function withTmp<T>(prefix: string, fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  try { return await fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

export async function normalizeVideo(src: string, fit: FitMode): Promise<Buffer> {
  return withTmp("remawt-ingest-", async (dir) => {
    const out = join(dir, "norm.mp4");
    const r = await run("ffmpeg", normalizeArgs(src, out, fit), { timeoutMs: 30 * 60_000 });
    if (r.code !== 0) throw new Error(`ffmpeg normalise failed: ${r.stderr.slice(-800)}`);
    return readFileSync(out);
  });
}

/** Mono 16 kHz 64 kbps mp3 — small enough for Whisper upload limits (~28 MB/hour). */
export async function extractSpeechAudio(src: string): Promise<Buffer> {
  return withTmp("remawt-stt-", async (dir) => {
    const out = join(dir, "speech.mp3");
    const r = await run("ffmpeg", ["-y", "-i", src, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", out], { timeoutMs: 20 * 60_000 });
    if (r.code !== 0) throw new Error(`ffmpeg audio extract failed: ${r.stderr.slice(-600)}`);
    return readFileSync(out);
  });
}

/** Full-quality mp3 of an uploaded voice recording (used directly as the narration track). */
export async function toNarrationMp3(src: string): Promise<Buffer> {
  return withTmp("remawt-voice-", async (dir) => {
    const out = join(dir, "voice.mp3");
    const r = await run("ffmpeg", ["-y", "-i", src, "-vn", "-ac", "1", "-ar", "44100", "-b:a", "160k", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", out], { timeoutMs: 20 * 60_000 });
    if (r.code !== 0) throw new Error(`ffmpeg voice transcode failed: ${r.stderr.slice(-600)}`);
    return readFileSync(out);
  });
}

/** ffmpeg argv concatenating [start,end] ms ranges of `src` audio into one mp3. */
export function trimConcatArgs(src: string, ranges: Array<{ startMs: number; endMs: number }>, out: string): string[] {
  const parts = ranges.map((r, i) => `[0:a]atrim=start=${(r.startMs / 1000).toFixed(3)}:end=${(r.endMs / 1000).toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st=${Math.max(0, (r.endMs - r.startMs) / 1000 - 0.03).toFixed(3)}:d=0.03[a${i}]`);
  const fc = `${parts.join(";")};${ranges.map((_, i) => `[a${i}]`).join("")}concat=n=${ranges.length}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=11[out]`;
  return ["-y", "-i", src, "-filter_complex", fc, "-map", "[out]", "-ac", "1", "-ar", "44100", "-b:a", "160k", out];
}

export async function trimConcatAudio(src: string, ranges: Array<{ startMs: number; endMs: number }>): Promise<Buffer> {
  if (!ranges.length) throw new Error("no kept segments");
  return withTmp("remawt-trim-", async (dir) => {
    const out = join(dir, "speech-edit.mp3");
    const r = await run("ffmpeg", trimConcatArgs(src, ranges, out), { timeoutMs: 20 * 60_000 });
    if (r.code !== 0) throw new Error(`ffmpeg trim/concat failed: ${r.stderr.slice(-800)}`);
    return readFileSync(out);
  });
}
