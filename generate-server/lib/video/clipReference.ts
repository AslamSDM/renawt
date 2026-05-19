/**
 * Split a reference video into N equal-length clips on disk.
 * Returns absolute paths + per-clip durationMs for downstream agents.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { existsSync, mkdirSync } from "fs";
import { join, basename, extname } from "path";

const execFileAsync = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";

export interface ReferenceClip {
  /** 0-based index. */
  index: number;
  /** Absolute path on disk. */
  path: string;
  /** Start time in ms from the start of the reference. */
  startMs: number;
  /** Duration of this clip in ms. */
  durationMs: number;
}

async function probeDurationSec(srcPath: string): Promise<number> {
  const { stdout } = await execFileAsync(FFPROBE, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    srcPath,
  ]);
  const dur = parseFloat(stdout.trim());
  if (!isFinite(dur) || dur <= 0) {
    throw new Error(`Could not probe duration of ${srcPath}`);
  }
  return dur;
}

/**
 * Cut `srcPath` into `numSections` equal-length clips. Re-encodes (libx264)
 * to guarantee clean keyframes per segment — much more reliable than `-c copy`.
 */
export async function clipVideoIntoSections(
  srcPath: string,
  numSections: number,
  outDir: string,
): Promise<ReferenceClip[]> {
  if (!existsSync(srcPath)) {
    throw new Error(`Reference video not found: ${srcPath}`);
  }
  if (numSections < 1) {
    throw new Error(`numSections must be >= 1, got ${numSections}`);
  }
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const totalSec = await probeDurationSec(srcPath);
  const segSec = totalSec / numSections;
  const clips: ReferenceClip[] = [];
  const stem = basename(srcPath, extname(srcPath));

  for (let i = 0; i < numSections; i++) {
    const startSec = i * segSec;
    const outPath = join(outDir, `${stem}-clip-${i + 1}of${numSections}.mp4`);
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-ss",
      startSec.toFixed(3),
      "-i",
      srcPath,
      "-t",
      segSec.toFixed(3),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-an", // drop audio — we don't need it for vision analysis
      "-movflags",
      "+faststart",
      outPath,
    ];
    await execFileAsync(FFMPEG, args, { timeout: 120000 });
    clips.push({
      index: i,
      path: outPath,
      startMs: Math.round(startSec * 1000),
      durationMs: Math.round(segSec * 1000),
    });
  }
  return clips;
}
