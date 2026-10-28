/**
 * Beat-sync utilities in milliseconds (HyperFrames compositions are time-based, not frame-based).
 * Ported from legacy generate-server/lib/audio/beatSync.ts.
 */

export interface BeatMap { bpm: number; beatMs: number; beats: number[]; measures: number[]; totalMs: number }

export function generateBeatMap(bpm: number, totalMs: number, offsetMs = 0): BeatMap {
  const beatMs = 60000 / bpm;
  const beats: number[] = [];
  const measures: number[] = [];
  for (let i = 0, t = offsetMs; t < totalMs; i++, t += beatMs) {
    beats.push(Math.round(t));
    if (i % 4 === 0) measures.push(Math.round(t));
  }
  return { bpm, beatMs, beats, measures, totalMs };
}

export function closest(values: number[], ms: number): number {
  let best = values[0] ?? ms;
  for (const v of values) if (Math.abs(v - ms) < Math.abs(best - ms)) best = v;
  return best;
}

export function snapToBeat(ms: number, map: BeatMap, preferMeasures = false): number {
  return closest(preferMeasures && map.measures.length ? map.measures : map.beats, ms);
}

/** Snap a duration to a whole number of beats (min 1 beat). */
export function snapDurationToBeats(durationMs: number, beatMs: number): number {
  return Math.max(1, Math.round(durationMs / beatMs)) * beatMs;
}

/** Beats inside [startMs, endMs], every Nth beat — trigger points for on-beat animations. */
export function beatKeyframes(startMs: number, endMs: number, map: BeatMap, everyNth = 1): number[] {
  return map.beats.filter((b, i) => b >= startMs && b <= endMs && i % everyNth === 0);
}
