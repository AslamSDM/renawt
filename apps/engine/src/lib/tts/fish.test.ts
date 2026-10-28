import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { snapToScript, stripCueTags } from "./align.js";
import { buildFishBody, fishHeaders, fishTts, fishTtsUsd, parseTimestampStream, resolveFishVoice, resolveTimings, curateFishVoices, mp3DurationMs, FISH_DEFAULT_VOICES, FISH_BASE } from "./fish.js";
import { ttsFor } from "./index.js";
import type { TtsProvider } from "./types.js";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

// ───────── request shaping ─────────
test("fish: /v1/tts request has bearer auth, model header and JSON mp3 body", async () => {
  process.env.FISH_AUDIO_API_KEY = "fk_test";
  let seen: { url: string; init: RequestInit } | null = null;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return new Response(Buffer.from([0xff, 0xfb, 0x90, 0x00]), { status: 200, headers: { "content-type": "audio/mpeg" } });
  }) as typeof fetch;
  const buf = await fishTts("Hello there.", FISH_DEFAULT_VOICES.neutral.id, "s2.1-pro", 1.1);
  assert.equal(buf.length, 4);
  assert.ok(seen);
  const { url, init } = seen as { url: string; init: RequestInit };
  assert.equal(url, `${FISH_BASE}/v1/tts`);
  assert.equal(init.method, "POST");
  const h = init.headers as Record<string, string>;
  assert.equal(h.Authorization, "Bearer fk_test");
  assert.equal(h.model, "s2.1-pro");
  assert.equal(h["Content-Type"], "application/json");
  const body = JSON.parse(String(init.body));
  assert.equal(body.text, "Hello there.");
  assert.equal(body.reference_id, FISH_DEFAULT_VOICES.neutral.id);
  assert.equal(body.format, "mp3");
  assert.equal(body.mp3_bitrate, 128);
  assert.equal(body.normalize, true);
  assert.deepEqual(body.prosody, { speed: 1.1, volume: 0 });
});

test("fish: body omits prosody at speed 1 and clamps speed", () => {
  assert.equal(buildFishBody("x", "v").prosody, undefined);
  assert.deepEqual(buildFishBody("x", "v", { speed: 5 }).prosody, { speed: 2, volume: 0 });
  assert.equal(fishHeaders("s2-pro").model, "s2-pro");
});

test("fish: voice id resolution maps non-Fish ids to the default narrator", () => {
  const hex = "0123456789abcdef0123456789ABCDEF";
  assert.equal(resolveFishVoice(hex), hex.toLowerCase());
  assert.equal(resolveFishVoice("21m00Tcm4TlvDq8ikWAM"), FISH_DEFAULT_VOICES.neutral.id);
  assert.equal(resolveFishVoice("energetic"), FISH_DEFAULT_VOICES.energetic.id);
  assert.equal(resolveFishVoice(undefined), FISH_DEFAULT_VOICES.neutral.id);
});

test("fish: cost is per UTF-8 byte ($0.015 / 1K), free model is $0", () => {
  assert.equal(fishTtsUsd("s2.1-pro", "a".repeat(1000)), 0.015);
  assert.equal(fishTtsUsd("s2.1-pro", "é".repeat(500)), 0.015); // 2 bytes each
  assert.equal(fishTtsUsd("s2.1-pro-free", "a".repeat(1000)), 0);
});

