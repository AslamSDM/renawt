import type { z } from "zod";
import type { BlockFn } from "./types";
import type { BulletStackData, IconGridData } from "./schema";
import { fitCss, fitHtml, fitLines, titleCss, titleHtml } from "./common";
import { iconSvg } from "./icons";
import { r1 } from "../util";

/** Text budgets (chars) per item; lint + planner catalogue use the same numbers. */
export const LIST_TEXT = { bullet: 40, bulletSub: 60, tile: 18 } as const;

/** 2–5 bullets revealed one at a time across the scene; earlier bullets dim. */
export const bulletStack: BlockFn<z.infer<typeof BulletStackData>> = (ctx) => {
  const { sid, box, anim } = ctx;
  const d = ctx.data;
  const items = d.items.map((it) => (typeof it === "string" ? { text: it, sub: undefined, icon: undefined } : it));
  const t = titleHtml(ctx, ctx.headline);
  const areaH = box.h - t.h;
  const rowH = Math.min(230, (areaH - (items.length - 1) * 28) / items.length);
  // One size for every item (the smallest any item needs, but one very long item does not shrink
  // the rest below 80% of the base), then each item wraps / shrinks further / truncates on its own.
  const tw = box.w - 72 - 100 - 34;
  const size = Math.max(Math.round(ctx.type.s * 0.8), Math.min(...items.map((it) => fitLines(it.text, { maxWidth: tw, maxLines: 2, base: ctx.type.s, min: 34, weight: 800 }).size)));
  const fits = items.map((it) => ({
    main: fitLines(it.text, { maxWidth: tw, maxLines: 2, base: size, min: 34, weight: 800 }),
    sub: it.sub ? fitLines(it.sub, { maxWidth: tw, maxLines: 2, base: ctx.type.small, min: 26 }) : null,
  }));
  const html = `
      ${t.html}
      <div id="${sid}-c" class="${sid}-bs">
        ${items.map((it, i) => `<div id="${sid}-i${i}" class="${sid}-row ${sid}-card" style="min-height:${r1(rowH)}px">
          <span class="${sid}-bic">${it.icon ? iconSvg(it.icon, 60) : d.numbered ? `<b>${i + 1}</b>` : `<i></i>`}</span>
          <span class="${sid}-btx">${fitHtml(sid, it.text, fits[i].main, { cls: `${sid}-bt`, role: "bullet-stack item", max: LIST_TEXT.bullet })}${fits[i].sub ? fitHtml(sid, it.sub!, fits[i].sub!, { cls: `${sid}-bsub`, role: "bullet-stack item sub", max: LIST_TEXT.bulletSub }) : ""}</span>
        </div>`).join("\n        ")}
      </div>`;
  const css = `
    ${titleCss(ctx)}
    ${fitCss(sid)}
    #${sid}-c { position: absolute; left: ${box.x}px; top: ${box.y + t.h}px; width: ${box.w}px; height: ${areaH}px; display: flex; flex-direction: column; justify-content: center; gap: 28px; }
    .${sid}-row { display: flex; align-items: center; gap: 34px; padding: 26px 36px; box-sizing: border-box; }
    .${sid}-bic { flex: none; width: 100px; height: 100px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent); display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-size: 52px; }
    .${sid}-bic i { display: block; width: 28px; height: 28px; border-radius: 50%; background: var(--accent); }
    .${sid}-btx { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    .${sid}-bt { font-family: var(--font-display); font-weight: 800; line-height: 1.1; }
    .${sid}-bsub { color: var(--muted); line-height: 1.25; }
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
        ${d.items.map((it, i) => `<div id="${sid}-t${i}" class="${sid}-tile ${sid}-card"><span class="${sid}-tic">${iconSvg(it.icon, cols === 2 ? 120 : 96, { stroke: 1.75 })}</span>${fitHtml(sid, it.label, fitLines(it.label, { maxWidth: tileW - 48, maxLines: 2, base: cols === 2 ? 46 : 36, min: 24, weight: 700 }), { cls: `${sid}-tl`, role: "icon-grid label", max: LIST_TEXT.tile })}</div>`).join("\n        ")}
      </div>`;
  const css = `
    ${titleCss(ctx)}
    ${fitCss(sid)}
    #${sid}-c { position: absolute; left: ${box.x}px; top: ${box.y + t.h}px; width: ${box.w}px; height: ${box.h - t.h}px; display: grid; grid-template-columns: repeat(${cols}, ${r1(tileW)}px); grid-auto-rows: ${r1(tileH)}px; gap: ${gap}px; align-content: center; }
    .${sid}-tile { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; padding: 20px; box-sizing: border-box; text-align: center; overflow: hidden; }
    .${sid}-tic { color: var(--accent); display: flex; }
    .${sid}-tl { font-family: var(--font-display); font-weight: 700; line-height: 1.1; align-items: center; }
  `;
  if (t.html) anim.enter(`#${sid}-title`, ctx.isFirst ? 0 : 0.1, { from: "up", dist: 30 });
  const stagger = Math.min(0.22, (ctx.durationS * 0.5) / n);
  anim.enter(`.${sid}-tile`, 0.3, { from: "scale", ease: "back.out(1.8)", stagger });
  return { html, css, timeline: anim.out() };
};
