/**
 * ElevenLabs Text-to-Speech Service
 *
 * generateNarration      — returns MP3 buffer (no temp files, for upload flows)
 * generateNarrationSegments — writes to disk (for FFmpeg/reel stitching)
 * generateNarrationWithTimestamps — word-level caption data
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const NARRATION_DIR = join(process.cwd(), "tmp", "narrations");
const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

// Friendly voice map — keys usable by callers, values are ElevenLabs voice IDs
export const VOICE_MAP: Record<string, { id: string; label: string }> = {
  rachel:   { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel — clear, professional female" },
  sarah:    { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah — warm female" },
  lily:     { id: "pFZP5JQG7iQjIQuC4Bku", label: "Lily — clear female" },
  adam:     { id: "pNInz6obpgDQGcFmaJgB", label: "Adam — confident male" },
  brian:    { id: "nPczCjzI2devNBz1zQrb", label: "Brian — casual male" },
  alice:    { id: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice — British female" },
  george:   { id: "JBFqnCBsd6RMkjVDRZzb", label: "George — British male" },
  daniel:   { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel — authoritative British male" },
  elli:     { id: "MF3mGyEYCl7XYWbV9V6O", label: "Elli — emotional, young female" },
  sam:      { id: "yoZ06aMxZJJ28mfd3POQ", label: "Sam — raspy, strong male" },
};

const DEFAULT_VOICE_ID =
  process.env.ELEVENLABS_VOICE_ID || VOICE_MAP.rachel.id;

export interface NarrationRequest {
  text: string;
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  modelId?: string;
}

export interface NarrationResult {
  success: boolean;
  /** Raw MP3 buffer — caller is responsible for uploading/disposing */
  buffer?: Buffer;
  estimatedDurationSec?: number;
  error?: string;
}

export interface WordCaption {
  word: string;
  start: number;
  end: number;
}

export interface TimestampedNarrationResult extends NarrationResult {
  wordCaptions?: WordCaption[];
  captionChunks?: { text: string; start: number; end: number }[];
  audioDurationSec?: number;
  hasTimestamps: boolean;
}

export interface NarrationSegment {
  sceneId: string;
  text: string;
  /** Local file path — populated by generateNarrationSegments (for FFmpeg stitching) */
  filePath?: string;
  durationSec?: number;
}

export function isElevenLabsConfigured(): boolean {
  return !!ELEVENLABS_API_KEY;
}

export function estimateNarrationDuration(text: string): number {
  const wordCount = text.trim().split(/\s+/).length;
  return Math.max(1, wordCount / 2.5);
}

/** Resolve a voice key ("adam", "sarah", etc.) or raw voice ID to an ElevenLabs voice ID */
export function resolveVoiceId(voiceIdOrKey?: string): string {
  if (!voiceIdOrKey) return DEFAULT_VOICE_ID;
  const mapped = VOICE_MAP[voiceIdOrKey.toLowerCase()];
  return mapped ? mapped.id : voiceIdOrKey;
}

/**
 * Generate narration audio. Returns an MP3 buffer — no temp files.
 */
