import type { z } from "zod";
import type { BlockFn } from "./types";
import type { BulletStackData, IconGridData } from "./schema";
import { titleCss, titleHtml } from "./common";
import { iconSvg } from "./icons";
import { esc, fitFontSize, r1 } from "../util";

/** 2–5 bullets revealed one at a time across the scene; earlier bullets dim. */
export const bulletStack: BlockFn<z.infer<typeof BulletStackData>> = (ctx) => {
  const { sid, box, anim } = ctx;
  const d = ctx.data;
  const items = d.items.map((it) => (typeof it === "string" ? { text: it, sub: undefined, icon: undefined } : it));
  const t = titleHtml(ctx, ctx.headline);
  const areaH = box.h - t.h;
  const rowH = Math.min(230, (areaH - (items.length - 1) * 28) / items.length);
  const longest = items.reduce((a, b) => (b.text.length > a.length ? b.text : a), "");
  const size = fitFontSize(longest, { maxWidth: box.w - 180, maxLines: 2, base: ctx.type.s, min: 40 });
  const html = `
      ${t.html}
      <div id="${sid}-c" class="${sid}-bs">
        ${items.map((it, i) => `<div id="${sid}-i${i}" class="${sid}-row ${sid}-card" style="min-height:${r1(rowH)}px">
          <span class="${sid}-bic">${it.icon ? iconSvg(it.icon, 60) : d.numbered ? `<b>${i + 1}</b>` : `<i></i>`}</span>
          <span class="${sid}-btx"><span class="${sid}-bt" style="font-size:${size}px">${esc(it.text)}</span>${it.sub ? `<span class="${sid}-bsub">${esc(it.sub)}</span>` : ""}</span>
        </div>`).join("\n        ")}
      </div>`;
  const css = `
    ${titleCss(ctx)}
    #${sid}-c { position: absolute; left: ${box.x}px; top: ${box.y + t.h}px; width: ${box.w}px; height: ${areaH}px; display: flex; flex-direction: column; justify-content: center; gap: 28px; }
    .${sid}-row { display: flex; align-items: center; gap: 34px; padding: 26px 36px; box-sizing: border-box; }
    .${sid}-bic { flex: none; width: 100px; height: 100px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent); display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-size: 52px; }
    .${sid}-bic i { display: block; width: 28px; height: 28px; border-radius: 50%; background: var(--accent); }
    .${sid}-btx { display: flex; flex-direction: column; gap: 8px; }
    .${sid}-bt { font-family: var(--font-display); font-weight: 800; line-height: 1.1; }
    .${sid}-bsub { font-size: var(--fs-small); color: var(--muted); line-height: 1.25; }
  `;
  if (t.html) anim.enter(`#${sid}-title`, ctx.isFirst ? 0 : 0.1, { from: "up", dist: 30 });
  const t0 = 0.35;
  const span = Math.max(0.6, ctx.durationS * 0.78 - t0);
  const step = items.length > 1 ? span / items.length : 0;
  items.forEach((_, i) => {
    const at = t0 + i * step;
    anim.enter(`#${sid}-i${i}`, at, { from: "left", dist: 80 });
    if (i > 0) anim.fadeTo(`#${sid}-i${i - 1}`, 0.45, at, 0.3);
  });
  return { html, css, timeline: anim.out() };
};

/** Grid of icon tiles that pop in with a stagger. */
export const iconGrid: BlockFn<z.infer<typeof IconGridData>> = (ctx) => {
  const { sid, box, anim } = ctx;
  const d = ctx.data;
  const n = d.items.length;
  const cols = d.columns ?? (n <= 4 ? 2 : 3);
  const rows = Math.ceil(n / cols);
  const t = titleHtml(ctx, ctx.headline);
  const gap = 28;
  const tileW = (box.w - (cols - 1) * gap) / cols;
  const tileH = Math.min(tileW, (box.h - t.h - (rows - 1) * gap) / rows);
  const html = `
      ${t.html}
      <div id="${sid}-c" class="${sid}-ig">
        ${d.items.map((it, i) => `<div id="${sid}-t${i}" class="${sid}-tile ${sid}-card"><span class="${sid}-tic">${iconSvg(it.icon, cols === 2 ? 120 : 96, { stroke: 1.75 })}</span><span class="${sid}-tl">${esc(it.label)}</span></div>`).join("\n        ")}
      </div>`;
  const css = `
    ${titleCss(ctx)}
    #${sid}-c { position: absolute; left: ${box.x}px; top: ${box.y + t.h}px; width: ${box.w}px; height: ${box.h - t.h}px; display: grid; grid-template-columns: repeat(${cols}, ${r1(tileW)}px); grid-auto-rows: ${r1(tileH)}px; gap: ${gap}px; align-content: center; }
    .${sid}-tile { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; padding: 20px; box-sizing: border-box; text-align: center; }
    .${sid}-tic { color: var(--accent); display: flex; }
    .${sid}-tl { font-family: var(--font-display); font-weight: 700; font-size: ${cols === 2 ? 46 : 36}px; line-height: 1.1; }
  `;
  if (t.html) anim.enter(`#${sid}-title`, ctx.isFirst ? 0 : 0.1, { from: "up", dist: 30 });
  const stagger = Math.min(0.22, (ctx.durationS * 0.5) / n);
  anim.enter(`.${sid}-tile`, 0.3, { from: "scale", ease: "back.out(1.8)", stagger });
  return { html, css, timeline: anim.out() };
};
