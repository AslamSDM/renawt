/**
 * SFX library: each cue (whoosh_soft, riser_short, pop, tick, ...) is generated ONCE via the ElevenLabs
 * Sound Effects API, uploaded to R2 `sfx/{cue}.mp3` and recorded in the SfxAsset table. Subsequent videos reuse it.
 * Fallback when ElevenLabs isn't configured: a small synthesized WAV (ported from legacy sfxGenerator.ts).
 */
import { db } from "../db.js";
import { has } from "../env.js";
import { putObject } from "../r2.js";
import { elevenlabs } from "../tts/elevenlabs.js";
import { estimateSfxUsd } from "../pricing.js";
import { log, errMsg } from "../logger.js";

export const SFX_CUES: Record<string, { prompt: string; durationSec: number; synth: () => number[] }> = {
  whoosh_soft: { prompt: "soft airy whoosh transition, short, clean, no music", durationSec: 0.8, synth: () => sweep(300, 1200, 0.6, 0.7) },
  whoosh_fast: { prompt: "fast swoosh transition for motion graphics, crisp", durationSec: 0.5, synth: () => sweep(400, 2000, 0.4, 0.8) },
  riser_short: { prompt: "short tension riser building up, 1.5 seconds, cinematic", durationSec: 1.5, synth: () => sweep(200, 1600, 1.5, 0.4) },
  pop: { prompt: "soft UI pop sound, bubbly, short", durationSec: 0.3, synth: () => perc(0.2, [400, 800], 12) },
  tick: { prompt: "subtle clock tick, single, crisp", durationSec: 0.2, synth: () => perc(0.12, [1000], 20) },
  impact: { prompt: "deep cinematic impact hit, short boom", durationSec: 1.0, synth: () => perc(0.8, [80, 160], 8) },
  ding: { prompt: "bright notification ding chime", durationSec: 0.8, synth: () => chime(0.8, 880) },
  typing: { prompt: "short burst of keyboard typing", durationSec: 1.0, synth: () => perc(0.6, [1200, 2400], 30) },
};

const SR = 44100;
function sweep(f0: number, f1: number, dur: number, noise: number): number[] {
  const n = Math.floor(SR * dur);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / SR, p = t / dur, f = f0 + (f1 - f0) * p, a = Math.sin(p * Math.PI) * 0.3;
    out.push(Math.sin(2 * Math.PI * f * t) * a * (1 - noise * 0.5) + (Math.random() * 2 - 1) * a * noise * 0.5);
  }
  return out;
}
function perc(dur: number, freqs: number[], decay: number): number[] {
  const n = Math.floor(SR * dur);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / SR, env = Math.exp(-(t / dur) * decay);
    out.push(freqs.reduce((s, f) => s + Math.sin(2 * Math.PI * f * t) * env * (0.4 / freqs.length), 0));
  }
  return out;
}
function chime(dur: number, f: number): number[] {
  const n = Math.floor(SR * dur);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / SR, e = Math.exp(-(t / dur) * 4);
    out.push(Math.sin(2 * Math.PI * f * t) * e * 0.3 + Math.sin(4 * Math.PI * f * t) * e * 0.15);
  }
  return out;
}
export function encodeWav(samples: number[]): Buffer {
  const data = samples.length * 2;
  const b = Buffer.alloc(44 + data);
  b.write("RIFF", 0); b.writeUInt32LE(36 + data, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(data, 40);
  samples.forEach((s, i) => { const v = Math.max(-1, Math.min(1, s)); b.writeInt16LE(Math.round(v < 0 ? v * 0x8000 : v * 0x7fff), 44 + i * 2); });
  return b;
}

const inflight = new Map<string, Promise<{ url: string; usd: number } | null>>();

/** Get (or create once) the library clip for a cue. Returns null when the cue is unknown or storage is missing. */
export async function getSfx(cue: string): Promise<{ url: string; usd: number } | null> {
  const def = SFX_CUES[cue];
  if (!def || !has.db()) return null;
  const row = await db().sfxAsset.findUnique({ where: { cue } });
  if (row) return { url: row.url, usd: 0 };
  if (!has.r2()) return null;
  if (!inflight.has(cue)) {
    inflight.set(cue, (async () => {
      try {
        let body: Buffer, ext = "mp3", ct = "audio/mpeg", usd = 0;
        if (elevenlabs.isConfigured()) {
          body = await elevenlabs.soundEffect!(def.prompt, def.durationSec);
          usd = estimateSfxUsd(def.durationSec * 1000);
        } else {
          body = encodeWav(def.synth());
          ext = "wav"; ct = "audio/wav";
        }
        const url = await putObject(`sfx/${cue}.${ext}`, body, ct, { cue });
        await db().sfxAsset.upsert({ where: { cue }, create: { cue, url, durationMs: Math.round(def.durationSec * 1000) }, update: {} });
        return { url, usd };
      } catch (e) {
        log.warn("sfx generation failed", { cue, err: errMsg(e) });
        return null;
      } finally {
        inflight.delete(cue);
      }
    })());
  }
  return inflight.get(cue)!;
}

/** Resolve plan sfxCues → [{atMs, url}], dropping unknown cues. Returns total usd spent creating new library clips. */
export async function resolveSfxCues(cues: Array<{ atMs: number; cue: string }>): Promise<{ sfx: Array<{ atMs: number; url: string }>; usd: number }> {
  const out: Array<{ atMs: number; url: string }> = [];
  let usd = 0;
  for (const c of cues) {
    const r = await getSfx(c.cue);
    if (r) { out.push({ atMs: c.atMs, url: r.url }); usd += r.usd; }
  }
  return { sfx: out, usd };
}
