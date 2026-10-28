// Audio utilities exports
export {
  generateBeatMap,
  getClosestBeat,
  getNextBeat,
  getPreviousBeat,
  isOnBeat,
  isOnMeasure,
  getBeatProgress,
  getMeasureProgress,
  snapToBeat,
  alignScenesToBeats,
  generateBeatKeyframes,
  getOptimalTransitionDuration,
  getBpmFromMood,
  BPM_PRESETS,
} from "./beatSync";

export type { BeatMap, BeatSyncOptions } from "./beatSync";

// R2 Audio Service exports
export {
  ensureAudioAvailable,
  getDefaultAudioFile,
  getAudioConfig,
  initializeAudioService,
} from "./audioService";

export type { LocalAudioFile } from "./audioService";
