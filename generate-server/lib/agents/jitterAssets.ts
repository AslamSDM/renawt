/**
 * Helpers for assembling Jitter brief assets:
 *   - synthesize narration MP3 → upload to R2 (audio/narration/<tag>.mp3)
 *   - fetch stock images via Unsplash by topic → return URLs
 */

import { generateNarration } from "../elevenlabs/elevenlabsService";
import { searchUnsplashPhotos } from "./imageEnrichment";
import { uploadAudioBufferToR2, isR2Configured } from "../storage/r2";

export interface NarrationInput {
  /** Either pass `text` to synthesize, or pass an existing audio URL/path. */
  text?: string;
  audioUrl?: string;
  voiceId?: string;
  volume?: number;
  startMs?: number;
  /** Caller-known duration (ms) — required to duck music for pre-existing audioUrl. */
  durationMs?: number;
}

export interface NarrationResult {
  url: string;
  volume: number;
  startMs?: number;
  estimatedDurationSec?: number;
  /** Duration in ms — same as estimatedDurationSec*1000, propagated to the JitterDoc for music ducking. */
  durationMs?: number;
}

export interface StockImage {
  url: string;
  /** Search topic this URL was fetched for — lets the composer pick relevant images per scene. */
  topic: string;
}

export interface UserAsset {
  url: string;
  /** Short identifier the user can reference in their prompt — e.g. "logo", "hero". */
  alias: string;
  kind: "image" | "video";
  /** Original filename, helps the LLM disambiguate similar aliases. */
  name?: string;
  /** Free-form description supplied by the user (purpose, when to use it). */
  description?: string;
}

export interface CaptionChunk {
  text: string;
  startMs: number;
  endMs: number;
}

/**
 * Split narration text into caption chunks and distribute time proportionally
 * to character count across the given total durationMs. Punctuation-aware: we
 * break on sentence terminators first, then on commas/long phrases. No external
 * STT — speech-to-text alignment would be more accurate but adds a slow,
 * paid hop. Proportional timing is "good enough" for short videos.
 */
export function buildCaptionsFromNarration(
  text: string,
  totalDurationMs: number,
  opts: { startMs?: number; maxCharsPerChunk?: number } = {},
): CaptionChunk[] {
  if (!text?.trim() || !Number.isFinite(totalDurationMs) || totalDurationMs <= 0) {
    return [];
  }
  const startMs = opts.startMs ?? 0;
  const maxChars = opts.maxCharsPerChunk ?? 64;

  const sentenceSplit = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);

  const phrases: string[] = [];
  for (const s of sentenceSplit) {
    if (s.length <= maxChars) {
      phrases.push(s);
      continue;
    }
    // Break long sentences on commas / semicolons / "and"/"but" connectors.
    const sub = s.split(/(?<=[,;:])\s+|\s+(?=and |but |or |so )/i).filter(Boolean);
    let buffer = "";
    for (const piece of sub) {
      if ((buffer + " " + piece).trim().length <= maxChars) {
        buffer = (buffer + " " + piece).trim();
      } else {
        if (buffer) phrases.push(buffer);
        buffer = piece;
      }
    }
    if (buffer) phrases.push(buffer);
  }

  if (!phrases.length) return [];
  const totalChars = phrases.reduce((s, p) => s + p.length, 0);
  const chunks: CaptionChunk[] = [];
  let cursor = startMs;
  for (const p of phrases) {
    const share = (p.length / totalChars) * totalDurationMs;
    const end = cursor + share;
    chunks.push({
      text: p,
      startMs: Math.round(cursor),
      endMs: Math.round(end),
    });
    cursor = end;
  }
  return chunks;
}

/**
 * Resolve a NarrationInput → playable narration spec (with public URL).
 * Returns null if no narration was requested or synthesis failed.
 */
export async function resolveNarration(
  input: NarrationInput | null | undefined,
  tag: string,
): Promise<NarrationResult | null> {
  if (!input) return null;

  // Pre-existing audio URL takes priority.
  if (input.audioUrl) {
    return {
      url: input.audioUrl,
      volume: input.volume ?? 0.9,
      startMs: input.startMs,
      durationMs: input.durationMs,
    };
  }

  if (!input.text || !input.text.trim()) return null;

  console.log(`[jitterAssets] Synthesizing narration (${input.text.length} chars)`);
  const result = await generateNarration({
    text: input.text,
    voiceId: input.voiceId,
  });
  if (!result.success || !result.buffer) {
    console.warn(`[jitterAssets] Narration failed: ${result.error}`);
    return null;
  }

  if (!isR2Configured()) {
    console.warn(`[jitterAssets] R2 not configured — cannot persist narration`);
    return null;
  }

  const up = await uploadAudioBufferToR2(
    result.buffer,
    "audio/mpeg",
    "narration/jitter",
    tag,
  );
  if (!up.success || !up.url) {
    console.warn(`[jitterAssets] R2 narration upload failed: ${up.error}`);
    return null;
  }

  return {
    url: up.url,
    volume: input.volume ?? 0.9,
    startMs: input.startMs,
    estimatedDurationSec: result.estimatedDurationSec,
    durationMs:
      typeof result.estimatedDurationSec === "number"
        ? Math.round(result.estimatedDurationSec * 1000)
        : undefined,
  };
}

/**
 * Fetch stock images for a list of topics. Returns labeled URL+topic pairs
 * (de-duped) so the composer can pick a photo that matches the scene context.
 * Skips silently if Unsplash isn't configured.
 */
export async function fetchStockImagesForTopics(
  topics: string[],
  perTopic = 3,
): Promise<StockImage[]> {
  if (!topics?.length) return [];
  const seen = new Set<string>();
  const out: StockImage[] = [];
  for (const topic of topics) {
    try {
      const photos = await searchUnsplashPhotos(topic, perTopic);
      for (const url of photos) {
        if (!url || seen.has(url)) continue;
        seen.add(url);
        out.push({ url, topic });
      }
    } catch (err) {
      console.warn(
        `[jitterAssets] stock images failed for "${topic}": ${err instanceof Error ? err.message : err}`,
      );
    }
  }
  return out;
}
