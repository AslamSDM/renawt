/**
 * Fish Audio TTS (default provider). Docs: https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech
 *
 *  - Synthesis: POST https://api.fish.audio/v1/tts/stream/with-timestamp (SSE; JSON body, `model` header).
 *    Each event carries an `audio_base64` chunk plus a cumulative word `alignment` snapshot per `chunk_seq`.
 *    If that endpoint fails we fall back to plain POST /v1/tts (raw mp3 bytes).
 *  - Word timings, in order: native TTS alignment → Fish ASR (POST /v1/asr, word-level `segments`)
 *    → Workers AI whisper (shared `transcribe()` helper) → estimate. Always snapped to the script.
 *  - Models: s2.1-pro (default, $15 / M UTF-8 bytes), s2.1-pro-free ($0, fair use), s2-pro, drama-3. `s1` retires 2026-12-31.
 *  - Voices: GET https://api.fish.audio/model?language=en&sort_by=task_count (public voice library).
 */
import { log } from "../logger.js";
import { putObject, existingObject, getObjectText } from "../r2.js";
import { hashOf } from "../hash.js";
import { estimateWordTimings, type Word } from "../captions.js";
import { transcribe, sttConfigured } from "../stt/index.js";
import { snapToScript, stripCueTags } from "./align.js";
import type { SynthesizeRequest, SynthesizeResult, TtsProvider, VoiceInfo } from "./types.js";

export const FISH_BASE = "https://api.fish.audio";
export const FISH_DEFAULT_MODEL = "s2.1-pro";
export const FISH_ASR_MODEL = "transcribe-1-pro";
export const FISH_ASR_USD_PER_HOUR = 0.36;
/** $ per 1K UTF-8 bytes of input text. */
export const FISH_USD_PER_1K_BYTES: Record<string, number> = { "s2.1-pro": 0.015, "s2-pro": 0.015, s1: 0.015, "s2.1-pro-free": 0, "drama-3": 0.05 };

export type Energy = "calm" | "neutral" | "energetic";
/** Hand-picked public narrators from the top-used English library voices (no celebrity / character clones). */
export const FISH_DEFAULT_VOICES: Record<Energy, { id: string; name: string; tags: string[] }> = {
  calm: { id: "bf322df2096a46f18c579d0baa36f41d", name: "Adrian", tags: ["male", "narration", "measured", "storytelling"] },
  neutral: { id: "536d3a5e000945adb7038665781a4aca", name: "Ethan", tags: ["male", "educational", "narration", "documentary"] },
  energetic: { id: "802e3bc2b27e49c2995d23ef70e6ac89", name: "Energetic Male", tags: ["male", "social-media", "energetic", "clear"] },
};

export const fishKey = (): string => process.env.FISH_AUDIO_API_KEY ?? "";
export const fishModel = (): string => process.env.FISH_TTS_MODEL || FISH_DEFAULT_MODEL;

export function defaultFishVoice(energy: Energy = "neutral"): string {
  const envKey = `FISH_DEFAULT_VOICE_${energy.toUpperCase()}`;
  return process.env[envKey] || (energy === "neutral" ? process.env.FISH_DEFAULT_VOICE : undefined) || FISH_DEFAULT_VOICES[energy].id;
}

/** Persona energy 0..1 → narrator bucket. */
export function energyBucket(energy: number): Energy {
  return energy < 0.35 ? "calm" : energy > 0.7 ? "energetic" : "neutral";
}

/** Fish voice ids are 32-hex model ids. Anything else ("", "calm", an ElevenLabs id) maps to a default narrator. */
export function resolveFishVoice(v?: string): string {
  const id = (v ?? "").trim();
  if (/^[0-9a-f]{32}$/i.test(id)) return id.toLowerCase();
  const e = id.toLowerCase();
  if (e === "calm" || e === "neutral" || e === "energetic") return defaultFishVoice(e);
  return defaultFishVoice("neutral");
}

export function fishTtsUsd(model: string, text: string): number {
  const per1k = FISH_USD_PER_1K_BYTES[model] ?? 0.015;
  return Math.round((Buffer.byteLength(text, "utf8") / 1000) * per1k * 1e6) / 1e6;
}

/** Request body shared by /v1/tts and /v1/tts/stream/with-timestamp. */
export function buildFishBody(text: string, voiceId: string, opts: { speed?: number; latency?: "normal" | "balanced" | "low" } = {}): Record<string, unknown> {
  const speed = opts.speed ?? 1;
  return {
    text,
    reference_id: voiceId,
    format: "mp3",
    mp3_bitrate: 128,
    sample_rate: 44100,
    chunk_length: 300,
    normalize: true,
    language: "en",
    latency: opts.latency ?? "normal",
    ...(speed !== 1 ? { prosody: { speed: Math.min(2, Math.max(0.5, speed)), volume: 0 } } : {}),
  };
}