test("fish: SSE with-timestamp stream → concatenated audio + absolute word ms (latest snapshot wins)", () => {
  const a = Buffer.from("AAA").toString("base64");
  const b = Buffer.from("BB").toString("base64");
  const ev = (o: unknown) => `event: message\ndata: ${JSON.stringify(o)}\n\n`;
  const sse =
    ev({ audio_base64: a, content: "Hi there", chunk_seq: 0, chunk_audio_offset_sec: 0, alignment: { audio_duration: 0.5, segments: [{ text: "Hi", start: 0, end: 0.2 }] } }) +
    ev({ audio_base64: b, content: "Hi there", chunk_seq: 0, chunk_audio_offset_sec: 0, alignment: { audio_duration: 0.8, segments: [{ text: "Hi", start: 0, end: 0.2 }, { text: "there", start: 0.25, end: 0.7 }] } }) +
    ev({ audio_base64: a, content: "Again", chunk_seq: 1, chunk_audio_offset_sec: 1.0, alignment: { audio_duration: 0.4, segments: [{ text: "Again", start: 0.05, end: 0.35 }] } });
  const r = parseTimestampStream(sse);
  assert.equal(r.audio.toString(), "AAABBAAA");
  assert.deepEqual(r.words, [{ w: "Hi", s: 0, e: 200 }, { w: "there", s: 250, e: 700 }, { w: "Again", s: 1050, e: 1350 }]);
  assert.equal(r.durationMs, 1400);
});

test("fish: mp3 duration from CBR byte count, skipping ID3", () => {
  assert.equal(mp3DurationMs(Buffer.alloc(16_000)), 1000);
  const id3 = Buffer.concat([Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 10]), Buffer.alloc(10), Buffer.alloc(16_000)]);
  assert.equal(mp3DurationMs(id3), 1000);
});

// ───────── script snapping ─────────
test("snapToScript: ASR typos are replaced by script words, timings kept", () => {
  const script = "Fish Audio costs 1.5 cents, period.";
  const rec = [
    { w: "fish", s: 0, e: 300 }, { w: "odio", s: 320, e: 600 }, { w: "costs", s: 620, e: 900 },
    { w: "one", s: 950, e: 1100 }, { w: "point", s: 1120, e: 1300 }, { w: "five", s: 1320, e: 1500 },
    { w: "cents", s: 1520, e: 1800 }, { w: "period", s: 1850, e: 2200 },
  ];
  const out = snapToScript(script, rec, 2400);
  assert.deepEqual(out.map((w) => w.w), ["Fish", "Audio", "costs", "1.5", "cents,", "period."]);
  assert.equal(out[0].s, 0);
  assert.equal(out[2].s, 620);
  // "1.5" takes the span of the unmatched "one point five".
  assert.equal(out[3].s, 950);
  assert.equal(out[3].e, 1500);
  assert.equal(out[5].e, 2200);
  for (let i = 1; i < out.length; i++) assert.ok(out[i].s >= out[i - 1].e);
});

test("snapToScript: words the ASR dropped get interpolated between anchors", () => {
  const out = snapToScript("one two three four", [{ w: "one", s: 0, e: 200 }, { w: "four", s: 1000, e: 1200 }], 1300);
  assert.deepEqual(out.map((w) => w.w), ["one", "two", "three", "four"]);
  assert.ok(out[1].s >= 200 && out[2].e <= 1000);
  assert.equal(out[3].s, 1000);
});

test("snapToScript: strips Fish cue tags and estimates when nothing recognised", () => {
  assert.equal(stripCueTags("Wait [pause] what [laughing nervously] now"), "Wait what now");
  const out = snapToScript("Wait [pause] what", [], 1000);
  assert.deepEqual(out.map((w) => w.w), ["Wait", "what"]);
});

// ───────── timing fallback ordering ─────────
const script = "alpha beta gamma delta";
const recWords = [{ w: "alpha", s: 0, e: 100 }, { w: "beta", s: 120, e: 220 }, { w: "gama", s: 240, e: 340 }, { w: "delta", s: 360, e: 460 }];

test("resolveTimings: native alignment wins without calling ASR", async () => {
  let asrCalls = 0;
  const r = await resolveTimings(script, Buffer.alloc(0), 500, recWords, { asr: async () => { asrCalls++; return { words: [], durationMs: null, usd: 0 }; }, whisperConfigured: () => false });
  assert.equal(r.source, "fish-native");
  assert.equal(asrCalls, 0);
  assert.equal(r.words[2].w, "gamma");
});

