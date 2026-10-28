import { spawnSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { uploadAudioBufferToR2, isR2Configured } from "../storage/r2";

export interface SfxClip {
  url: string;
  startMs: number;
  durationMs: number;
  volume: number;
  label: string;
}

export interface SfxScene {
  sceneIndex: number;
  sceneLabel: string;
  clips: SfxClip[];
}

export interface SfxOutput {
  scenes: SfxScene[];
  mixUrl?: string;
  clipUrls: string[];
}

const SFX_TEMP_DIR = join(process.cwd(), "tmp", "sfx");
if (!existsSync(SFX_TEMP_DIR)) {
  mkdirSync(SFX_TEMP_DIR, { recursive: true });
}

function writeWav(samples: number[], sampleRate: number): Buffer {
  const bitsPerSample = 16;
  const numChannels = 1;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * (bitsPerSample / 8);
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = Buffer.alloc(totalSize);
  let offset = 0;

  buffer.write("RIFF", offset); offset += 4;
  buffer.writeUInt32LE(totalSize - 8, offset); offset += 4;
  buffer.write("WAVE", offset); offset += 4;

  buffer.write("fmt ", offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4;
  buffer.writeUInt16LE(1, offset); offset += 2;
  buffer.writeUInt16LE(numChannels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(byteRate, offset); offset += 4;
  buffer.writeUInt16LE(blockAlign, offset); offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

  buffer.write("data", offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;

  for (let i = 0; i < samples.length; i++) {
    const val = Math.max(-1, Math.min(1, samples[i]));
    const intVal = val < 0 ? val * 0x8000 : val * 0x7FFF;
    buffer.writeInt16LE(Math.round(intVal), offset);
    offset += 2;
  }

  return buffer;
}

function generateSweep(
  freqStart: number,
  freqEnd: number,
  durationMs: number,
  noiseAmount: number,
  outputPath: string,
): string {
  const durSec = durationMs / 1000;
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * durSec);

  const samples: number[] = [];
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const progress = t / durSec;
    const freq = freqStart + (freqEnd - freqStart) * progress;
    const amplitude = Math.sin(progress * Math.PI) * 0.3;
    const tone = Math.sin(2 * Math.PI * freq * t) * amplitude * (1 - noiseAmount * 0.5);
    const noise = (Math.random() * 2 - 1) * amplitude * noiseAmount * 0.5;
    samples.push(Math.max(-1, Math.min(1, tone + noise)));
  }

  writeFileSync(outputPath, writeWav(samples, sampleRate));
  return outputPath;
}

function generatePercussive(
  durationMs: number,
  outputPath: string,
  style: "click" | "impact" | "pop" | "tap",
): string {
  const durSec = durationMs / 1000;
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * durSec);

  const decayRates: Record<string, number> = {
    click: 20, impact: 8, pop: 12, tap: 18,
  };
  const baseFreqs: Record<string, number[]> = {
    click: [1000],
    impact: [80, 160],
    pop: [400, 800],
    tap: [600, 1200],
  };
  const decay = decayRates[style] ?? 20;
  const freqs = baseFreqs[style] ?? [1000];

  const samples: number[] = [];
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.exp(-(t / durSec) * decay);
    let value = 0;
    for (const f of freqs) {
      value += Math.sin(2 * Math.PI * f * t) * envelope * (0.4 / freqs.length);
    }
    samples.push(Math.max(-1, Math.min(1, value)));
  }

  writeFileSync(outputPath, writeWav(samples, sampleRate));
  return outputPath;
}

function generateChime(
  durationMs: number,
  outputPath: string,
  pitch: "high" | "mid" | "low",
): string {
  const durSec = durationMs / 1000;
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * durSec);
  const baseFreq = pitch === "high" ? 1760 : pitch === "low" ? 440 : 880;

  const samples: number[] = [];
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const progress = t / durSec;
    const envelope = Math.exp(-progress * 4);
    const value =
      Math.sin(2 * Math.PI * baseFreq * t) * envelope * 0.3 +
      Math.sin(2 * Math.PI * baseFreq * 2 * t) * envelope * 0.15 +
      Math.sin(2 * Math.PI * baseFreq * 3 * t) * envelope * 0.08;
    samples.push(Math.max(-1, Math.min(1, value)));
  }

  writeFileSync(outputPath, writeWav(samples, sampleRate));
  return outputPath;
}

