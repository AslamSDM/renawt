/**
 * Video Stitcher Service
 *
 * Uses FFmpeg to stitch together Veo 3 video clips, overlay narration audio,
 * and mix in background music to produce the final reel video.
 *
 * Pipeline:
 *  1. Concatenate video clips in order
 *  2. Overlay narration audio segments at correct timestamps
 *  3. Mix in background music (ducked under narration)
 *  4. Output final MP4
 */

import { execFile } from "child_process";
import { promisify } from "util";
import {
  writeFileSync,
  readFileSync,
  mkdirSync,
  existsSync,
  unlinkSync,
} from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

const execFileAsync = promisify(execFile);

const OUTPUT_DIR = join(process.cwd(), "tmp", "stitched");
const FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE_PATH = process.env.FFPROBE_PATH || "ffprobe";

export interface ClipInput {
  /** Path to the video clip file */
  filePath: string;
  /** Duration in seconds */
  durationSec: number;
  /** Transition type to the next clip */
  transition?: "cut" | "crossfade" | "whip-pan" | "zoom" | "match-cut";
}

export interface NarrationInput {
  /** Path to the narration audio file */
  filePath: string;
  /** Start time offset in seconds (when this narration begins in the final video) */
  startTimeSec: number;
  /** Duration in seconds */
  durationSec: number;
}

export interface StitchRequest {
  /** Ordered list of video clips to concatenate */
  clips: ClipInput[];
  /** Narration audio segments with timing */
  narrations?: NarrationInput[];
  /** Background music file path */
  backgroundMusicPath?: string;
  /** Background music volume (0-1, default 0.15 — quiet under narration) */
  musicVolume?: number;
  /** Narration volume (0-1, default 1.0) */
  narrationVolume?: number;
  /** Output aspect ratio */
  aspectRatio?: "16:9" | "9:16" | "1:1";
  /** Output resolution */
  resolution?: { width: number; height: number };
}

export interface StitchResult {
  success: boolean;
  /** Path to the final stitched video */
  outputPath?: string;
  /** Total duration in seconds */
  totalDurationSec?: number;
  error?: string;
}

/**
 * Get the actual duration of a media file using ffprobe.
 */
async function getMediaDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync(FFPROBE_PATH, [
      "-v", "quiet",
      "-show_entries", "format=duration",
      "-of", "csv=p=0",
      filePath,
    ]);
    return parseFloat(stdout.trim()) || 0;
  } catch {
    return 0;
  }
}

/**
 * Create a concat demuxer file for FFmpeg.
 * Lists all clips with their file paths for concatenation.
 */
function createConcatFile(clips: ClipInput[]): string {
  const concatFilePath = join(OUTPUT_DIR, `concat-${randomUUID()}.txt`);
  const lines = clips.map(
    (clip) => `file '${clip.filePath.replace(/'/g, "'\\''")}'`,
  );
  writeFileSync(concatFilePath, lines.join("\n"));
  return concatFilePath;
}

/**
 * Stitch video clips together with narration and background music.
 *
 * Strategy:
 *  1. Concat all clips into one video stream
 *  2. Build a complex audio filter graph:
 *     - Narration segments delayed to correct timestamps and merged
 *     - Background music looped, volume-reduced, and ducked under narration
 *     - All audio mixed to final stereo output
 */
export async function stitchVideo(
  request: StitchRequest,
): Promise<StitchResult> {
  const {
    clips,
    narrations = [],
    backgroundMusicPath,
    musicVolume = 0.15,
    narrationVolume = 1.0,
    aspectRatio = "16:9",
    resolution,
  } = request;

  if (clips.length === 0) {
    return { success: false, error: "No clips provided" };
  }

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const outputFileName = `reel-${randomUUID()}.mp4`;
  const outputPath = join(OUTPUT_DIR, outputFileName);

  // Determine output resolution
  const res = resolution || getResolution(aspectRatio);

  console.log(
    `[VideoStitcher] Stitching ${clips.length} clips, ${narrations.length} narrations, music: ${!!backgroundMusicPath}`,
  );

  try {
    // Step 1: Simple concat if no audio overlays needed
    if (narrations.length === 0 && !backgroundMusicPath) {
      return await simpleConcatStitch(clips, outputPath, res);
    }

    // Step 2: Complex stitch with audio mixing
    return await complexStitch(
      clips,
      narrations,
      backgroundMusicPath,
      musicVolume,
      narrationVolume,
      outputPath,
      res,
    );
  } catch (error) {
    console.error("[VideoStitcher] Stitch failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Video stitching failed",
    };
  }
}

