import type { VoiceTrack } from "@remawt/shared";
import { esc, r3 } from "../util";

export interface MusicInput { url: string; bpm: number; durationMs: number }
export interface SfxInput { atMs: number; url: string; durationMs?: number; volume?: number }

export const NARRATION_VOLUME = 1;
/** Music bed baseline (≈ −12 dB); the automation lane ducks it further under speech. */
export const MUSIC_VOLUME = 0.25;
/** Lane multiplier under narration (≈ −10 dB below the bed). */
export const DUCK_LEVEL = 0.32;
export const SFX_VOLUME = 0.5;

/** Speech regions (ms) from word timings, merging gaps shorter than `mergeGapMs`. */
export function speechRegions(words: VoiceTrack["words"], mergeGapMs = 450): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const w of words) {
    const last = out[out.length - 1];
    if (last && w.s - last[1] <= mergeGapMs) last[1] = Math.max(last[1], w.e);
    else out.push([w.s, w.e]);
  }
  return out;
}

/**
 * `data-automation` volume lane for the music bed: fade in, duck under each speech region
 * (150 ms ramps), fade out. `t` is clip-local seconds, `v` multiplies `data-volume`.
 */
export function duckingLane(words: VoiceTrack["words"], totalMs: number, clipStartMs = 0, clipDurMs = totalMs): string {
  const pts: Array<{ t: number; v: number }> = [];
  const add = (ms: number, v: number) => {
    const t = r3((ms - clipStartMs) / 1000);
    if (t < 0 || t > clipDurMs / 1000) return;
    if (pts.length && t <= pts[pts.length - 1].t) { pts[pts.length - 1].v = v; return; }
    pts.push({ t, v });
  };
  const ramp = 150;
  if (clipStartMs === 0) { add(0, 0); add(600, 1); } else add(clipStartMs, 1);
  for (const [s, e] of speechRegions(words)) {
    add(Math.max(clipStartMs, s - ramp), 1);
    add(s, DUCK_LEVEL);
    add(e, DUCK_LEVEL);
    add(e + ramp, 1);
  }
  const end = Math.min(totalMs, clipStartMs + clipDurMs);
  if (end === totalMs) { add(Math.max(0, end - 1500), pts[pts.length - 1]?.v ?? 1); add(end, 0); }
  return JSON.stringify({ version: 1, lanes: [{ target: "volume", points: pts }] });
}

export interface AudioPlan {
  /** `<audio>` tags, direct children of the root composition. */
  html: string;
  /** URLs in the order the render Lambda expects (`assets.audioUrls`): narration, then music. */
  audioUrls: string[];
}

/**
 * Root-level `<audio>` elements the way the legacy `injectAudioIntoIndexHtml` wrote them
 * (narration on track 10, music on track 11, SFX on 20+). The HyperFrames renderer mixes these
 * itself, honouring `data-volume` and the `data-automation` ducking lane.
 *
 * The AWS render Lambda instead downloads `assets.audioUrls` and `amix`es them at equal weight
 * from t=0 (deploy/aws/render-lambda/src/handler.ts): no ducking, no SFX offsets. Pass only the
 * narration (or a pre-mixed track from `mixAudioLocal`) as audioUrls when that matters.
 */