export function fishHeaders(model: string, extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: `Bearer ${fishKey()}`, "Content-Type": "application/json", model, ...extra };
}

interface StreamEvent { audio_base64?: string; alignment?: { segments: Array<{ text: string; start: number; end: number }>; audio_duration: number } | null; chunk_seq?: number; chunk_audio_offset_sec?: number }

/** Parse the SSE body of /v1/tts/stream/with-timestamp into audio + absolute word timings (ms). */
export function parseTimestampStream(sse: string): { audio: Buffer; words: Word[]; durationMs: number | null } {
  const chunks: Buffer[] = [];
  const align = new Map<number, { offset: number; segs: Array<{ text: string; start: number; end: number }>; dur: number }>();
  for (const block of sse.split(/\r?\n\r?\n/)) {
    const data = block.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n");
    if (!data || data === "[DONE]") continue;
    let ev: StreamEvent & { status?: number; message?: string };
    try { ev = JSON.parse(data); } catch { continue; }
    if (ev.status && ev.message && !ev.audio_base64) throw new Error(`Fish stream error ${ev.status}: ${ev.message}`);
    if (ev.audio_base64) chunks.push(Buffer.from(ev.audio_base64, "base64"));
    if (ev.alignment && typeof ev.chunk_seq === "number") {
      align.set(ev.chunk_seq, { offset: ev.chunk_audio_offset_sec ?? 0, segs: ev.alignment.segments ?? [], dur: ev.alignment.audio_duration ?? 0 });
    }
  }
  const words: Word[] = [];
  let durationMs: number | null = null;
  for (const seq of [...align.keys()].sort((a, b) => a - b)) {
    const a = align.get(seq)!;
    for (const s of a.segs) if (s.text.trim()) words.push({ w: s.text.trim(), s: Math.round((a.offset + s.start) * 1000), e: Math.round((a.offset + s.end) * 1000) });
    if (a.dur) durationMs = Math.round((a.offset + a.dur) * 1000);
  }
  return { audio: Buffer.concat(chunks), words, durationMs };
}

