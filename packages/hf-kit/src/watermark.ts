import type { VisualSkin } from "@remawt/shared";
import { captionBand, grainBackground, sceneBaseCss } from "./skin/index";
import { r3 } from "./util";

export const OVERLAY_ID = "chrome";
export const WATERMARK_TEXT = "made with remawt";

/** Small corner mark for the FREE plan: bottom-left, just under the caption band (inside the UI-safe zone). */
export function watermarkHtml(width = 1080, height = 1920): { html: string; css: string } {
  const band = captionBand(width, height);
  const top = band.y + band.h + 12;
  return {
    html: `<div id="${OVERLAY_ID}-wm" class="${OVERLAY_ID}-wm"><i></i>${WATERMARK_TEXT}</div>`,
    css: `.${OVERLAY_ID}-wm { position: absolute; left: ${band.x}px; top: ${top}px; display: flex; align-items: center; gap: 10px; font-family: var(--font-mono); font-size: 28px; letter-spacing: 0.04em; color: var(--ink); opacity: 0.72; background: color-mix(in srgb, var(--bg) 55%, transparent); padding: 6px 14px; border-radius: 8px; }
    .${OVERLAY_ID}-wm i { display: block; width: 14px; height: 14px; border-radius: 50%; background: var(--accent); }`,
  };
}

/** "chrome" sub-composition: film grain (skin.grain) and/or the free-plan watermark, full duration. */
export function overlayComposition(opts: { skin: VisualSkin; watermark: boolean; width: number; height: number; totalMs: number }): string | null {
  const { skin, watermark, width, height } = opts;
  if (!skin.grain && !watermark) return null;
  const wm = watermark ? watermarkHtml(width, height) : null;
  const sid = OVERLAY_ID;
  return `<template>
  <style>
    ${sceneBaseCss(sid, skin, width, height).replace(new RegExp(`#${sid}-bg[^\\n]*\\n`), "")}
    #${sid}-grain { position: absolute; inset: 0; background-image: ${grainBackground(11)}; background-size: 240px 240px; opacity: 0.09; mix-blend-mode: overlay; pointer-events: none; }
    ${wm?.css ?? ""}
  </style>
  <div id="root" data-composition-id="${sid}" data-width="${width}" data-height="${height}">
    ${skin.grain ? `<div id="${sid}-grain" data-layout-ignore></div>` : ""}
    ${wm?.html ?? ""}
  </div>
  <script>
    (function () {
      window.__timelines = window.__timelines || {};
      var tl = gsap.timeline({ paused: true });
      tl.set({}, {}, ${r3(opts.totalMs / 1000)});
      window.__timelines["${sid}"] = tl;
    })();
  </script>
</template>
`;
}
