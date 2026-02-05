// ============================================
// BeatMap Types
// ============================================
export interface BeatMap {
  bpm: number;
  framesPerBeat: number;
  beats: number[];
  downbeats: number[];
  measures: number[];
  energy: number[];
  drops: number[];
  totalDuration: number;
}

// ============================================
// useBeatMap Hook
// React hook to access beat map in Remotion components
// ============================================
import { useContext, createContext } from "react";

const BeatMapContext = createContext<BeatMap | null>(null);

export const BeatMapProvider = BeatMapContext.Provider;

export function useBeatMap(): BeatMap {
  const beatMap = useContext(BeatMapContext);
  if (!beatMap) {
    // Return a default beat map if none provided
    return {
      bpm: 120,
      framesPerBeat: 15,
      beats: [],
      downbeats: [],
      measures: [],
      energy: [],
      drops: [],
      totalDuration: 1800,
    };
  }
  return beatMap;
}

// ============================================
// Beat Detection Utilities
// ============================================

/**
 * Detect beats from audio data using simple peak detection
 * For production, use Essentia.js or other audio analysis libraries
 */
export function detectBeatsFromAudioData(
  audioData: Float32Array,
  sampleRate: number,
  fps: number = 30
): BeatMap {
  const bpm = 120; // Placeholder - would be detected from audio
  const framesPerBeat = Math.round((60 / bpm) * fps);
  const durationInSeconds = audioData.length / sampleRate;
  const totalFrames = Math.round(durationInSeconds * fps);

  // Generate beat positions
  const beats: number[] = [];
  const downbeats: number[] = [];
  const measures: number[] = [];

  for (let frame = 0; frame < totalFrames; frame += framesPerBeat) {
    beats.push(frame);

    // Every 4th beat is a downbeat
    if (beats.length % 4 === 1) {
      downbeats.push(frame);
    }

    // Every 4 beats is a measure
    if (beats.length % 4 === 1) {
      measures.push(frame);
    }
  }

  // Generate energy curve (placeholder)
  const energy: number[] = new Array(totalFrames).fill(0);
  for (let i = 0; i < totalFrames; i++) {
    // Create a synthetic energy curve
    energy[i] = 0.3 + Math.sin(i * 0.1) * 0.2 + Math.random() * 0.1;
  }

  // Detect drops (energy spikes)
  const drops: number[] = [];
  for (let i = 1; i < energy.length - 1; i++) {
    if (energy[i] > energy[i - 1] && energy[i] > energy[i + 1] && energy[i] > 0.7) {
      drops.push(i);
    }
  }

  return {
    bpm,
    framesPerBeat,
    beats,
    downbeats,
    measures,
    energy,
    drops,
    totalDuration: totalFrames,
  };
}

/**
 * Create a beat map from BPM for testing
 */
export function createBeatMapFromBPM(
  bpm: number,
  durationInSeconds: number,
  fps: number = 30
): BeatMap {
  const framesPerBeat = Math.round((60 / bpm) * fps);
  const totalFrames = Math.round(durationInSeconds * fps);

  const beats: number[] = [];
  const downbeats: number[] = [];
  const measures: number[] = [];

  for (let frame = 0; frame < totalFrames; frame += framesPerBeat) {
    beats.push(frame);

    if (beats.length % 4 === 1) {
      downbeats.push(frame);
      measures.push(frame);
    }
  }

  // Synthetic energy curve
  const energy: number[] = new Array(totalFrames).fill(0);
  for (let i = 0; i < totalFrames; i++) {
    // Create pulsing energy on beats
    const beatProgress = (i % framesPerBeat) / framesPerBeat;
    const beatPulse = Math.exp(-beatProgress * 3) * 0.5;
    energy[i] = 0.2 + beatPulse + Math.random() * 0.1;
  }

  // Detect drops
  const drops: number[] = [];
  for (let i = 0; i < totalFrames; i += framesPerBeat * 16) {
    drops.push(i);
  }

  return {
    bpm,
    framesPerBeat,
    beats,
    downbeats,
    measures,
    energy,
    drops,
    totalDuration: totalFrames,
  };
}

// ============================================
// Audio Analysis with Web Audio API
// ============================================

/**
 * Analyze audio file to extract beats and energy
 */
export async function analyzeAudioFile(
  audioFile: File | string,
  fps: number = 30
): Promise<BeatMap> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

  // Load audio file
  let arrayBuffer: ArrayBuffer;
  if (typeof audioFile === "string") {
    const response = await fetch(audioFile);
    arrayBuffer = await response.arrayBuffer();
  } else {
    arrayBuffer = await audioFile.arrayBuffer();
  }

  // Decode audio data
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Get audio data from first channel
  const channelData = audioBuffer.getChannelData(0);

  // Simple BPM detection using autocorrelation (placeholder implementation)
  // For production, use a library like Essentia.js or Meyda
  const bpm = await detectBPM(channelData, audioBuffer.sampleRate);

  return detectBeatsFromAudioData(channelData, audioBuffer.sampleRate, fps);
}

/**
 * Simple BPM detection using autocorrelation
 * This is a basic implementation - for production use a dedicated library
 */