export function buildAudio(opts: { voice: VoiceTrack; music?: MusicInput | null; sfx?: SfxInput[]; totalMs: number }): AudioPlan {
  const { voice, music, totalMs } = opts;
  const tags: string[] = [];
  const totalS = r3(totalMs / 1000);
  if (voice.audioUrl) {
    const dur = r3(Math.min(voice.durationMs || totalMs, totalMs) / 1000);
    tags.push(`<audio id="narration" src="${esc(voice.audioUrl)}" data-start="0" data-duration="${dur}" data-track-index="10" data-volume="${NARRATION_VOLUME}"></audio>`);
  }
  if (music?.url) {
    const len = music.durationMs > 1000 ? music.durationMs : totalMs;
    // Tile short beds so the tail isn't silent (no loop attribute in the render contract).
    for (let i = 0, start = 0; start < totalMs && i < 12; i++, start += len) {
      const dur = Math.min(len, totalMs - start);
      const lane = duckingLane(voice.words, totalMs, start, dur);
      tags.push(`<audio id="music${i ? `-${i + 1}` : ""}" src="${esc(music.url)}" data-start="${r3(start / 1000)}" data-duration="${r3(dur / 1000)}" data-track-index="11" data-volume="${MUSIC_VOLUME}" data-automation='${lane}'></audio>`);
    }
  }
  (opts.sfx ?? []).filter((s) => s.url && s.atMs < totalMs - 100).forEach((s, i) => {
    const dur = Math.min(s.durationMs ?? 1500, totalMs - s.atMs);
    tags.push(`<audio id="sfx-${i + 1}" src="${esc(s.url)}" data-start="${r3(s.atMs / 1000)}" data-duration="${r3(dur / 1000)}" data-track-index="${20 + (i % 4)}" data-volume="${s.volume ?? SFX_VOLUME}"></audio>`);
  });
  void totalS;
  return { html: tags.join("\n      "), audioUrls: [voice.audioUrl, music?.url].filter((u): u is string => !!u) };
}

/** Extract the audio elements back out of an index.html (used by scaffold + local mixing). */
export function parseAudioTags(indexHtml: string): Array<{ id: string; src: string; start: number; duration: number; volume: number; automation?: string }> {
  const out: Array<{ id: string; src: string; start: number; duration: number; volume: number; automation?: string }> = [];
  const re = /<audio\b([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(indexHtml))) {
    const a = m[1];
    const attr = (n: string) => a.match(new RegExp(`${n}=(?:"([^"]*)"|'([^']*)')`))?.slice(1).find((x) => x !== undefined);
    out.push({
      id: attr("id") ?? "",
      src: (attr("src") ?? "").replace(/&amp;/g, "&"),
      start: Number(attr("data-start") ?? 0),
      duration: Number(attr("data-duration") ?? 0),
      volume: Number(attr("data-volume") ?? 1),
      automation: attr("data-automation"),
    });
  }
  return out;
}

/**
 * ffmpeg filter graph that reproduces the in-HTML mix (offsets, volumes, sidechain ducking of the
 * music under narration). Used by the local renderer when the CLI output has no audio stream.
 */
export function mixFilter(tracks: ReturnType<typeof parseAudioTags>, totalS: number): { inputs: string[]; filter: string } {
  const inputs = tracks.map((t) => t.src);
  const parts: string[] = [];
  const labels: string[] = [];
  const voiceIdx = tracks.findIndex((t) => t.id === "narration");
  tracks.forEach((t, i) => {
    const delay = Math.round(t.start * 1000);
    parts.push(`[${i}:a]atrim=0:${r3(t.duration)},adelay=${delay}|${delay},volume=${t.volume}[a${i}]`);
  });
  const music = tracks.map((t, i) => (t.id.startsWith("music") ? i : -1)).filter((i) => i >= 0);
  if (voiceIdx >= 0 && music.length) {
    parts.push(`[a${voiceIdx}]asplit=2[vo][sc]`);
    parts.push(`${music.map((i) => `[a${i}]`).join("")}amix=inputs=${music.length}:normalize=0[bed]`);
    parts.push(`[bed][sc]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=350[duck]`);
    labels.push("[vo]", "[duck]");
  } else {
    music.forEach((i) => labels.push(`[a${i}]`));
    if (voiceIdx >= 0) labels.push(`[a${voiceIdx}]`);
  }
  tracks.forEach((t, i) => { if (i !== voiceIdx && !music.includes(i)) labels.push(`[a${i}]`); });
  parts.push(`${labels.join("")}amix=inputs=${labels.length}:normalize=0:duration=longest,atrim=0:${r3(totalS)}[out]`);
  return { inputs, filter: parts.join(";") };
}