export async function generateNarration(
  request: NarrationRequest,
): Promise<NarrationResult> {
  if (!ELEVENLABS_API_KEY) {
    return { success: false, error: "ELEVENLABS_API_KEY is not set" };
  }

  const {
    text,
    voiceId,
    stability = 0.5,
    similarityBoost = 0.75,
    style = 0.0,
    modelId = "eleven_multilingual_v2",
  } = request;

  if (!text?.trim()) {
    return { success: false, error: "Narration text is empty" };
  }

  const resolvedVoiceId = resolveVoiceId(voiceId);
  console.log(
    `[ElevenLabs] Generating narration (${text.split(/\s+/).length} words, voice: ${resolvedVoiceId})`,
  );

  try {
    const response = await fetch(
      `${ELEVENLABS_BASE_URL}/text-to-speech/${resolvedVoiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY,
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            style,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!response.ok) {
      const err = await response.text();
      console.error(`[ElevenLabs] API error ${response.status}: ${err}`);
      return { success: false, error: `ElevenLabs API ${response.status}: ${err}` };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const estimatedDurationSec = estimateNarrationDuration(text);
    console.log(`[ElevenLabs] Generated ${buffer.length} bytes (~${estimatedDurationSec.toFixed(1)}s)`);

    return { success: true, buffer, estimatedDurationSec };
  } catch (error) {
    console.error("[ElevenLabs] Generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown ElevenLabs error",
    };
  }
}

/**
 * Generate narration with word-level timestamp alignment (eidos pattern).
 * Falls back to basic TTS if the with-timestamps endpoint fails.
 */
export async function generateNarrationWithTimestamps(
  request: NarrationRequest,
): Promise<TimestampedNarrationResult> {
  if (!ELEVENLABS_API_KEY) {
    return { success: false, hasTimestamps: false, error: "ELEVENLABS_API_KEY is not set" };
  }

  const {
    text,
    voiceId,
    stability = 0.5,
    similarityBoost = 0.75,
    modelId = "eleven_multilingual_v2",
  } = request;

  const resolvedVoiceId = resolveVoiceId(voiceId);

  const body = JSON.stringify({
    text: text.slice(0, 2000),
    model_id: modelId,
    voice_settings: { stability, similarity_boost: similarityBoost },
  });

  const headers = {
    "Content-Type": "application/json",
    "xi-api-key": ELEVENLABS_API_KEY,
  };

  try {
    const res = await fetch(
      `${ELEVENLABS_BASE_URL}/text-to-speech/${resolvedVoiceId}/with-timestamps`,
      { method: "POST", headers, body },
    );

    if (!res.ok) {
      console.warn(`[ElevenLabs] with-timestamps failed (${res.status}), falling back to basic TTS`);
      // Fallback
      const basic = await generateNarration(request);
      return { ...basic, hasTimestamps: false };
    }

    const data = await res.json();
    const buffer = Buffer.from(data.audio_base64 as string, "base64");
    const alignment = data.alignment as {
      characters: string[];
      character_start_times_seconds: number[];
      character_end_times_seconds: number[];
    } | null;

    const wordCaptions: WordCaption[] = [];

    if (alignment?.characters) {
      const { characters: chars, character_start_times_seconds: starts, character_end_times_seconds: ends } = alignment;
      let word = "";
      let wordStart = 0;
      let wordEnd = 0;

      for (let i = 0; i < chars.length; i++) {
        if (chars[i] === " " || chars[i] === "\n") {
          if (word.trim()) wordCaptions.push({ word: word.trim(), start: wordStart, end: wordEnd });
          word = "";
          wordStart = starts[i + 1] ?? ends[i];
        } else {
          if (word === "") wordStart = starts[i];
          word += chars[i];
          wordEnd = ends[i];
        }
      }
      if (word.trim()) wordCaptions.push({ word: word.trim(), start: wordStart, end: wordEnd });
    }

    // Group into ~5-word caption chunks
    const CHUNK_SIZE = 5;
    const captionChunks = [];
    for (let i = 0; i < wordCaptions.length; i += CHUNK_SIZE) {
      const chunk = wordCaptions.slice(i, i + CHUNK_SIZE);
      captionChunks.push({
        text: chunk.map((w) => w.word).join(" "),
        start: chunk[0].start,
        end: chunk[chunk.length - 1].end,
      });
    }

    const audioDurationSec = wordCaptions.length > 0
      ? wordCaptions[wordCaptions.length - 1].end
      : estimateNarrationDuration(text);

    return {
      success: true,
      buffer,
      estimatedDurationSec: audioDurationSec,
      audioDurationSec,
      wordCaptions,
      captionChunks,
      hasTimestamps: true,
    };
  } catch (error) {
    console.error("[ElevenLabs] with-timestamps error:", error);
    const basic = await generateNarration(request);
    return { ...basic, hasTimestamps: false };
  }
}

/**
 * Generate narration for multiple scenes and write each to a temp file.
 * Used by the reel pipeline where FFmpeg needs file paths.
 */
export async function generateNarrationSegments(
  segments: NarrationSegment[],
  voiceId?: string,
): Promise<NarrationSegment[]> {
  console.log(`[ElevenLabs] Generating ${segments.length} narration segments...`);

  if (!existsSync(NARRATION_DIR)) {
    mkdirSync(NARRATION_DIR, { recursive: true });
  }

  const results = await Promise.all(
    segments.map(async (segment) => {
      const result = await generateNarration({ text: segment.text, voiceId });
      if (!result.success || !result.buffer) {
        return { ...segment, durationSec: result.estimatedDurationSec };
      }
      const filePath = join(NARRATION_DIR, `narration-${randomUUID()}.mp3`);
      writeFileSync(filePath, result.buffer);
      return {
        ...segment,
        filePath,
        durationSec: result.estimatedDurationSec,
      };
    }),
  );

  const successful = results.filter((r) => r.filePath).length;
  console.log(`[ElevenLabs] Generated ${successful}/${segments.length} segments`);
  return results;
}

/**
 * List available ElevenLabs voices from the account.
 */
export async function listVoices(): Promise<
  Array<{ voice_id: string; name: string; category: string }>
> {
  if (!ELEVENLABS_API_KEY) return [];

  try {
    const response = await fetch(`${ELEVENLABS_BASE_URL}/voices`, {
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
    });

    if (!response.ok) {
      console.error(`[ElevenLabs] Failed to list voices: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return (data.voices || []).map((v: any) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category,
    }));
  } catch (error) {
    console.error("[ElevenLabs] Failed to list voices:", error);
    return [];
  }
}
