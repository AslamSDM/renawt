/**
 * ffmpeg muxing helpers for the Three.js render engine.
 * Audio is muxed in POST-render (per the architecture decision): the renderer
 * only produces a silent video stream via image2pipe; the worker calls
 * muxAudioIntoVideo afterwards if an audio asset is provided.
 */

import { spawn, spawnSync } from 'child_process'
import type { ChildProcess } from 'child_process'

/**
 * Spawn an ffmpeg process that reads raw MJPEG frames from stdin and encodes a
 * silent video file. Returns the ChildProcess so the caller can write frame
 * buffers to stdin and await its exit. No audio track.
 */
export function spawnFfmpegVideo(
  outputPath: string,
  fps: number,
  width: number,
  height: number,
  outputFormat: 'mp4' | 'webm',
): ChildProcess {
  const videoCodec = outputFormat === 'webm' ? 'vp8' : 'h264'
  const pixFmt = outputFormat === 'webm' ? 'yuv420p' : 'yuv420p'
  const extraArgs = outputFormat === 'webm'
    ? ['-b:v', '5M']
    : ['-preset', 'fast', '-movflags', '+faststart']

  const args = [
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-r', String(fps),
    '-i', '-',
    '-s', `${width}x${height}`,
    '-c:v', videoCodec,
    '-pix_fmt', pixFmt,
    ...extraArgs,
    '-y',
    outputPath,
  ]

  return spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] })
}

/**
 * Mux an audio track into an existing silent video. Runs synchronously via
 * spawnSync. Uses `-shortest` so output length matches the shorter stream
 * (audio is typically shorter than video; video frames drive duration).
 */
export function muxAudioIntoVideo(
  videoPath: string,
  audioPath: string,
  outputPath: string,
): { ok: boolean; error?: string } {
  const result = spawnSync('ffmpeg', [
    '-i', videoPath,
    '-i', audioPath,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-shortest',
    '-y',
    outputPath,
  ], { stdio: 'inherit' })

  if (result.status !== 0) {
    return {
      ok: false,
      error: result.error
        ? result.error.message
        : `ffmpeg exited with status ${result.status ?? 'null'}`,
    }
  }
  return { ok: true }
}