import type { VisualSkin, VoiceTrack } from "@remawt/shared";
import { Anim } from "../anim";
import { MOTION, captionBand, mixHex, sceneBaseCss } from "../skin/index";
import { esc, fitFontSize, r3 } from "../util";

type Word = VoiceTrack["words"][number];

export interface CaptionChunk { text: string; startMs: number; endMs: number; words: Word[] }
export interface ChunkOptions { maxWords?: number; maxSpanMs?: number; pauseMs?: number }

const PUNCT_END = /[.!?;:,—…)"”]$/;

/**
 * Word timings (ms) → caption chunks. A chunk closes after punctuation, at `maxWords` (4),
 * when adding the next word would stretch it past `maxSpanMs` (1.2 s), or before a pause ≥ `pauseMs`.
 */
export function chunkWords(words: Word[], opts: ChunkOptions = {}): CaptionChunk[] {
  const maxWords = opts.maxWords ?? 4;
  const maxSpan = opts.maxSpanMs ?? 1200;
  const pause = opts.pauseMs ?? 150;
  const out: CaptionChunk[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (!cur.length) return;
    out.push({ text: cur.map((w) => w.w).join(" "), startMs: cur[0].s, endMs: cur[cur.length - 1].e, words: cur });
    cur = [];
  };
  for (const w of words) {
    if (!w.w.trim()) continue;
    if (cur.length) {
      const prev = cur[cur.length - 1];
      if (w.s - prev.e >= pause || cur.length >= maxWords || w.e - cur[0].s > maxSpan) flush();
    }
    cur.push(w);
    if (PUNCT_END.test(w.w)) flush();
  }
  flush();
  return out;
}

/** On-screen windows: one group at a time, opens ≥100 ms in, holds ≤300 ms past its last word. */
export function captionWindows(chunks: CaptionChunk[], totalMs: number): Array<{ s: number; e: number }> {
  let prevEnd = 0;
  return chunks.map((c, i) => {
    const s = Math.max(100, c.startMs - 40, prevEnd);
    const next = chunks[i + 1]?.startMs ?? totalMs;
    const e = Math.max(Math.min(Math.max(c.endMs + 300, s + 400), next - 20, totalMs - 40), s + 120);
    prevEnd = e;
    return { s, e };
  });
}

export const CAPTIONS_ID = "captions";

/** Caption overlay sub-composition (`compositions/captions.html`). */
export function captionsComposition(opts: { chunks: CaptionChunk[]; skin: VisualSkin; style?: VisualSkin["captionStyle"]; width: number; height: number; totalMs: number }): string {
  const { chunks, skin, width, height } = opts;
  const style = opts.style ?? skin.captionStyle;
  const sid = CAPTIONS_ID;
  const band = captionBand(width, height);
  const anim = new Anim(MOTION[skin.motion] ?? MOTION.editorial);
  const wins = captionWindows(chunks, opts.totalMs);
  const big = style === "karaoke" || style === "centered";
  const base = style === "minimal" ? 54 : big ? 86 : 68;
  const ink = skin.palette.ink;
  const dimInk = mixHex(ink, skin.palette.bg, 0.25);

  const groups = chunks.map((c, i) => {
    const size = fitFontSize(style === "karaoke" ? c.text.toUpperCase() : c.text, { maxWidth: band.w - 80, maxLines: 2, base, min: 44, factor: big ? 0.6 : 0.55 });
    const ws = c.words.map((w, j) => `<span id="${sid}-g${i}w${j}" class="${sid}-w">${esc(w.w)}</span>`).join(" ");
    return `<div id="${sid}-g${i}" class="${sid}-g"><span class="${sid}-box" style="font-size:${size}px">${ws}</span></div>`;
  }).join("\n    ");

  chunks.forEach((c, i) => {
    const { s, e } = wins[i];
    const g = `#${sid}-g${i}`;
    anim.set(g, { opacity: 0 }, 0);
    anim.set(g, { opacity: 1 }, s / 1000);
    if (style !== "minimal") anim.fromTo(`${g} .${sid}-box`, { scale: 0.94 }, { scale: 1, duration: 0.14, ease: "power2.out" }, s / 1000);
    anim.set(g, { opacity: 0 }, e / 1000);
    if (style === "karaoke") {
      c.words.forEach((w, j) => {
        const sel = `#${sid}-g${i}w${j}`;
        anim.to(sel, { color: skin.palette.accent, scale: 1.08, duration: 0.06, ease: "power1.out" }, Math.max(s, w.s) / 1000);
        anim.to(sel, { color: ink, scale: 1, duration: 0.1, ease: "power1.out" }, Math.max(s, w.e) / 1000);
      });
    }
  });

  const font = big ? "var(--font-display)" : "var(--font-body)";
  const styleCss: Record<string, string> = {
    bottom: `.${sid}-box { background: color-mix(in srgb, var(--surface) 90%, transparent); color: var(--ink); padding: 16px 30px; border-radius: var(--r-md); font-weight: 700; line-height: 1.18; box-decoration-break: clone; -webkit-box-decoration-break: clone; }`,
    centered: `.${sid}-box { color: var(--ink); font-weight: 800; line-height: 1.08; text-shadow: 0 4px 22px color-mix(in srgb, var(--bg) 85%, transparent), 0 0 4px color-mix(in srgb, var(--bg) 90%, transparent); }`,
    karaoke: `.${sid}-box { color: ${dimInk}; font-weight: 900; line-height: 1.06; text-transform: uppercase; text-shadow: 0 4px 22px color-mix(in srgb, var(--bg) 85%, transparent), 0 0 4px color-mix(in srgb, var(--bg) 90%, transparent); } .${sid}-w { color: ${ink}; }`,
    minimal: `.${sid}-box { color: var(--ink); font-weight: 600; line-height: 1.2; text-shadow: 0 2px 14px color-mix(in srgb, var(--bg) 80%, transparent); }`,
  };

  return `<template>
  <style>
    ${sceneBaseCss(sid, skin, width, height).replace(new RegExp(`#${sid}-bg[^\\n]*\\n`), "")}
    .${sid}-g { position: absolute; left: ${band.x}px; top: ${band.y}px; width: ${band.w}px; height: ${band.h}px; display: flex; align-items: center; justify-content: center; text-align: center; overflow: visible; }
    .${sid}-box { display: inline-block; font-family: ${font}; max-width: ${band.w - 40}px; }
    .${sid}-w { display: inline-block; }
    ${styleCss[style] ?? styleCss.bottom}
  </style>
  <div id="root" data-composition-id="${sid}" data-width="${width}" data-height="${height}">
    ${groups}
  </div>
  <script>
    (function () {
      window.__timelines = window.__timelines || {};
      var tl = gsap.timeline({ paused: true });
      ${anim.out()}
      tl.set({}, {}, ${r3(opts.totalMs / 1000)});
      window.__timelines["${sid}"] = tl;
    })();
  </script>
</template>
`;
}