/** CBR 128kbps mp3 → ms (skip an ID3v2 tag if present). */
export function mp3DurationMs(buf: Buffer, kbps = 128): number {
  let off = 0;
  if (buf.length > 10 && buf.toString("latin1", 0, 3) === "ID3") off = 10 + (((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f));
  return Math.round(((buf.length - off) * 8) / kbps);
}

export class FishHttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function fishError(res: Response, what: string): Promise<FishHttpError> {
  return new FishHttpError(res.status, `Fish ${what} ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
}

/** Plain synthesis → mp3 bytes. */
export async function fishTts(text: string, voiceId: string, model: string, speed = 1): Promise<Buffer> {
  const res = await fetch(`${FISH_BASE}/v1/tts`, { method: "POST", headers: fishHeaders(model), body: JSON.stringify(buildFishBody(text, voiceId, { speed })), signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw await fishError(res, "TTS");
  return Buffer.from(await res.arrayBuffer());
}

/** Synthesis with native word timestamps. */
export async function fishTtsWithTimestamps(text: string, voiceId: string, model: string, speed = 1) {
  const res = await fetch(`${FISH_BASE}/v1/tts/stream/with-timestamp`, { method: "POST", headers: fishHeaders(model, { Accept: "text/event-stream" }), body: JSON.stringify(buildFishBody(text, voiceId, { speed })), signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw await fishError(res, "TTS stream");
  return parseTimestampStream(await res.text());
}

/** Fish ASR with word-level segments (seconds → ms). */
export async function fishAsr(audio: Buffer): Promise<{ words: Word[]; durationMs: number | null; usd: number }> {
  const form = new FormData();
  form.append("audio", new Blob([new Uint8Array(audio)], { type: "audio/mpeg" }), "narration.mp3");
  form.append("language", "en");
  form.append("ignore_timestamps", "false");
  form.append("diarize", "false");
  form.append("tag_audio_events", "false");
  const res = await fetch(`${FISH_BASE}/v1/asr`, { method: "POST", headers: { Authorization: `Bearer ${fishKey()}`, model: FISH_ASR_MODEL }, body: form, signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw await fishError(res, "ASR");
  const d = (await res.json()) as { duration?: number; segments?: Array<{ text: string; start: number; end: number }> };
  const words = (d.segments ?? []).filter((s) => s.text?.trim()).map((s) => ({ w: s.text.trim(), s: Math.round(s.start * 1000), e: Math.round(s.end * 1000) }));
  const secs = Math.ceil(d.duration ?? 0);
  return { words, durationMs: d.duration ? Math.round(d.duration * 1000) : null, usd: Math.round((secs / 3600) * FISH_ASR_USD_PER_HOUR * 1e6) / 1e6 };
}

export type TimingSource = "fish-native" | "fish-asr" | "whisper" | "estimate";

export interface TimingDeps {
  asr?: (audio: Buffer) => Promise<{ words: Word[]; durationMs: number | null; usd: number }>;
  whisper?: (audio: Buffer, durationMs: number) => Promise<{ words: Word[]; usd: number }>;
  whisperConfigured?: () => boolean;
}

const defaultDeps: Required<TimingDeps> = {
  asr: fishAsr,
  whisper: async (audio, durationMs) => {
    const r = await transcribe(audio, { fileName: "narration.mp3", durationMs });
    return { words: r.transcript.words, usd: r.usd };
  },
  whisperConfigured: sttConfigured,
};

/**
 * Resolve script-snapped word timings. `native` = alignment from the TTS stream (may be empty).
 * Falls through Fish ASR → whisper → estimate; recognised words are always snapped to `script`.
 */
export async function resolveTimings(script: string, audio: Buffer, durationMs: number, native: Word[], deps: TimingDeps = {}): Promise<{ words: Word[]; source: TimingSource; usd: number }> {
  const d = { ...defaultDeps, ...deps };
  const scriptWords = stripCueTags(script).split(/\s+/).filter(Boolean).length;
  const usable = (w: Word[]) => w.length >= Math.max(1, Math.floor(scriptWords * 0.5));
  if (usable(native)) return { words: snapToScript(script, native, durationMs), source: "fish-native", usd: 0 };
  let usd = 0;
  if (fishKey() || deps.asr) {
    try {
      const r = await d.asr(audio);
      usd += r.usd;
      if (usable(r.words)) return { words: snapToScript(script, r.words, durationMs), source: "fish-asr", usd };
    } catch (e) {
      log.warn("fish asr alignment failed", { err: String(e) });
    }
  }
  if (d.whisperConfigured()) {
    try {
      const r = await d.whisper(audio, durationMs);
      usd += r.usd;
      if (usable(r.words)) return { words: snapToScript(script, r.words, durationMs), source: "whisper", usd };
    } catch (e) {
      log.warn("whisper alignment failed", { err: String(e) });
    }
  }
  return { words: estimateWordTimings(stripCueTags(script), Math.max(500, durationMs - 200)), source: "estimate", usd };
}

// ───── voices ─────
interface FishModelEntity { _id: string; title: string; description?: string; tags?: string[]; languages?: string[]; task_count?: number; visibility?: string; samples?: Array<{ audio?: string }>; cover_image?: string }

/** Titles/tags we never surface: celebrity / game-character clones, SFX, test models. */
const BLOCK = /musk|markiplier|smash|kombat|miku|brainrot|crowd|producer tag|e-?girl|testing|watermark|announcer|narrator$|mita|anime|trump|biden|obama/i;
const GOOD_TAGS = new Set(["narration", "educational", "documentary", "podcast", "advertisement", "social-media", "conversational", "storytelling", "professional"]);

export function curateFishVoices(items: FishModelEntity[], limit = 24): VoiceInfo[] {
  const defaults = new Map(Object.entries(FISH_DEFAULT_VOICES).map(([energy, v]) => [v.id, energy as Energy]));
  const picked: VoiceInfo[] = [];
  const seen = new Set<string>();
  for (const [energy, v] of Object.entries(FISH_DEFAULT_VOICES)) {
    const live = items.find((m) => m._id === v.id);
    picked.push({ voiceId: v.id, name: v.name, provider: "fish", tags: [`default-${energy}`, ...(live?.tags ?? v.tags)].slice(0, 8), previewUrl: live?.samples?.[0]?.audio || undefined });
    seen.add(v.id);
    seen.add(v.name.toLowerCase());
  }
  for (const m of items) {
    if (picked.length >= limit) break;
    const tags = (m.tags ?? []).map((t) => t.toLowerCase());
    const title = m.title.trim();
    if (seen.has(m._id) || seen.has(title.toLowerCase()) || defaults.has(m._id)) continue;
    if (m.visibility && m.visibility !== "public") continue;
    if (!(m.languages ?? []).includes("en")) continue;
    if (BLOCK.test(title) || BLOCK.test(m.description ?? "") || tags.includes("character-voice") || tags.includes("gaming")) continue;
    if (!tags.some((t) => GOOD_TAGS.has(t))) continue;
    seen.add(m._id);
    seen.add(title.toLowerCase());
    picked.push({ voiceId: m._id, name: title, provider: "fish", tags: tags.slice(0, 8), previewUrl: m.samples?.[0]?.audio || undefined });
  }
  return picked;
}

let voiceCache: { at: number; voices: VoiceInfo[] } | null = null;
const VOICE_TTL_MS = 60 * 60 * 1000;

export async function listFishVoices(): Promise<VoiceInfo[]> {
  if (voiceCache && Date.now() - voiceCache.at < VOICE_TTL_MS) return voiceCache.voices;
  let items: FishModelEntity[] = [];
  if (fishKey()) {
    try {
      const res = await fetch(`${FISH_BASE}/model?language=en&sort_by=task_count&page_size=80&page_number=1`, { headers: { Authorization: `Bearer ${fishKey()}` }, signal: AbortSignal.timeout(15_000) });
      if (res.ok) items = ((await res.json()) as { items?: FishModelEntity[] }).items ?? [];
      else log.warn("fish voice list failed", { status: res.status });
    } catch (e) {
      log.warn("fish voice list failed", { err: String(e) });
    }
  }
  const voices = curateFishVoices(items);
  if (items.length) voiceCache = { at: Date.now(), voices };
  return voices;
}

/** ~6s preview line used for cached voice samples (`voices/fish/<id>.mp3`). */
export const FISH_SAMPLE_TEXT = "Here's the thing nobody tells you about this. It takes one minute to explain, and it changes everything.";

export const fish: TtsProvider & { listVoices(): Promise<VoiceInfo[]> } = {
  id: "fish",
  isConfigured: () => !!fishKey(),

  async synthesize(req: SynthesizeRequest): Promise<SynthesizeResult> {
    if (!fishKey()) throw new Error("FISH_AUDIO_API_KEY not set");
    const voiceId = resolveFishVoice(req.voiceId);
    const model = fishModel();
    const speed = req.speed ?? 1;
    const contentHash = hashOf(req.text, voiceId, model, speed);

    // Idempotency: reuse narration already paid for (same text/voice/model/speed).
    if (req.storageKey) {
      const meta = await getObjectText(`${req.storageKey}.json`).catch(() => null);
      if (meta) {
        const parsed = JSON.parse(meta) as { hash: string; words: Word[]; durationMs: number; audioUrl: string };
        if (parsed.hash === contentHash && (await existingObject(`${req.storageKey}.mp3`).catch(() => null))) {
          return { audioUrl: parsed.audioUrl, durationMs: parsed.durationMs, words: parsed.words, provider: "fish", voiceId, model, chars: req.text.length, usd: 0, cached: true };
        }
      }
    }

    let audio: Buffer;
    let native: Word[] = [];
    let nativeDur: number | null = null;
    try {
      const r = await fishTtsWithTimestamps(req.text, voiceId, model, speed);
      if (!r.audio.length) throw new Error("empty audio");
      audio = r.audio;
      native = r.words;
      nativeDur = r.durationMs;
    } catch (e) {
      // Auth / credit / validation errors would fail the plain endpoint too.
      if (e instanceof FishHttpError && [400, 401, 402, 403, 422].includes(e.status)) throw e;
      log.warn("fish with-timestamp failed; plain /v1/tts", { err: String(e) });
      audio = await fishTts(req.text, voiceId, model, speed);
    }
    const durationMs = Math.max(nativeDur ?? 0, mp3DurationMs(audio));
    const timing = await resolveTimings(req.text, audio, durationMs, native);
    const words = timing.words;

    let audioUrl = "";
    if (req.storageKey) {
      audioUrl = await putObject(`${req.storageKey}.mp3`, audio, "audio/mpeg", { hash: contentHash, provider: "fish" });
      await putObject(`${req.storageKey}.json`, JSON.stringify({ hash: contentHash, words, durationMs, audioUrl, model, timingSource: timing.source }), "application/json");
    }
    const usd = Math.round((fishTtsUsd(model, req.text) + timing.usd) * 1e6) / 1e6;
    log.info("fish tts", { model, voiceId, bytes: audio.length, durationMs, timing: timing.source, usd });
    return { audioUrl, durationMs, words, provider: "fish", voiceId, model, chars: req.text.length, usd, cached: false, timingSource: timing.source, audio: req.storageKey ? undefined : audio };
  },

  async sample(req) {
    if (!fishKey()) throw new Error("FISH_AUDIO_API_KEY not set");
    return { audio: await fishTts(req.text, resolveFishVoice(req.voiceId), fishModel(), req.speed ?? 1), contentType: "audio/mpeg" };
  },

  listVoices: listFishVoices,
};