/**
 * Simple concat — just join clips without audio overlay.
 */
async function simpleConcatStitch(
  clips: ClipInput[],
  outputPath: string,
  res: { width: number; height: number },
): Promise<StitchResult> {
  const concatFile = createConcatFile(clips);

  try {
    await execFileAsync(FFMPEG_PATH, [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", concatFile,
      "-vf", `scale=${res.width}:${res.height}:force_original_aspect_ratio=decrease,pad=${res.width}:${res.height}:(ow-iw)/2:(oh-ih)/2`,
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      outputPath,
    ], { timeout: 120000 });

    const totalDuration = clips.reduce((sum, c) => sum + c.durationSec, 0);

    console.log(`[VideoStitcher] Simple concat complete: ${outputPath}`);
    return { success: true, outputPath, totalDurationSec: totalDuration };
  } finally {
    cleanupFile(concatFile);
  }
}

/**
 * Complex stitch — concat clips + mix narration + background music.
 *
 * Uses FFmpeg complex filter graph:
 *  - Input 0: concatenated video
 *  - Input 1..N: narration audio files
 *  - Input N+1: background music (if provided)
 */
async function complexStitch(
  clips: ClipInput[],
  narrations: NarrationInput[],
  backgroundMusicPath: string | undefined,
  musicVolume: number,
  narrationVolume: number,
  outputPath: string,
  res: { width: number; height: number },
): Promise<StitchResult> {
  const concatFile = createConcatFile(clips);
  const totalDuration = clips.reduce((sum, c) => sum + c.durationSec, 0);

  const args: string[] = ["-y"];

  // Input 0: video clips via concat demuxer
  args.push("-f", "concat", "-safe", "0", "-i", concatFile);

  // Inputs 1..N: narration audio files
  for (const narration of narrations) {
    args.push("-i", narration.filePath);
  }

  // Input N+1: background music (if provided)
  const musicInputIndex = narrations.length > 0 ? narrations.length + 1 : 1;
  if (backgroundMusicPath) {
    args.push("-i", backgroundMusicPath);
  }

  // Build complex filter graph
  const filterParts: string[] = [];
  const audioStreams: string[] = [];

  // Scale video
  filterParts.push(
    `[0:v]scale=${res.width}:${res.height}:force_original_aspect_ratio=decrease,pad=${res.width}:${res.height}:(ow-iw)/2:(oh-ih)/2,setsar=1[vout]`,
  );

  // Process narration segments — delay each to its start time
  for (let i = 0; i < narrations.length; i++) {
    const narration = narrations[i];
    const inputIdx = i + 1;
    const delayMs = Math.round(narration.startTimeSec * 1000);
    const streamLabel = `narr${i}`;

    filterParts.push(
      `[${inputIdx}:a]volume=${narrationVolume},adelay=${delayMs}|${delayMs}[${streamLabel}]`,
    );
    audioStreams.push(`[${streamLabel}]`);
  }

  // Process background music — loop it, reduce volume
  if (backgroundMusicPath) {
    const musicIdx = backgroundMusicPath ? narrations.length + 1 : -1;
    const musicLabel = "bgmusic";

    // Loop music to cover total duration, apply volume
    filterParts.push(
      `[${musicIdx}:a]aloop=-1:2e+09,atrim=0:${totalDuration},volume=${musicVolume}[${musicLabel}]`,
    );
    audioStreams.push(`[${musicLabel}]`);
  }

  // Mix all audio streams together
  if (audioStreams.length > 0) {
    const mixInputs = audioStreams.join("");
    filterParts.push(
      `${mixInputs}amix=inputs=${audioStreams.length}:duration=longest:dropout_transition=2[aout]`,
    );
  }

  // Apply filter complex
  args.push("-filter_complex", filterParts.join(";"));

  // Map outputs
  args.push("-map", "[vout]");
  if (audioStreams.length > 0) {
    args.push("-map", "[aout]");
  }

  // Output settings
  args.push(
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "23",
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "44100",
    "-shortest",
    "-movflags", "+faststart",
    outputPath,
  );

  try {
    console.log(`[VideoStitcher] Running FFmpeg complex stitch...`);
    await execFileAsync(FFMPEG_PATH, args, { timeout: 300000 }); // 5 min timeout

    console.log(`[VideoStitcher] Complex stitch complete: ${outputPath}`);
    return { success: true, outputPath, totalDurationSec: totalDuration };
  } catch (error: any) {
    console.error("[VideoStitcher] FFmpeg error:", error.stderr || error.message);

    // Fallback: try simple concat without audio if complex filter fails
    console.log("[VideoStitcher] Falling back to simple concat...");
    return await simpleConcatStitch(clips, outputPath, res);
  } finally {
    cleanupFile(concatFile);
  }
}