async function detectBPM(audioData: Float32Array, sampleRate: number): Promise<number> {
  // Calculate energy envelope
  const hopSize = Math.floor(sampleRate / 100); // 10ms hops
  const energies: number[] = [];

  for (let i = 0; i < audioData.length; i += hopSize) {
    let sum = 0;
    for (let j = 0; j < hopSize && i + j < audioData.length; j++) {
      sum += audioData[i + j] * audioData[i + j];
    }
    energies.push(Math.sqrt(sum / hopSize));
  }

  // Simple peak detection to estimate BPM
  const peaks: number[] = [];
  for (let i = 1; i < energies.length - 1; i++) {
    if (energies[i] > energies[i - 1] && energies[i] > energies[i + 1]) {
      peaks.push(i);
    }
  }

  // Calculate average time between peaks
  if (peaks.length < 2) return 120; // Default fallback

  let totalDiff = 0;
  for (let i = 1; i < peaks.length; i++) {
    totalDiff += peaks[i] - peaks[i - 1];
  }
  const avgDiff = totalDiff / (peaks.length - 1);

  // Convert to BPM (hopSize samples = 10ms)
  const bpm = Math.round(60000 / (avgDiff * 10));

  // Clamp to reasonable range
  return Math.max(60, Math.min(200, bpm));
}

// ============================================
// Music Library Types
// ============================================
export interface MusicTrack {
  id: string;
  name: string;
  artist?: string;
  url: string;
  bpm: number;
  duration: number;
  genre: "electronic" | "upbeat" | "corporate" | "dramatic" | "ambient";
  energy: "high" | "medium" | "low";
  mood: string[];
}

// Pre-defined music library for common use cases
export const defaultMusicLibrary: MusicTrack[] = [
  {
    id: "audio1",
    name: "Audio 1",
    artist: "User Upload",
    url: "/audio/audio1.mp3",
    bpm: 120, // Will be detected
    duration: 60,
    genre: "electronic",
    energy: "high",
    mood: ["energetic", "modern"],
  },
  {
    id: "upbeat-1",
    name: "Tech Drive",
    artist: "Stock Music",
    url: "/music/tech-drive.mp3",
    bpm: 128,
    duration: 60,
    genre: "electronic",
    energy: "high",
    mood: ["energetic", "modern", "tech"],
  },
  {
    id: "corporate-1",
    name: "Business Rise",
    artist: "Stock Music",
    url: "/music/business-rise.mp3",
    bpm: 110,
    duration: 60,
    genre: "corporate",
    energy: "medium",
    mood: ["professional", "motivational", "upbeat"],
  },
  {
    id: "dramatic-1",
    name: "Epic Launch",
    artist: "Stock Music",
    url: "/music/epic-launch.mp3",
    bpm: 140,
    duration: 60,
    genre: "dramatic",
    energy: "high",
    mood: ["epic", "cinematic", "bold"],
  },
  {
    id: "electronic-1",
    name: "Digital Pulse",
    artist: "Stock Music",
    url: "/music/digital-pulse.mp3",
    bpm: 125,
    duration: 60,
    genre: "electronic",
    energy: "high",
    mood: ["electronic", "pumping", "driving"],
  },
  {
    id: "ambient-1",
    name: "Smooth Flow",
    artist: "Stock Music",
    url: "/music/smooth-flow.mp3",
    bpm: 90,
    duration: 60,
    genre: "ambient",
    energy: "low",
    mood: ["calm", "smooth", "relaxed"],
  },
];

/**
 * Get recommended music track based on video parameters
 */
export function getRecommendedTrack(
  productType: string,
  tempo: "fast" | "medium" | "slow",
  energy: "high" | "medium" | "low"
): MusicTrack {
  // Filter by tempo and energy
  const matches = defaultMusicLibrary.filter((track) => {
    const tempoMatch =
      tempo === "fast"
        ? track.bpm >= 120
        : tempo === "medium"
        ? track.bpm >= 100 && track.bpm < 120
        : track.bpm < 100;

    return tempoMatch && track.energy === energy;
  });

  // Return first match or fallback to first track
  return matches[0] || defaultMusicLibrary[0];
}

// ============================================
// Server-side Audio Analysis using ffprobe
// ============================================

export interface AudioMetadata {
  duration: number; // in seconds
  sampleRate: number;
  channels: number;
  bitrate: number;
  format: string;
}

/**
 * Analyze audio file using ffprobe (server-side)
 */
export async function analyzeAudioWithFFprobe(
  filePath: string
): Promise<AudioMetadata & { bpm: number }> {
  // This would run on the server using child_process
  // For now, return default values - the actual implementation
  // would call ffprobe
  const defaultMetadata: AudioMetadata & { bpm: number } = {
    duration: 60,
    sampleRate: 44100,
    channels: 2,
    bitrate: 320000,
    format: "mp3",
    bpm: 120, // Default BPM - would be detected
  };

  if (typeof window !== "undefined") {
    // Client-side - return defaults
    return defaultMetadata;
  }

  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    // Get audio duration and metadata
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`
    );
    const data = JSON.parse(stdout);

    const format = data.format || {};
    const stream = data.streams?.find((s: any) => s.codec_type === "audio") || {};

    return {
      duration: parseFloat(format.duration) || 60,
      sampleRate: parseInt(stream.sample_rate) || 44100,
      channels: stream.channels || 2,
      bitrate: parseInt(format.bit_rate) || 320000,
      format: format.format_name || "mp3",
      bpm: 120, // Would need separate BPM detection
    };
  } catch (error) {
    console.error("[Audio] ffprobe error:", error);
    return defaultMetadata;
  }
}

/**
 * Get audio duration in frames
 */
export function getAudioDurationInFrames(
  durationSeconds: number,
  fps: number = 30
): number {
  return Math.ceil(durationSeconds * fps);
}

/**
 * Generate beat map from audio file with automatic BPM detection
 */
export async function generateBeatMapFromAudio(
  audioPath: string,
  fps: number = 30,
  manualBpm?: number
): Promise<BeatMap> {
  const metadata = await analyzeAudioWithFFprobe(audioPath);
  const bpm = manualBpm || metadata.bpm;

  return createBeatMapFromBPM(bpm, metadata.duration, fps);
}
