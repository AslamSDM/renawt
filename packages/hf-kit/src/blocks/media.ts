import type { z } from "zod";
import type { BlockFn } from "./types";
import type { ImageData, OutroData } from "./schema";
import { iconSvg } from "./icons";
import { esc, fitFontSize } from "../util";

/** Maximum Ken Burns zoom (6%). Lint checks this too. */
export const KEN_BURNS_MAX = 1.06;

/** Full-bleed image with a gentle Ken Burns, scrims for legibility, headline + caption. */
export const image: BlockFn<z.infer<typeof ImageData>> = (ctx) => {
  const { sid, box, anim } = ctx;
  const d = ctx.data;
  const asset = (d.assetId ? ctx.assets.find((a) => a.id === d.assetId) : undefined) ?? ctx.assets[0];
  if (!asset) throw new Error(`image block (${sid}) needs an asset: set scene.assetIds[0] or data.assetId`);
  if (asset.kind === "video") throw new Error(`image block (${sid}): asset ${asset.id} is a video; video b-roll must be mounted in index.html, not inside a scene`);
  const size = ctx.headline ? fitFontSize(ctx.headline, { maxWidth: box.w, maxLines: 3, base: ctx.type.xl, min: 60 }) : 0;
  const html = `
      <div id="${sid}-kb" class="${sid}-kb"><img id="${sid}-img" class="${sid}-img" src="${esc(asset.url)}" alt=""></div>
      <div class="${sid}-scrim"></div>
      ${ctx.headline ? `<div id="${sid}-title" class="${sid}-display ${sid}-ih" style="font-size:${size}px">${esc(ctx.headline)}</div>` : ""}
      ${d.caption ? `<div id="${sid}-cap" class="${sid}-icap">${esc(d.caption)}</div>` : ""}
      ${d.credit || asset.license ? `<div id="${sid}-credit" class="${sid}-icr">${esc(d.credit ?? asset.source)}</div>` : ""}`;
  const css = `
    .${sid}-kb { position: absolute; left: 0; top: 0; width: ${ctx.width}px; height: ${ctx.height}px; overflow: hidden; }
    .${sid}-img { position: absolute; left: 0; top: 0; width: ${ctx.width}px; height: ${ctx.height}px; object-fit: cover; }
    .${sid}-scrim { position: absolute; inset: 0; background: linear-gradient(180deg, color-mix(in srgb, var(--bg) 78%, transparent) 0%, transparent 34%, transparent 52%, color-mix(in srgb, var(--bg) 82%, transparent) 100%); }
    .${sid}-ih { position: absolute; left: ${box.x}px; top: ${box.y}px; width: ${box.w}px; font-weight: 900; text-shadow: 0 4px 30px color-mix(in srgb, var(--bg) 70%, transparent); }
    .${sid}-icap { position: absolute; left: ${box.x}px; top: ${box.y + box.h - 90}px; width: ${box.w}px; font-family: var(--font-mono); font-size: var(--fs-label); text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink); }
    .${sid}-icr { position: absolute; right: ${box.x}px; top: ${box.y + box.h - 40}px; font-family: var(--font-mono); font-size: 28px; color: var(--muted); }
  `;
  const D = ctx.durationS;
  const kb = d.kenBurns;
  if (kb === "in") anim.fromTo(`#${sid}-kb`, { scale: 1 }, { scale: KEN_BURNS_MAX, duration: D, ease: "none" }, 0);
  else if (kb === "out") anim.fromTo(`#${sid}-kb`, { scale: KEN_BURNS_MAX }, { scale: 1, duration: D, ease: "none" }, 0);
  else if (kb === "left" || kb === "right") anim.fromTo(`#${sid}-kb`, { scale: KEN_BURNS_MAX, x: kb === "left" ? 24 : -24 }, { scale: KEN_BURNS_MAX, x: kb === "left" ? -24 : 24, duration: D, ease: "none" }, 0);
  if (ctx.headline) anim.enter(`#${sid}-title`, ctx.isFirst ? 0 : 0.25, { from: "up" });
  if (d.caption) anim.enter(`#${sid}-cap`, 0.6, { from: "left", dist: 30 });
  if (d.credit || asset.license) anim.fadeIn(`#${sid}-credit`, 0.8);
  return { html, css, timeline: anim.out() };
};

/** CTA + handle. Callback line on top, follow pill pulses a fixed number of times. */
export const outro: BlockFn<z.infer<typeof OutroData>> = (ctx) => {
  const { sid, box, anim } = ctx;
  const d = ctx.data;
  const cta = d.cta ?? ctx.kit?.skin.outro.cta ?? "Follow for more";
  const handle = d.handle ?? (ctx.kit?.persona.name ? `@${ctx.kit.persona.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}` : "");
  const head = ctx.headline ?? "";
  const size = head ? fitFontSize(head, { maxWidth: box.w, maxLines: 4, base: ctx.type.xl, min: 60 }) : 0;
  const html = `
      <div id="${sid}-c" class="${sid}-oc">
        ${head ? `<div id="${sid}-h" class="${sid}-display ${sid}-oh" style="font-size:${size}px">${esc(head)}</div>` : ""}
        <div id="${sid}-btn" class="${sid}-btn">${iconSvg("bell", 60)}<span>${esc(cta)}</span></div>
        ${handle ? `<div id="${sid}-handle" class="${sid}-handle">${esc(handle)}</div>` : ""}
        ${d.sub ?? ctx.body ? `<div id="${sid}-sub" class="${sid}-osub">${esc(d.sub ?? ctx.body)}</div>` : ""}
      </div>`;
  const css = `
    #${sid}-c { position: absolute; left: ${box.x}px; top: ${box.y}px; width: ${box.w}px; height: ${box.h}px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; gap: 48px; }
    .${sid}-oh { font-weight: 900; }
    .${sid}-btn { display: inline-flex; align-items: center; gap: 22px; background: var(--accent); color: var(--on-accent); font-family: var(--font-display); font-weight: 800; font-size: var(--fs-s); padding: 30px 56px; border-radius: var(--r-pill); }
    .${sid}-handle { font-family: var(--font-mono); font-size: var(--fs-small); color: var(--accent); letter-spacing: 0.04em; }
    .${sid}-osub { font-size: var(--fs-body); color: var(--muted); line-height: 1.3; }
  `;
  const s0 = ctx.isFirst ? 0 : 0.1;
  if (head) anim.enter(`#${sid}-h`, s0, { from: "up" });
  anim.enter(`#${sid}-btn`, s0 + 0.35, { from: "scale", ease: "back.out(2)" });
  if (handle) anim.enter(`#${sid}-handle`, s0 + 0.55, { from: "up", dist: 20 });
  if (d.sub ?? ctx.body) anim.fadeIn(`#${sid}-sub`, s0 + 0.75);
  for (let i = 0; i < 3; i++) {
    const at = s0 + 1.1 + i * 0.9;
    if (at + 0.4 < ctx.durationS - 0.3) anim.pulse(`#${sid}-btn`, at, 1.06, 0.16);
  }
  return { html, css, timeline: anim.out() };
};