test("resolveTimings: empty native → Fish ASR → whisper → estimate", async () => {
  const asrOk = await resolveTimings(script, Buffer.alloc(0), 500, [], { asr: async () => ({ words: recWords, durationMs: 500, usd: 0.0001 }), whisperConfigured: () => false });
  assert.equal(asrOk.source, "fish-asr");
  assert.equal(asrOk.usd, 0.0001);

  const whisperOk = await resolveTimings(script, Buffer.alloc(0), 500, [], {
    asr: async () => { throw new Error("asr down"); },
    whisperConfigured: () => true,
    whisper: async () => ({ words: recWords, usd: 0 }),
  });
  assert.equal(whisperOk.source, "whisper");
  assert.deepEqual(whisperOk.words.map((w) => w.w), ["alpha", "beta", "gamma", "delta"]);

  const est = await resolveTimings(script, Buffer.alloc(0), 2000, [], {
    asr: async () => ({ words: [], durationMs: null, usd: 0 }),
    whisperConfigured: () => true,
    whisper: async () => { throw new Error("no whisper"); },
  });
  assert.equal(est.source, "estimate");
  assert.equal(est.words.length, 4);
});

// ───────── provider selection ─────────
const fake = (id: TtsProvider["id"], on: boolean): TtsProvider => ({ id, isConfigured: () => on, synthesize: async () => { throw new Error("n/a"); } });

test("ttsFor: explicit kit provider → env TTS_PROVIDER → fish → elevenlabs → kokoro; FREE prefers kokoro", () => {
  const all = { fish: fake("fish", true), elevenlabs: fake("elevenlabs", true), kokoro: fake("kokoro", true) };
  assert.equal(ttsFor("elevenlabs", { providers: all, envProvider: "" }).id, "elevenlabs");
  assert.equal(ttsFor(undefined, { providers: all, envProvider: "kokoro" }).id, "kokoro");
  assert.equal(ttsFor(undefined, { providers: all, envProvider: "" }).id, "fish");
  assert.equal(ttsFor("fish", { providers: all, free: true, envProvider: "" }).id, "kokoro");
  const noFish = { ...all, fish: fake("fish", false) };
  assert.equal(ttsFor("fish", { providers: noFish, envProvider: "fish" }).id, "elevenlabs");
  const onlyKokoro = { fish: fake("fish", false), elevenlabs: fake("elevenlabs", false), kokoro: fake("kokoro", true) };
  assert.equal(ttsFor(undefined, { providers: onlyKokoro, envProvider: "" }).id, "kokoro");
  const none = { fish: fake("fish", false), elevenlabs: fake("elevenlabs", false), kokoro: fake("kokoro", false) };
  assert.equal(ttsFor(undefined, { providers: none, envProvider: "" }).id, "fish");
});

test("curateFishVoices: defaults first, celebrity/character voices filtered, deduped by title", () => {
  const items = [
    { _id: "a".repeat(32), title: "Elon Musk(Noise reduction)", tags: ["narration"], languages: ["en"], visibility: "public" },
    { _id: "b".repeat(32), title: "Smash Bros", tags: ["narration"], languages: ["en"] },
    { _id: "c".repeat(32), title: "Kid", tags: ["character-voice", "narration"], languages: ["en"] },
    { _id: "d".repeat(32), title: "Sarah", tags: ["conversational", "narration"], languages: ["en"], samples: [{ audio: "https://x/s.mp3" }] },
    { _id: "e".repeat(32), title: "Sarah", tags: ["narration"], languages: ["en"] },
    { _id: "f".repeat(32), title: "Nina", tags: ["narration"], languages: ["de"] },
  ];
  const v = curateFishVoices(items);
  assert.equal(v.length, 4);
  assert.deepEqual(v.slice(0, 3).map((x) => x.voiceId), [FISH_DEFAULT_VOICES.calm.id, FISH_DEFAULT_VOICES.neutral.id, FISH_DEFAULT_VOICES.energetic.id]);
  assert.equal(v[3].name, "Sarah");
  assert.equal(v[3].previewUrl, "https://x/s.mp3");
  assert.ok(v.every((x) => x.provider === "fish"));
});
