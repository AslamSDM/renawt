import type { VisualSkin } from "@remawt/shared";
import type { z } from "zod";
import { Anim } from "../anim";
import { OVERLAY_SCHEMAS, type OverlayName } from "../blocks/schema";
import { contentBox, motionPreset, sceneBaseCss, SAFE } from "../skin/index";
import { esc, fitFontSize, r3 } from "../util";

export const OVERLAYS_ID = "overlays";

export interface OverlayItem {
  block: OverlayName;
  startMs: number;
  durationMs: number;
  data: Record<string, unknown>;
}

type Data<K extends OverlayName> = z.infer<(typeof OVERLAY_SCHEMAS)[K]>;

/**
 * One sub-composition (track 2) holding every overlay-* graphic drawn over footage. Each item is
 * a group with its own window on this composition's timeline (absolute video time): enters,
 * holds, exits, then a hard kill so it never lingers.
 */
export function overlaysComposition(opts: { items: OverlayItem[]; skin: VisualSkin; width: number; height: number; totalMs: number }): string | null {
  const { items, skin, width, height } = opts;
  if (!items.length) return null;
  const sid = OVERLAYS_ID;
  const box = contentBox(width, height);
  const motion = motionPreset(skin);
  const anim = new Anim(motion);
  const parts: string[] = [];
  const css: string[] = [];

  items.forEach((it, i) => {
    const g = `${sid}-o${i}`;
    const s = it.startMs / 1000;
    const e = Math.min(opts.totalMs, it.startMs + it.durationMs) / 1000;
    const exitAt = Math.max(s + 0.3, e - 0.3);
    anim.set(`#${g}`, { opacity: 0 }, 0);
    anim.set(`#${g}`, { opacity: 1 }, s);
    switch (it.block) {
      case "overlay-lower-third": {
        const d = it.data as Data<"overlay-lower-third">;
        parts.push(`<div id="${g}" class="${sid}-lt"><div id="${g}-bar" class="${sid}-ltbar"></div><div id="${g}-tx" class="${sid}-lttx"><div class="${sid}-ltn">${esc(d.name)}</div>${d.title ? `<div class="${sid}-ltt">${esc(d.title)}</div>` : ""}</div></div>`);
        anim.grow(`#${g}-bar`, "y", s, { dur: 0.3, origin: "50% 0%" });
        anim.fromTo(`#${g}-tx`, { x: -60 }, { x: 0, duration: motion.dur, ease: motion.ease }, s + 0.1);
        anim.fromTo(`#${g}-tx`, { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: motion.dur, ease: motion.ease }, s + 0.1);
        break;
      }
      case "overlay-keyword": {
        const d = it.data as Data<"overlay-keyword">;
        const size = fitFontSize(d.text.toUpperCase(), { maxWidth: box.w - 80, maxLines: 2, base: 110, min: 56, factor: 0.62 });
        parts.push(`<div id="${g}" class="${sid}-kw"><span id="${g}-w" class="${sid}-kww" style="font-size:${size}px">${esc(d.text)}</span></div>`);
        anim.fromTo(`#${g}-w`, { scale: 0.6, rotation: -4 }, { scale: 1, rotation: -2, duration: 0.35, ease: "back.out(2.4)" }, s);
        break;
      }
      case "overlay-stat": {
        const d = it.data as Data<"overlay-stat">;
        parts.push(`<div id="${g}" class="${sid}-st"><div id="${g}-c" class="${sid}-stc"><span class="${sid}-stv">${esc(d.value)}</span><span class="${sid}-stl">${esc(d.label)}</span></div></div>`);
        anim.fromTo(`#${g}-c`, { y: -40, scale: 0.92 }, { y: 0, scale: 1, duration: motion.dur, ease: motion.ease }, s);
        break;
      }
      case "overlay-progress": {
        const d = it.data as Data<"overlay-progress">;
        const segs = Array.from({ length: d.total }, (_, k) => `<i id="${g}-p${k}" class="${k < d.current ? `${sid}-on` : ""}"></i>`).join("");
        parts.push(`<div id="${g}" class="${sid}-pg"><div class="${sid}-pgs">${segs}</div>${d.label ? `<div class="${sid}-pgl">${esc(d.label)}</div>` : ""}</div>`);
        anim.grow(`#${g}-p${d.current - 1}`, "x", s + 0.1, { dur: 0.5 });
        break;
      }
    }
    anim.to(`#${g}`, { opacity: 0, duration: 0.25, ease: "power1.in" }, exitAt);
    anim.set(`#${g}`, { opacity: 0 }, e);
  });

  css.push(`
    .${sid}-lt { position: absolute; left: ${box.x}px; top: ${box.y + box.h - 190}px; display: flex; gap: 22px; align-items: stretch; }
    .${sid}-ltbar { width: 12px; background: var(--accent); border-radius: var(--r-sm); }
    .${sid}-lttx { background: color-mix(in srgb, var(--surface) 92%, transparent); padding: 22px 34px; border-radius: var(--r-md); }
    .${sid}-ltn { font-family: var(--font-display); font-weight: 800; font-size: 60px; line-height: 1.05; }
    .${sid}-ltt { font-family: var(--font-mono); font-size: var(--fs-label); color: var(--accent); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 8px; }
    .${sid}-kw { position: absolute; left: ${box.x}px; top: ${box.y + 120}px; width: ${box.w}px; display: flex; justify-content: center; }
    .${sid}-kww { display: inline-block; font-family: var(--font-display); font-weight: 900; text-transform: uppercase; background: var(--accent); color: var(--on-accent); padding: 12px 34px; border-radius: var(--r-md); line-height: 1.05; text-align: center; }
    .${sid}-st { position: absolute; right: ${box.x}px; top: ${box.y + 20}px; }
    .${sid}-stc { display: flex; flex-direction: column; background: color-mix(in srgb, var(--surface) 94%, transparent); border: 3px solid var(--accent); border-radius: var(--r-lg); padding: 26px 36px; max-width: 520px; }
    .${sid}-stv { font-family: var(--font-display); font-weight: 900; font-size: 96px; line-height: 1; color: var(--accent); }
    .${sid}-stl { font-size: var(--fs-small); line-height: 1.2; margin-top: 8px; }
    .${sid}-pg { position: absolute; left: ${box.x}px; top: ${SAFE.top - 10}px; width: ${box.w}px; }
    .${sid}-pgs { display: flex; gap: 10px; }
    .${sid}-pgs i { flex: 1; height: 12px; border-radius: 6px; background: color-mix(in srgb, var(--ink) 30%, transparent); }
    .${sid}-pgs i.${sid}-on { background: var(--accent); }
    .${sid}-pgl { display: inline-block; font-family: var(--font-mono); font-size: var(--fs-label); margin-top: 14px; background: color-mix(in srgb, var(--bg) 85%, transparent); padding: 6px 14px; border-radius: var(--r-sm); }
  `);

  return `<template>
  <style>
    ${sceneBaseCss(sid, skin, width, height).replace(new RegExp(`#${sid}-bg[^\\n]*\\n`), "").trim()}
    ${css.join("\n")}
  </style>
  <div id="root" data-composition-id="${sid}" data-width="${width}" data-height="${height}">
    ${parts.join("\n    ")}
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
