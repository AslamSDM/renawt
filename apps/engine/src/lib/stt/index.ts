/**
 * Speech-to-text with word timestamps for user-supplied audio/video.
 *  - Groq whisper-large-v3-turbo (GROQ_API_KEY): verbose_json + timestamp_granularities[]=word ($0.04/hr).
 *  - Fallback: Cloudflare Workers AI @cf/openai/whisper-large-v3-turbo (CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID).
 * Returns a `Transcript` (ms) with deterministic segments (pauses > 0.7s → silence, filler runs → filler).
 */
import type { Transcript } from "@remawt/shared";
import { buildSegments } from "../edit/segments.js";
import type { Word } from "../captions.js";

export const STT_USD_PER_HOUR = 0.04;

export function sttConfigured(): boolean {
  return !!process.env.GROQ_API_KEY || !!(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID);
}

interface RawWord { word: string; start: number; end: number }

async function groq(audio: Buffer, fileName: string): Promise<{ text: string; language?: string; duration?: number; words: RawWord[] }> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)]), fileName);
  form.append("model", process.env.GROQ_STT_MODEL ?? "whisper-large-v3-turbo");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("timestamp_granularities[]", "segment");
  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }, body: form });
  if (!res.ok) throw new Error(`Groq STT ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const d = (await res.json()) as { text: string; language?: string; duration?: number; words?: RawWord[] };
  return { text: d.text, language: d.language, duration: d.duration, words: d.words ?? [] };
}

async function workersAi(audio: Buffer): Promise<{ text: string; language?: string; duration?: number; words: RawWord[] }> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/openai/whisper-large-v3-turbo`;
  const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ audio: audio.toString("base64") }) });
  if (!res.ok) throw new Error(`Workers AI STT ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const d = (await res.json()) as { result?: { text: string; transcription_info?: { language?: string; duration?: number }; segments?: Array<{ words?: RawWord[] }>; words?: RawWord[] } };
  const r = d.result ?? { text: "" };
  const words = r.words ?? (r.segments ?? []).flatMap((s) => s.words ?? []);
  return { text: r.text, language: r.transcription_info?.language, duration: r.transcription_info?.duration, words };
}

/** Transcribe an mp3 buffer (mono 16kHz/64kbps recommended to stay under provider upload limits). */
export async function transcribe(audio: Buffer, opts: { fileName?: string; durationMs?: number } = {}): Promise<{ transcript: Transcript; usd: number; provider: string }> {
  let raw: Awaited<ReturnType<typeof groq>>;
  let provider = "groq";
  if (process.env.GROQ_API_KEY) {
    try {
      raw = await groq(audio, opts.fileName ?? "audio.mp3");
    } catch (e) {
      if (!process.env.CLOUDFLARE_API_TOKEN) throw e;
      raw = await workersAi(audio);
      provider = "workers-ai";
    }
  } else if (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID) {
    raw = await workersAi(audio);
    provider = "workers-ai";
  } else {
    throw new Error("No STT provider configured (GROQ_API_KEY or CLOUDFLARE_API_TOKEN+CLOUDFLARE_ACCOUNT_ID)");
  }
  const words: Word[] = raw.words.map((w) => ({ w: w.word.trim(), s: Math.round(w.start * 1000), e: Math.round(w.end * 1000) })).filter((w) => w.w);
  const durationMs = opts.durationMs ?? (raw.duration ? Math.round(raw.duration * 1000) : words[words.length - 1]?.e ?? 0);
  const segments = buildSegments(words);
  const transcript: Transcript = { text: raw.text.trim(), language: raw.language ?? "en", durationMs, words, segments };
  const usd = provider === "groq" ? Math.max(10_000, durationMs) / 3_600_000 * STT_USD_PER_HOUR : 0;
  return { transcript, usd: Math.round(usd * 1e6) / 1e6, provider };
}
