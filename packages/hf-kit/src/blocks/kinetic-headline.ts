import type { z } from "zod";
import type { BlockFn } from "./types";
import type { KineticHeadlineData } from "./schema";
import { esc, fitFontSize, words } from "../util";

type D = z.infer<typeof KineticHeadlineData>;

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}%$]+/gu, "");

/** Big kinetic type: masked word-by-word rise, accent emphasis words, optional kicker + sub. */
export const kineticHeadline: BlockFn<D> = (ctx) => {
  const { sid, box, type, motion, anim } = ctx;
  const headline = ctx.headline ?? "";
  const ws = words(headline);
  const emph = new Set((ctx.data.emphasis ?? []).flatMap((e) => words(e)).map(norm));
  const size = fitFontSize(headline, { maxWidth: box.w, maxLines: 5, base: type.hero, min: 64, factor: 0.55 });
  const align = ctx.data.align ?? "center";

  const wordHtml = ws
    .map((w, i) => `<span class="${sid}-mask"><span id="${sid}-w${i}" class="${sid}-w${emph.has(norm(w)) ? ` ${sid}-em` : ""}">${esc(w)}</span></span>`)
    .join(" ");

  const html = `
      <div id="${sid}-c" class="${sid}-kh">
        ${ctx.data.kicker ? `<div id="${sid}-kicker" class="${sid}-kicker">${esc(ctx.data.kicker)}</div>` : ""}
        <div id="${sid}-h" class="${sid}-display ${sid}-kh-h" style="font-size:${size}px">${wordHtml}</div>
        <div id="${sid}-rule" class="${sid}-rule"></div>
        ${ctx.body ? `<div id="${sid}-sub" class="${sid}-kh-sub">${esc(ctx.body)}</div>` : ""}
      </div>`;

  const css = `
    #${sid}-c { position: absolute; left: ${box.x}px; top: ${box.y}px; width: ${box.w}px; height: ${box.h}px; display: flex; flex-direction: column; justify-content: center; align-items: ${align === "center" ? "center" : "flex-start"}; text-align: ${align}; gap: 36px; }
    .${sid}-kh-h { font-weight: 900; line-height: 1.04; }
    .${sid}-mask { display: inline-block; overflow: hidden; vertical-align: top; padding: 0.04em 0.02em 0.1em; margin: -0.04em -0.02em -0.1em; }
    .${sid}-w { display: inline-block; }
    .${sid}-em { color: var(--accent); }
    .${sid}-rule { width: 160px; height: 10px; background: var(--accent); border-radius: var(--r-pill); }
    .${sid}-kh-sub { font-size: var(--fs-body); line-height: 1.3; color: var(--muted); max-width: ${box.w}px; }
  `;

  const start = ctx.isFirst ? 0 : 0.12;
  if (ctx.data.kicker) anim.enter(`#${sid}-kicker`, start, { from: "up", dist: 30 });
  const stagger = Math.min(motion.stagger * 1.4, 1.2 / Math.max(ws.length, 1));
  if (ctx.isFirst) anim.enter(`.${sid}-w`, 0, { from: "scale", stagger: stagger * 0.5 });
  else anim.enter(`.${sid}-w`, start + 0.08, { from: "up", dist: size * 1.1, stagger });
  const wordsEnd = start + 0.08 + stagger * ws.length + motion.dur;
  anim.grow(`#${sid}-rule`, "x", Math.min(wordsEnd - 0.2, ctx.durationS * 0.5), { origin: align === "center" ? "50% 50%" : "0% 50%" });
  if (ctx.body) anim.enter(`#${sid}-sub`, Math.min(wordsEnd, ctx.durationS * 0.55), { from: "up", dist: 24 });
  ws.forEach((w, i) => {
    if (emph.has(norm(w))) anim.pulse(`#${sid}-w${i}`, Math.min(wordsEnd + 0.1, ctx.durationS * 0.6), 1.08);
  });

  return { html, css, timeline: anim.out() };
};
