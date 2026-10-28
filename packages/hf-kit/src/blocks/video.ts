import type { z } from "zod";
import type { BlockFn } from "./types";
import type { VideoSegmentData } from "./schema";
import { esc, r1, r3 } from "../util";

type D = z.infer<typeof VideoSegmentData>;

/**
 * User footage, trimmed. The <video> lives inside the scene sub-composition (the host propagates
 * its offset), timed on the element itself (never on a wrapper): data-start=0 (scene-local),
 * data-duration = scene slot, data-media-start = inMs. No Ken Burns; no CSS filters on footage.
 *
 * crop: "cover" fills 1080×1920; "blur-pad" letterboxes (contain) over a skin-tinted pad — a true
 * blurred pad must be baked at ingest with ffmpeg (CSS blur on footage is against the contract);
 * {x,y,w,h}: that source rect fills the frame (fractions, or px when asset width/height are known).
 */
export const videoSegment: BlockFn<D> = (ctx) => {
  const { sid, width: W, height: H } = ctx;
  const d = ctx.data;
  const asset = (d.assetId ? ctx.assets.find((a) => a.id === d.assetId) : undefined) ?? ctx.assets[0];
  if (!asset) throw new Error(`video-segment (${sid}) needs a user-video asset in scene.assetIds[0]`);
  if (asset.kind !== "video" && asset.kind !== "user-video") throw new Error(`video-segment (${sid}): asset ${asset.id} is ${asset.kind}, expected user-video`);
  const dur = r3(ctx.durationS);
  const audio = ctx.videoHasAudio ? `data-has-audio="true" data-volume="1"` : `muted`;

  let style = `left:0;top:0;width:${W}px;height:${H}px;object-fit:cover`;
  const crop = d.crop;
  if (crop === "blur-pad") style = `left:0;top:0;width:${W}px;height:${H}px;object-fit:contain`;
  else if (typeof crop === "object") {
    const sw = asset.width ?? W, sh = asset.height ?? H;
    const frac = crop.x <= 1 && crop.y <= 1 && crop.w <= 1 && crop.h <= 1;
    const cx = frac ? crop.x * sw : crop.x, cy = frac ? crop.y * sh : crop.y;
    const cw = frac ? crop.w * sw : crop.w, ch = frac ? crop.h * sh : crop.h;
    const k = Math.max(W / cw, H / ch);
    const vw = sw * k, vh = sh * k;
    const left = -cx * k + (W - cw * k) / 2, top = -cy * k + (H - ch * k) / 2;
    style = `left:${r1(left)}px;top:${r1(top)}px;width:${r1(vw)}px;height:${r1(vh)}px;object-fit:fill`;
  }

  const html = `
      ${crop === "blur-pad" ? `<div class="${sid}-pad"></div>` : ""}
      <div class="${sid}-frame" data-layout-allow-overflow>
        <video id="${sid}-v" class="clip ${sid}-v" src="${esc(asset.url)}" playsinline ${audio} data-start="0" data-duration="${dur}" data-media-start="${r3(d.inMs / 1000)}" data-track-index="0" style="${style}"></video>
      </div>`;
  const css = `
    .${sid}-frame { position: absolute; inset: 0; overflow: hidden; }
    .${sid}-v { position: absolute; }
    .${sid}-pad { position: absolute; inset: 0; background: radial-gradient(120% 60% at 50% 50%, color-mix(in srgb, var(--accent) 22%, var(--bg)), var(--bg)); }
  `;
  return { html, css, timeline: "" };
};