function mixSfxWithTiming(clips: SfxClip[], outputPath: string): string {
  const sampleRate = 44100;
  const bitsPerSample = 16;
  const numChannels = 1;

  const maxEndMs = Math.max(...clips.map((c) => c.startMs + c.durationMs));
  const totalSamples = Math.ceil((maxEndMs / 1000) * sampleRate);

  const mixBuf = new Float32Array(totalSamples);

  for (const clip of clips) {
    const startSample = Math.floor((clip.startMs / 1000) * sampleRate);
    const numSamples = Math.ceil((clip.durationMs / 1000) * sampleRate);

    let wavBuf: Buffer;
    try {
      wavBuf = readFileSync(clip.url);
    } catch {
      continue;
    }

    const dataOffset = 44;
    const frameSize = (bitsPerSample / 8) * numChannels;
    const maxFrames = Math.floor((wavBuf.length - dataOffset) / frameSize);

    for (let i = 0; i < numSamples && i < maxFrames && startSample + i < totalSamples; i++) {
      const sampleOffset = dataOffset + i * frameSize;
      let val = wavBuf.readInt16LE(sampleOffset);
      val = (val / 32768) * clip.volume;
      mixBuf[startSample + i] += Math.max(-1, Math.min(1, val));
    }
  }

  let maxVal = 0;
  for (let i = 0; i < totalSamples; i++) {
    const abs = Math.abs(mixBuf[i]);
    if (abs > maxVal) maxVal = abs;
  }
  const normalize = maxVal > 1 ? 1 / maxVal : 1;

  const wavBuffer = Buffer.alloc(44 + totalSamples * 2);
  let offset = 0;
  wavBuffer.write("RIFF", offset); offset += 4;
  wavBuffer.writeUInt32LE(44 + totalSamples * 2 - 8, offset); offset += 4;
  wavBuffer.write("WAVE", offset); offset += 4;
  wavBuffer.write("fmt ", offset); offset += 4;
  wavBuffer.writeUInt32LE(16, offset); offset += 4;
  wavBuffer.writeUInt16LE(1, offset); offset += 2;
  wavBuffer.writeUInt16LE(numChannels, offset); offset += 2;
  wavBuffer.writeUInt32LE(sampleRate, offset); offset += 4;
  wavBuffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), offset); offset += 4;
  wavBuffer.writeUInt16LE(numChannels * (bitsPerSample / 8), offset); offset += 2;
  wavBuffer.writeUInt16LE(bitsPerSample, offset); offset += 2;
  wavBuffer.write("data", offset); offset += 4;
  wavBuffer.writeUInt32LE(totalSamples * 2, offset); offset += 4;

  for (let i = 0; i < totalSamples; i++) {
    const val = Math.max(-1, Math.min(1, mixBuf[i] * normalize));
    const intVal = val < 0 ? val * 0x8000 : val * 0x7FFF;
    wavBuffer.writeInt16LE(Math.round(intVal), offset);
    offset += 2;
  }

  const wavPath = outputPath.replace(/\.mp3$/, ".wav");
  writeFileSync(wavPath, wavBuffer);

  const result = spawnSync("ffmpeg", [
    "-i", wavPath,
    "-c:a", "aac",
    "-y", outputPath,
  ], { stdio: "inherit" });

  try { unlinkSync(wavPath); } catch {}

  if (result.status !== 0) throw new Error(`SFX mix encoding failed with status ${result.status}`);
  return outputPath;
}

export type SfxType =
  | "whoosh"
  | "swoosh"
  | "click"
  | "pop"
  | "impact"
  | "tap"
  | "chime_high"
  | "chime_mid"
  | "chime_low";

