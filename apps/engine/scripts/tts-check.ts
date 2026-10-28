/**
 * Live Fish Audio TTS check (spends ~$0.0025 on s2.1-pro; $0 with FISH_TTS_MODEL=s2.1-pro-free). Usage: pnpm --filter @remawt/engine exec tsx scripts/tts-check.ts [outPath]
 * Synthesises a 25-word line with the default narrator, prints duration/bytes/timing source/first words/cost,
 * uploads to R2 (`tts-check/fish-<hash>`) when R2 is configured, and always writes the mp3 locally.
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { has } from "../src/lib/env.js";
import { hashOf } from "../src/lib/hash.js";
import { fetchBuffer } from "../src/lib/r2.js";
import { fish, defaultFishVoice, fishModel } from "../src/lib/tts/fish.js";
import { ttsFor } from "../src/lib/tts/index.js";

const TEXT = "Most people think compound interest is boring math, but in 2026 it quietly turned a $100 monthly habit into real money for millions of patient savers.";
const out = process.argv[2] ?? "fish-sample.mp3";

async function main() {
  if (!fish.isConfigured()) throw new Error("FISH_AUDIO_API_KEY not set");
  const chosen = ttsFor(undefined);
  console.log(`ttsFor(undefined) → ${chosen.id} (TTS_PROVIDER=${process.env.TTS_PROVIDER ?? ""})`);
  const voiceId = defaultFishVoice("neutral");
  const words = TEXT.split(/\s+/).length;
  const storageKey = has.r2() ? `tts-check/fish-${hashOf(TEXT, voiceId, fishModel())}` : undefined;
  if (!storageKey) console.log("R2 not configured → writing locally only");

  const t0 = Date.now();
  let r;
  try {
    r = await fish.synthesize({ text: TEXT, voiceId, storageKey });
  } catch (e) {
    if (!storageKey || /Fish /.test(String(e))) throw e;
    console.log(`R2 path failed (${String(e).slice(0, 160)}) → retrying without R2`);
    r = await fish.synthesize({ text: TEXT, voiceId });
  }
  const ms = Date.now() - t0;
  const audio = r.audio ?? (r.audioUrl ? await fetchBuffer(r.audioUrl) : Buffer.alloc(0));
  writeFileSync(out, audio);

  console.log(JSON.stringify({
    model: r.model, voiceId: r.voiceId, words, chars: r.chars, utf8Bytes: Buffer.byteLength(TEXT, "utf8"),
    durationMs: r.durationMs, mp3Bytes: audio.length, timingSource: r.timingSource ?? (r.cached ? "cached" : "?"),
    firstWords: r.words.slice(0, 5), lastWord: r.words[r.words.length - 1], wordCount: r.words.length,
    usd: r.usd, cached: r.cached, audioUrl: r.audioUrl || null, wallMs: ms, wrote: out,
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
