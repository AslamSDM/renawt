/**
 * Beat Sync Utilities for Remotion
 *
 * Generates beat maps from BPM and provides utilities for
 * synchronizing animations to music beats.
 */

export interface BeatMap {
  bpm: number;
  framesPerBeat: number;
  beats: number[]; // Array of frame numbers where beats occur
  measures: number[]; // Every 4th beat (start of measures)
  totalDuration: number;
}

export interface BeatSyncOptions {
  bpm: number;
  totalDurationFrames: number;
  fps?: number;
  offset?: number; // Frame offset for beat start
}

/**
 * Generate a beat map from BPM and duration
 * @param options Beat sync configuration
 * @returns BeatMap with frame numbers for each beat
 */
export function generateBeatMap(options: BeatSyncOptions): BeatMap {
  const { bpm, totalDurationFrames, fps = 30, offset = 0 } = options;

  // Calculate frames per beat
  // BPM = beats per minute
  // FPS = frames per second
  // Frames per beat = (FPS * 60) / BPM
  const framesPerBeat = (fps * 60) / bpm;

  const beats: number[] = [];
  const measures: number[] = [];

  let beatFrame = offset;
  let beatIndex = 0;

  while (beatFrame < totalDurationFrames) {
    beats.push(Math.round(beatFrame));

    // Mark measure starts (every 4 beats in 4/4 time)
    if (beatIndex % 4 === 0) {
      measures.push(Math.round(beatFrame));
    }

    beatFrame += framesPerBeat;
    beatIndex++;
  }

  return {
    bpm,
    framesPerBeat,
    beats,
    measures,
    totalDuration: totalDurationFrames,
  };
}

/**
 * Find the closest beat to a given frame
 */
export function getClosestBeat(frame: number, beatMap: BeatMap): number {
  let closest = beatMap.beats[0];
  let minDiff = Math.abs(frame - closest);

  for (const beat of beatMap.beats) {
    const diff = Math.abs(frame - beat);
    if (diff < minDiff) {
      minDiff = diff;
      closest = beat;
    }
  }

  return closest;
}

/**
 * Get the next beat after a given frame
 */
export function getNextBeat(frame: number, beatMap: BeatMap): number | null {
  for (const beat of beatMap.beats) {
    if (beat > frame) {
      return beat;
    }
  }
  return null;
}

/**
 * Get the previous beat before a given frame
 */
export function getPreviousBeat(
  frame: number,
  beatMap: BeatMap,
): number | null {
  let previous: number | null = null;
  for (const beat of beatMap.beats) {
    if (beat >= frame) {
      break;
    }
    previous = beat;
  }
  return previous;
}

/**
 * Check if current frame is within a certain range of a beat
 */
export function isOnBeat(
  frame: number,
  beatMap: BeatMap,
  tolerance: number = 2,
): boolean {
  return beatMap.beats.some((beat) => Math.abs(frame - beat) <= tolerance);
}

/**
 * Check if current frame is on a measure start (every 4 beats)
 */
export function isOnMeasure(
  frame: number,
  beatMap: BeatMap,
  tolerance: number = 2,
): boolean {
  return beatMap.measures.some(
    (measure) => Math.abs(frame - measure) <= tolerance,
  );
}

/**
 * Get beat progress (0-1) within the current beat
 * Useful for smooth animations between beats
 */
export function getBeatProgress(frame: number, beatMap: BeatMap): number {
  const { framesPerBeat, beats } = beatMap;

  // Find which beat we're currently in
  let currentBeatStart = beats[0];
  for (const beat of beats) {
    if (beat <= frame) {
      currentBeatStart = beat;
    } else {
      break;
    }
  }

  const framesSinceBeat = frame - currentBeatStart;
  return Math.min(1, framesSinceBeat / framesPerBeat);
}

/**
 * Get measure progress (0-1) within the current measure (4 beats)
 */
export function getMeasureProgress(frame: number, beatMap: BeatMap): number {
  const { framesPerBeat, measures } = beatMap;
  const framesPerMeasure = framesPerBeat * 4;

  let currentMeasureStart = measures[0];
  for (const measure of measures) {
    if (measure <= frame) {
      currentMeasureStart = measure;
    } else {
      break;
    }
  }

  const framesSinceMeasure = frame - currentMeasureStart;
  return Math.min(1, framesSinceMeasure / framesPerMeasure);
}

/**
 * Snap a frame number to the nearest beat
 */
export function snapToBeat(frame: number, beatMap: BeatMap): number {
  return getClosestBeat(frame, beatMap);
}

/**
 * Align scene transitions to beats
 * Takes an array of scene end frames and adjusts them to align with beats
 */
export function alignScenesToBeats(
  sceneEndFrames: number[],
  beatMap: BeatMap,
  preferMeasures: boolean = true,
): number[] {
  const targetBeats = preferMeasures ? beatMap.measures : beatMap.beats;

  return sceneEndFrames.map((frame) => {
    let closest = targetBeats[0];
    let minDiff = Math.abs(frame - closest);

    for (const beat of targetBeats) {
      const diff = Math.abs(frame - beat);
      if (diff < minDiff) {
        minDiff = diff;
        closest = beat;
      }
    }

    return closest;
  });
}

/**
 * Generate animation keyframes aligned to beats
 * Returns frame numbers where animations should trigger
 */
export function generateBeatKeyframes(
  startFrame: number,
  endFrame: number,
  beatMap: BeatMap,
  everyNthBeat: number = 1,
): number[] {
  const keyframes: number[] = [];

  beatMap.beats.forEach((beat, index) => {
    if (beat >= startFrame && beat <= endFrame) {
      if (index % everyNthBeat === 0) {
        keyframes.push(beat);
      }
    }
  });

  return keyframes;
}

/**
 * Calculate optimal transition duration based on beat timing
 */
export function getOptimalTransitionDuration(
  beatMap: BeatMap,
  beatCount: number = 1,
): number {
  return Math.round(beatMap.framesPerBeat * beatCount);
}

// Common BPM presets for different moods
export const BPM_PRESETS = {
  slow: 80,
  chill: 100,
  moderate: 120,
  upbeat: 130,
  energetic: 140,
  fast: 160,
} as const;

// Helper to get suggested BPM from mood
export function getBpmFromMood(
  mood: "energetic" | "calm" | "dramatic" | "playful",
): number {
  switch (mood) {
    case "energetic":
      return 140;
    case "calm":
      return 90;
    case "dramatic":
      return 110;
    case "playful":
      return 125;
    default:
      return 120;
  }
}
