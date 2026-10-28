/**
 * Kokoro-82M via DeepInfra (near-free TTS for the FREE plan). No native word timestamps:
 * words are estimated from text and audio duration (good enough for draft captions).
 * Endpoint: POST https://api.deepinfra.com/v1/inference/hexgrad/Kokoro-82M  { text, preset_voice, speed, output_format }
 */
import { env } from "../env.js";
import { putObject } from "../r2.js";
import { hashOf } from "../hash.js";
import { estimateWordTimings } from "../captions.js";
import { estimateTtsUsd } from "../pricing.js";
import type { SynthesizeRequest, SynthesizeResult, TtsProvider } from "./types.js";

const MODEL = "hexgrad/Kokoro-82M";
export const KOKORO_VOICES = ["af_bella", "af_heart", "af_sky", "am_adam", "am_michael", "bf_emma", "bm_george"];

async function call(req: SynthesizeRequest): Promise<Buffer> {
  const res = await fetch(`https://api.deepinfra.com/v1/inference/${MODEL}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.deepinfraKey}` },
    body: JSON.stringify({ text: req.text, preset_voice: [KOKORO_VOICES.includes(req.voiceId) ? req.voiceId : "af_bella"], speed: req.speed ?? 1, output_format: "mp3" }),
  });
  if (!res.ok) throw new Error(`Kokoro ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { audio?: string };
  if (!data.audio) throw new Error("Kokoro: empty audio");
  const b64 = data.audio.includes(",") ? data.audio.split(",").pop()! : data.audio;
  return Buffer.from(b64, "base64");
}

export const kokoro: TtsProvider = {
  id: "kokoro",
  isConfigured: () => !!env.deepinfraKey,
  async synthesize(req) {
    if (!env.deepinfraKey) throw new Error("DEEPINFRA_API_KEY not set");
    const audio = await call(req);
    // ~128kbps mp3 → bytes/16 ≈ ms. Rough but monotone; captions are estimates anyway.
    const durationMs = Math.max(1000, Math.round(audio.length / 16));
    const words = estimateWordTimings(req.text, durationMs - 200);
    const audioUrl = req.storageKey ? await putObject(`${req.storageKey}.mp3`, audio, "audio/mpeg", { hash: hashOf(req.text, req.voiceId), provider: "kokoro" }) : "";
    const r: SynthesizeResult = { audioUrl, durationMs, words, provider: "kokoro", voiceId: req.voiceId, model: MODEL, chars: req.text.length, usd: estimateTtsUsd("kokoro", MODEL, req.text.length), cached: false };
    return r;
  },
  async sample(req) {
    return { audio: await call(req), contentType: "audio/mpeg" };
  },
};
