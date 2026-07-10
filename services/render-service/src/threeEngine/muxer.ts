import { spawnSync } from "child_process";

export function muxAudioIntoVideo(
  videoPath: string,
  audioPath: string,
  outputPath: string,
): { ok: boolean; error?: string } {
  const result = spawnSync(
    "ffmpeg",
    [
      "-i", videoPath,
      "-i", audioPath,
      "-c:v", "copy",
      "-c:a", "aac",
      "-shortest",
      "-y",
      outputPath,
    ],
    { stdio: "pipe", encoding: "utf-8" },
  );

  if (result.status !== 0) {
    return {
      ok: false,
      error: result.stderr?.slice(0, 500) || `ffmpeg exited with status ${result.status}`,
    };
  }

  return { ok: true };
}