/**
 * Get resolution from aspect ratio string.
 */
function getResolution(aspectRatio: string): { width: number; height: number } {
  switch (aspectRatio) {
    case "9:16":
      return { width: 1080, height: 1920 };
    case "1:1":
      return { width: 1080, height: 1080 };
    case "4:5":
      return { width: 1080, height: 1350 };
    case "16:9":
    default:
      return { width: 1920, height: 1080 };
  }
}

/**
 * Clean up temporary files.
 */
function cleanupFile(filePath: string): void {
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Clean up all temporary files from a stitch operation.
 */
export function cleanupTempFiles(
  clips: ClipInput[],
  narrations: NarrationInput[],
): void {
  for (const clip of clips) {
    cleanupFile(clip.filePath);
  }
  for (const narration of narrations) {
    cleanupFile(narration.filePath);
  }
}

/**
 * Check if a media file contains an audio stream using ffprobe.
 */
async function hasAudioStream(filePath: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(FFPROBE_PATH, [
      "-v", "quiet",
      "-select_streams", "a",
      "-show_entries", "stream=codec_type",
      "-of", "csv=p=0",
      filePath,
    ]);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Extract audio track from a video file.
 * Downloads from URL if needed, strips video, returns local audio path + duration.
 * Returns null if the video has no audio stream.
 */
export async function extractAudio(
  videoPathOrUrl: string,
): Promise<{ audioPath: string; duration: number } | null> {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  let inputPath = videoPathOrUrl;
  let tmpVideoPath: string | null = null;

  // Download if URL
  if (videoPathOrUrl.startsWith("http")) {
    tmpVideoPath = join(OUTPUT_DIR, `dl-${randomUUID()}.mp4`);
    console.log(`[extractAudio] Downloading video from URL...`);
    const response = await fetch(videoPathOrUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(tmpVideoPath, buffer);
    inputPath = tmpVideoPath;
  }

  // Check if video actually has an audio stream
  const hasAudio = await hasAudioStream(inputPath);
  if (!hasAudio) {
    console.log(`[extractAudio] Video has no audio stream, skipping extraction`);
    if (tmpVideoPath) cleanupFile(tmpVideoPath);
    return null;
  }

  const outputPath = join(OUTPUT_DIR, `audio-${randomUUID()}.aac`);

  try {
    await execFileAsync(FFMPEG_PATH, [
      "-y",
      "-i", inputPath,
      "-vn",
      "-acodec", "aac",
      "-b:a", "192k",
      "-ar", "44100",
      outputPath,
    ], { timeout: 120000 });

    const duration = await getMediaDuration(outputPath);
    console.log(`[extractAudio] Extracted audio: ${outputPath} (${duration}s)`);

    return { audioPath: outputPath, duration };
  } catch (error) {
    console.error("[extractAudio] FFmpeg error:", error);
    throw new Error("Failed to extract audio from video");
  } finally {
    if (tmpVideoPath) cleanupFile(tmpVideoPath);
  }
}
