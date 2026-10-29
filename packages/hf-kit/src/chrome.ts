import type { VisualSkin } from "@remawt/shared";
import { grainBackground, sceneBaseCss } from "./skin/index";
import { r3 } from "./util";

export const OVERLAY_ID = "chrome";

/** "chrome" sub-composition: film grain (skin.grain), full duration. */
export function overlayComposition(opts: { skin: VisualSkin; width: number; height: number; totalMs: number }): string | null {
  const { skin, width, height } = opts;
  if (!skin.grain) return null;
  const sid = OVERLAY_ID;
  return `<template>
  <style>
    ${sceneBaseCss(sid, skin, width, height).replace(new RegExp(`#${sid}-bg[^\\n]*\\n`), "")}
    #${sid}-grain { position: absolute; inset: 0; background-image: ${grainBackground(11)}; background-size: 240px 240px; opacity: 0.09; mix-blend-mode: overlay; pointer-events: none; }
  </style>
  <div id="root" data-composition-id="${sid}" data-width="${width}" data-height="${height}">
    <div id="${sid}-grain" data-layout-ignore></div>
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
