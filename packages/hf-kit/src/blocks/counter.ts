import type { z } from "zod";
import type { BlockFn } from "./types";
import type { CounterData } from "./schema";
import { titleCss, titleHtml } from "./common";
import { esc, formatNumber } from "../util";

type D = z.infer<typeof CounterData>;

/**
 * Count-up as an odometer: each digit is a column whose strip (0–9 twice) slides with `y`.
 * Pure transform tweens, so every frame is a function of timeline time and the final
 * value is exactly `formatNumber(value, decimals)`.
 */
export const counter: BlockFn<D> = (ctx) => {
  const { sid, box, anim } = ctx;
  const d = ctx.data;
  const formatted = `${d.prefix}${formatNumber(d.value, d.decimals)}${d.suffix}`;
  const fromStr = d.from !== undefined ? `${d.prefix}${formatNumber(d.from, d.decimals)}${d.suffix}` : "";
  const chars = [...formatted];
  const L = chars.length;
  const size = Math.round(Math.min(L <= 4 ? 280 : L <= 6 ? 230 : L <= 8 ? 190 : L <= 10 ? 156 : 124, box.w / (0.64 * L)));
  const t = titleHtml(ctx, ctx.headline);

  let digitIdx = 0;
  const cols = chars.map((ch, i) => {
    if (/\d/.test(ch)) {
      const k = digitIdx++;
      const cells = Array.from({ length: 20 }, (_, j) => `<span class="${sid}-cell">${j % 10}</span>`).join("");
      return `<span class="${sid}-col"><span id="${sid}-d${k}" class="${sid}-strip" data-layout-ignore>${cells}</span></span>`;
    }
    return `<span id="${sid}-ch${i}" class="${sid}-ch">${esc(ch)}</span>`;
  }).join("");

  const html = `
      ${t.html}
      <div id="${sid}-c" class="${sid}-ct">
        <div id="${sid}-num" class="${sid}-display ${sid}-num" style="font-size:${size}px" aria-label="${esc(formatted)}">${cols}</div>
        ${d.label ? `<div id="${sid}-lbl" class="${sid}-ct-lbl">${esc(d.label)}</div>` : ""}
      </div>`;

  const css = `
    ${titleCss(ctx)}
    #${sid}-c { position: absolute; left: ${box.x}px; top: ${box.y + t.h}px; width: ${box.w}px; height: ${box.h - t.h}px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 40px; }
    .${sid}-num { display: flex; align-items: flex-start; line-height: 1; font-weight: 900; font-variant-numeric: tabular-nums; color: var(--accent); letter-spacing: -0.03em; }
    .${sid}-col { display: inline-block; height: 1em; overflow: hidden; }
    .${sid}-strip { display: flex; flex-direction: column; }
    .${sid}-cell { display: block; height: 1em; line-height: 1; text-align: center; }
    .${sid}-ch { display: inline-block; line-height: 1; }
    .${sid}-ct-lbl { font-size: var(--fs-body); color: var(--muted); text-align: center; max-width: ${box.w}px; line-height: 1.3; }
  `;

  if (t.html) anim.enter(`#${sid}-title`, ctx.isFirst ? 0 : 0.1, { from: "up", dist: 30 });
  const start = 0.35;
  const digits = chars.filter((c) => /\d/.test(c));
  const fromDigits = [...fromStr].filter((c) => /\d/.test(c));
  const sameLen = fromDigits.length === digits.length;
  const rollDur = Math.min(2.2, Math.max(1.1, ctx.durationS * 0.45));
  digits.forEach((ch, k) => {
    const target = 10 + Number(ch);
    const startCell = sameLen ? Number(fromDigits[k]) : 0;
    const fromY = -startCell * size;
    const toY = -target * size;
    const dur = rollDur * (0.75 + 0.25 * ((k + 1) / digits.length));
    anim.fromTo(`#${sid}-d${k}`, { y: fromY }, { y: toY, duration: dur, ease: "power3.out" }, start);
  });
  chars.forEach((ch, i) => { if (!/\d/.test(ch)) anim.fadeIn(`#${sid}-ch${i}`, start + 0.1, 0.3); });
  anim.pulse(`#${sid}-num`, start + rollDur + 0.05, 1.05, 0.16);
  if (d.label) anim.enter(`#${sid}-lbl`, start + rollDur * 0.6, { from: "up", dist: 24 });

  return { html, css, timeline: anim.out() };
};
