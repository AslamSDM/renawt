import type { BeatMap } from "../types";

// Beat detection using Web Audio API
// Note: This runs client-side in the browser

export interface BeatDetectorOptions {
  minBpm?: number;
  maxBpm?: number;
  threshold?: number;
}

const DEFAULT_OPTIONS: BeatDetectorOptions = {
  minBpm: 80,
  maxBpm: 180,
  threshold: 0.3,
};

// Simple energy-based beat detection
export async function detectBeats(
  audioBuffer: AudioBuffer,
  options: BeatDetectorOptions = {}
): Promise<BeatMap> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  // Calculate energy in windows
  const windowSize = Math.floor(sampleRate * 0.02); // 20ms windows
  const hopSize = Math.floor(windowSize / 2);
  const energies: number[] = [];

  for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
    let energy = 0;
    for (let j = 0; j < windowSize; j++) {
      energy += channelData[i + j] ** 2;
    }
    energies.push(energy / windowSize);
  }

  // Normalize energies
  const maxEnergy = Math.max(...energies);
  const normalizedEnergies = energies.map((e) => e / maxEnergy);

  // Find peaks (potential beats)
  const peaks: number[] = [];
  const threshold = opts.threshold!;

  for (let i = 1; i < normalizedEnergies.length - 1; i++) {
    if (
      normalizedEnergies[i] > threshold &&
      normalizedEnergies[i] > normalizedEnergies[i - 1] &&
      normalizedEnergies[i] > normalizedEnergies[i + 1]
    ) {
      // Convert window index to time in seconds
      const timeInSeconds = (i * hopSize) / sampleRate;
      peaks.push(timeInSeconds);
    }
  }

  // Calculate BPM from peak intervals
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    const interval = peaks[i] - peaks[i - 1];
    const bpm = 60 / interval;
    if (bpm >= opts.minBpm! && bpm <= opts.maxBpm!) {
      intervals.push(interval);
    }
  }

  // Find the most common interval (mode)
  const averageInterval =
    intervals.length > 0
      ? intervals.reduce((a, b) => a + b) / intervals.length
      : 0.5; // Default to 120 BPM

  const bpm = Math.round(60 / averageInterval);

  // Convert peak times to frame numbers (at 30fps)
  const fps = 30;
  const beatFrames = peaks.map((t) => Math.round(t * fps));

  // Detect drops (significant energy increases)
  const drops: number[] = [];
  for (let i = 10; i < normalizedEnergies.length; i++) {
    const recentAvg =
      normalizedEnergies.slice(i - 10, i).reduce((a, b) => a + b) / 10;
    if (normalizedEnergies[i] > recentAvg * 2) {
      const timeInSeconds = (i * hopSize) / sampleRate;
      drops.push(Math.round(timeInSeconds * fps));
    }
  }

  return {
    bpm: Math.max(opts.minBpm!, Math.min(opts.maxBpm!, bpm)),
    beats: beatFrames,
    drops: [...new Set(drops)], // Remove duplicates
  };
}

// Analyze audio from URL (browser only)
export async function analyzeAudioFromUrl(url: string): Promise<BeatMap> {
  if (typeof window === "undefined") {
    throw new Error("Beat detection must run in browser environment");
  }

  const audioContext = new AudioContext();
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  return detectBeats(audioBuffer);
}

// Generate beat map from BPM (for when audio analysis isn't available)
export function generateBeatMapFromBpm(
  bpm: number,
  durationInFrames: number,
  fps: number = 30
): BeatMap {
  const framesPerBeat = Math.round((60 / bpm) * fps);
  const beats: number[] = [];

  for (let frame = 0; frame < durationInFrames; frame += framesPerBeat) {
    beats.push(frame);
  }

  // Generate drops every 4 bars (16 beats)
  const framesPerBar = framesPerBeat * 4;
  const drops: number[] = [];
  for (let frame = 0; frame < durationInFrames; frame += framesPerBar * 4) {
    drops.push(frame);
  }

  return {
    bpm,
    beats,
    drops,
  };
}

// Check if a frame is on a beat
export function isOnBeat(
  frame: number,
  beatMap: BeatMap,
  tolerance: number = 2
): boolean {
  return beatMap.beats.some((beat) => Math.abs(frame - beat) <= tolerance);
}

// Check if a frame is on a drop
export function isOnDrop(
  frame: number,
  beatMap: BeatMap,
  tolerance: number = 2
): boolean {
  return beatMap.drops.some((drop) => Math.abs(frame - drop) <= tolerance);
}

// Get the nearest beat frame
export function getNearestBeat(frame: number, beatMap: BeatMap): number {
  return beatMap.beats.reduce((nearest, beat) =>
    Math.abs(beat - frame) < Math.abs(nearest - frame) ? beat : nearest
  );
}

// Snap a frame to the nearest beat
export function snapToBeat(
  frame: number,
  beatMap: BeatMap,
  maxDistance: number = 5
): number {
  const nearest = getNearestBeat(frame, beatMap);
  return Math.abs(nearest - frame) <= maxDistance ? nearest : frame;
}

export default {
  detectBeats,
  analyzeAudioFromUrl,
  generateBeatMapFromBpm,
  isOnBeat,
  isOnDrop,
  getNearestBeat,
  snapToBeat,
};