export interface SfxRequest {
  type: SfxType;
  startMs: number;
  durationMs?: number;
  volume?: number;
  sceneLabel?: string;
  sceneIndex?: number;
}

export interface SfxPlan {
  requests: SfxRequest[];
  description: string;
}

export async function generateSfx(
  requests: SfxRequest[],
  tag: string,
): Promise<SfxOutput> {
  if (!requests.length) {
    return { scenes: [], clipUrls: [] };
  }

  const tagDir = join(SFX_TEMP_DIR, tag);
  if (!existsSync(tagDir)) mkdirSync(tagDir, { recursive: true });

  const clips: SfxClip[] = [];

  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    const dur = req.durationMs ?? 300;
    const vol = req.volume ?? 0.5;
    const path = join(tagDir, `sfx-${i}.wav`);

    let label: string;
    switch (req.type) {
      case "whoosh":
        generateSweep(200, 3000, dur, 0.3, path);
        label = `whoosh_${i}`;
        break;
      case "swoosh":
        generateSweep(100, 2500, dur, 0.6, path);
        label = `swoosh_${i}`;
        break;
      case "click":
        generatePercussive(dur, path, "click");
        label = `click_${i}`;
        break;
      case "pop":
        generatePercussive(dur, path, "pop");
        label = `pop_${i}`;
        break;
      case "impact":
        generatePercussive(dur, path, "impact");
        label = `impact_${i}`;
        break;
      case "tap":
        generatePercussive(dur, path, "tap");
        label = `tap_${i}`;
        break;
      case "chime_high":
        generateChime(dur, path, "high");
        label = `chime_high_${i}`;
        break;
      case "chime_mid":
        generateChime(dur, path, "mid");
        label = `chime_mid_${i}`;
        break;
      case "chime_low":
        generateChime(dur, path, "low");
        label = `chime_low_${i}`;
        break;
      default:
        generatePercussive(dur, path, "click");
        label = `click_${i}`;
    }

    clips.push({
      url: path,
      startMs: req.startMs,
      durationMs: dur,
      volume: vol,
      label,
    });
  }

  const sceneMap = new Map<number, SfxScene>();
  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    const si = req.sceneIndex ?? 0;
    if (!sceneMap.has(si)) {
      sceneMap.set(si, {
        sceneIndex: si,
        sceneLabel: req.sceneLabel ?? `scene_${si}`,
        clips: [],
      });
    }
    sceneMap.get(si)!.clips.push(clips[i]);
  }

  const scenes: SfxScene[] = Array.from(sceneMap.values()).sort(
    (a, b) => a.sceneIndex - b.sceneIndex,
  );

  const clipUrls: string[] = [];
  if (isR2Configured()) {
    for (let i = 0; i < clips.length; i++) {
      try {
        const buf = readFileSync(clips[i].url);
        const up = await uploadAudioBufferToR2(buf, "audio/wav", "sfx/clips", `${tag}-${i}`);
        if (up.success && up.url) {
          clipUrls.push(up.url);
          clips[i].url = up.url;
        } else {
          clipUrls.push(clips[i].url);
        }
      } catch {
        clipUrls.push(clips[i].url);
      }
    }
  } else {
    clipUrls.push(...clips.map((c) => c.url));
  }

  const mixedPath = join(tagDir, "sfx-mixed.mp3");
  try {
    mixSfxWithTiming(clips, mixedPath);
    let mixUrl: string = mixedPath;
    if (isR2Configured()) {
      const buf = readFileSync(mixedPath);
      const up = await uploadAudioBufferToR2(buf, "audio/mpeg", "sfx/mixes", tag);
      if (up.success && up.url) mixUrl = up.url;
    }
    return { scenes, mixUrl, clipUrls };
  } catch (e) {
    console.warn("[sfxGenerator] Mix failed, returning individual clips:", e);
    return { scenes, clipUrls };
  }
}