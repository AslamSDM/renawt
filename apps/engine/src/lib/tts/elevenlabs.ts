/**
 * ElevenLabs TTS with character timestamps (POST /v1/text-to-speech/{voice}/with-timestamps).
 * Ported from legacy generate-server/lib/elevenlabs/elevenlabsService.ts; Cloudflare routing dropped.
 * Default model eleven_flash_v2_5; if GET /v1/models lists a v4 turbo/flash model it is preferred.
 */
import { env } from "../env.js";
import { log } from "../logger.js";
import { putObject, existingObject, getObjectText } from "../r2.js";
import { hashOf } from "../hash.js";
import { wordsFromCharAlignment, type Word } from "../captions.js";
import { estimateTtsUsd } from "../pricing.js";
import type { SynthesizeRequest, SynthesizeResult, TtsProvider, VoiceInfo } from "./types.js";

const BASE = "https://api.elevenlabs.io/v1";
const DEFAULT_MODEL = "eleven_flash_v2_5";

/** Friendly library voices (same as v1). */
export const ELEVEN_VOICES: Record<string, { id: string; label: string; tags: string[] }> = {
  rachel: { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel", tags: ["female", "clear", "professional"] },
  sarah: { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah", tags: ["female", "warm"] },
  lily: { id: "pFZP5JQG7iQjIQuC4Bku", label: "Lily", tags: ["female", "clear"] },
  adam: { id: "pNInz6obpgDQGcFmaJgB", label: "Adam", tags: ["male", "confident"] },
  brian: { id: "nPczCjzI2devNBz1zQrb", label: "Brian", tags: ["male", "casual"] },
  alice: { id: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice", tags: ["female", "british"] },
  george: { id: "JBFqnCBsd6RMkjVDRZzb", label: "George", tags: ["male", "british"] },
  daniel: { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel", tags: ["male", "british", "authoritative"] },
};

export function resolveVoiceId(v?: string): string {
  if (!v) return ELEVEN_VOICES.rachel.id;
  return ELEVEN_VOICES[v.toLowerCase()]?.id ?? v;
}

let modelCache: { standard: string; premium: string } | null = null;

/** Probe GET /v1/models once; prefer a v4 turbo/flash for standard and v4 for premium if listed. */
export async function resolveModels(): Promise<{ standard: string; premium: string }> {
  if (env.elevenlabsModel) return { standard: env.elevenlabsModel, premium: env.elevenlabsModel };
  if (modelCache) return modelCache;
  let ids: string[] = [];
  try {
    const res = await fetch(`${BASE}/models`, { headers: { "xi-api-key": env.elevenlabsKey } });
    if (res.ok) ids = ((await res.json()) as Array<{ model_id: string; can_do_text_to_speech?: boolean }>).filter((m) => m.can_do_text_to_speech !== false).map((m) => m.model_id);
  } catch (e) {
    log.warn("elevenlabs models probe failed", { err: String(e) });
  }
  const v4fast = ids.find((id) => /v4.*(turbo|flash)|(turbo|flash).*v4/.test(id));
  const v4 = ids.find((id) => /^eleven_v4$/.test(id)) ?? ids.find((id) => /v4/.test(id) && !/(turbo|flash)/.test(id));
  modelCache = { standard: v4fast ?? DEFAULT_MODEL, premium: v4 ?? v4fast ?? "eleven_multilingual_v2" };
  return modelCache;
}

interface AlignmentResponse {
  audio_base64: string;
  alignment?: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] } | null;
}

async function callWithTimestamps(text: string, voiceId: string, model: string, speed: number, stability: number): Promise<{ audio: Buffer; words: Word[] }> {
  const res = await fetch(`${BASE}/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": env.elevenlabsKey },
    body: JSON.stringify({ text, model_id: model, voice_settings: { stability, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed } }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as AlignmentResponse;
  const a = data.alignment;
  const words = a ? wordsFromCharAlignment(a.characters, a.character_start_times_seconds, a.character_end_times_seconds) : [];
  return { audio: Buffer.from(data.audio_base64, "base64"), words };
}

export const elevenlabs: TtsProvider & { listVoices(): Promise<VoiceInfo[]>; soundEffect(prompt: string, durationSec: number): Promise<Buffer> } = {
  id: "elevenlabs",
  isConfigured: () => !!env.elevenlabsKey,

  async synthesize(req: SynthesizeRequest): Promise<SynthesizeResult> {
    if (!env.elevenlabsKey) throw new Error("ELEVENLABS_API_KEY not set");
    const voiceId = resolveVoiceId(req.voiceId);
    const models = await resolveModels();
    const model = req.quality === "premium" ? models.premium : models.standard;
    const speed = req.speed ?? 1;
    const stability = req.stability ?? 0.5;
    const contentHash = hashOf(req.text, voiceId, model, speed, stability);

    // Idempotency: reuse narration already paid for (same text/voice/model).
    if (req.storageKey) {
      const meta = await getObjectText(`${req.storageKey}.json`).catch(() => null);
      if (meta) {
        const parsed = JSON.parse(meta) as { hash: string; words: Word[]; durationMs: number; audioUrl: string };
        if (parsed.hash === contentHash && (await existingObject(`${req.storageKey}.mp3`))) {
          return { audioUrl: parsed.audioUrl, durationMs: parsed.durationMs, words: parsed.words, provider: "elevenlabs", voiceId, model, chars: req.text.length, usd: 0, cached: true };
        }
      }
    }

    const { audio, words } = await callWithTimestamps(req.text, voiceId, model, speed, stability);
    const durationMs = words.length ? words[words.length - 1].e + 250 : Math.round((req.text.split(/\s+/).length / 2.6) * 1000);
    let audioUrl = "";
    if (req.storageKey) {
      audioUrl = await putObject(`${req.storageKey}.mp3`, audio, "audio/mpeg", { hash: contentHash, provider: "elevenlabs" });
      await putObject(`${req.storageKey}.json`, JSON.stringify({ hash: contentHash, words, durationMs, audioUrl, model }), "application/json");
    }
    const usd = estimateTtsUsd("elevenlabs", model, req.text.length);
    return { audioUrl, durationMs, words, provider: "elevenlabs", voiceId, model, chars: req.text.length, usd, cached: false };
  },

  async sample(req) {
    const models = await resolveModels();
    const res = await fetch(`${BASE}/text-to-speech/${resolveVoiceId(req.voiceId)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "xi-api-key": env.elevenlabsKey, Accept: "audio/mpeg" },
      body: JSON.stringify({ text: req.text, model_id: models.standard, voice_settings: { stability: req.stability ?? 0.5, similarity_boost: 0.75, speed: req.speed ?? 1 } }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return { audio: Buffer.from(await res.arrayBuffer()), contentType: "audio/mpeg" };
  },

  async listVoices(): Promise<VoiceInfo[]> {
    const library: VoiceInfo[] = Object.values(ELEVEN_VOICES).map((v) => ({ voiceId: v.id, name: v.label, provider: "elevenlabs", tags: v.tags }));
    if (!env.elevenlabsKey) return library;
    try {
      const res = await fetch(`${BASE}/voices`, { headers: { "xi-api-key": env.elevenlabsKey } });
      if (!res.ok) return library;
      const data = (await res.json()) as { voices?: Array<{ voice_id: string; name: string; category?: string; preview_url?: string; labels?: Record<string, string> }> };
      return (data.voices ?? []).map((v) => ({ voiceId: v.voice_id, name: v.name, provider: "elevenlabs", previewUrl: v.preview_url, tags: [v.category ?? "", ...Object.values(v.labels ?? {})].filter(Boolean) }));
    } catch {
      return library;
    }
  },

  /** ElevenLabs Sound Effects API (POST /v1/sound-generation) → mp3. */
  async soundEffect(prompt: string, durationSec: number): Promise<Buffer> {
    const res = await fetch(`${BASE}/sound-generation?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "xi-api-key": env.elevenlabsKey },
      body: JSON.stringify({ text: prompt, duration_seconds: durationSec, prompt_influence: 0.6 }),
    });
    if (!res.ok) throw new Error(`ElevenLabs SFX ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return Buffer.from(await res.arrayBuffer());
  },
};
