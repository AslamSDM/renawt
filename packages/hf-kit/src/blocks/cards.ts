import type { z } from "zod";
import type { BlockFn } from "./types";
import type { HeadlineCardData, NumberedCardData, SourceCardData, StrikeThroughData } from "./schema";
import { domainOf } from "./common";
import { iconSvg } from "./icons";
import { esc, fitFontSize, words } from "../util";
import { mixHex } from "../skin/index";

/** Tip N of a list: giant number, card with title + one-line action, progress dots. */
export const numberedCard: BlockFn<z.infer<typeof NumberedCardData>> = (ctx) => {
  const { sid, box, anim } = ctx;
  const d = ctx.data;
  const title = d.title ?? ctx.headline ?? "";
  const body = d.body ?? ctx.body;
  const num = String(d.n).padStart(2, "0");
  const tSize = fitFontSize(title, { maxWidth: box.w - 120, maxLines: 3, base: ctx.type.l, min: 56 });
  const dots = d.total ? Array.from({ length: d.total }, (_, i) => `<i class="${i + 1 === d.n ? `${sid}-on` : ""}"></i>`).join("") : "";
  const html = `
      <div id="${sid}-c" class="${sid}-nc">
        <div id="${sid}-num" class="${sid}-display ${sid}-nn">${num}</div>
        <div id="${sid}-card" class="${sid}-card ${sid}-ncard">
          ${d.icon ? `<span id="${sid}-ic" class="${sid}-nic">${iconSvg(d.icon, 96, { stroke: 1.75 })}</span>` : ""}
          <div id="${sid}-t" class="${sid}-display ${sid}-nt" style="font-size:${tSize}px">${esc(title)}</div>
          ${body ? `<div id="${sid}-b" class="${sid}-nb">${esc(body)}</div>` : ""}
        </div>
        ${dots ? `<div id="${sid}-dots" class="${sid}-dots">${dots}</div>` : ""}
      </div>`;
  const css = `
    #${sid}-c { position: absolute; left: ${box.x}px; top: ${box.y}px; width: ${box.w}px; height: ${box.h}px; display: flex; flex-direction: column; justify-content: center; gap: 28px; }
    .${sid}-nn { font-size: 300px; font-weight: 900; line-height: 0.9; color: var(--accent); letter-spacing: -0.05em; }
    .${sid}-ncard { padding: 56px 60px; display: flex; flex-direction: column; gap: 26px; }
    .${sid}-nic { color: var(--accent); display: flex; }
    .${sid}-nt { font-weight: 800; }
    .${sid}-nb { font-size: var(--fs-body); line-height: 1.3; color: var(--muted); }
    .${sid}-dots { display: flex; gap: 14px; }
    .${sid}-dots i { display: block; width: 44px; height: 10px; border-radius: 5px; background: var(--line); }
    .${sid}-dots i.${sid}-on { background: var(--accent); }
  `;
  const s0 = ctx.isFirst ? 0 : 0.1;
  anim.enter(`#${sid}-num`, s0, { from: "scale", ease: ctx.motion.ease });
  anim.enter(`#${sid}-card`, s0 + 0.2, { from: "up" });
  if (d.icon) anim.enter(`#${sid}-ic`, s0 + 0.45, { from: "scale" });
  if (body) anim.enter(`#${sid}-b`, s0 + 0.6, { from: "up", dist: 20 });
  if (dots) anim.fadeIn(`#${sid}-dots`, s0 + 0.5);
  return { html, css, timeline: anim.out() };
};

/** States the myth, strikes it word by word, then reveals the truth. */
export const strikeThrough: BlockFn<z.infer<typeof StrikeThroughData>> = (ctx) => {
  const { sid, box, anim } = ctx;
  const d = ctx.data;
  const myth = d.myth ?? ctx.headline ?? "";
  const ws = words(myth);
  const size = fitFontSize(myth, { maxWidth: box.w, maxLines: 4, base: ctx.type.xl, min: 60 });
  const truth = d.truth ?? ctx.body;
  const html = `
      <div id="${sid}-c" class="${sid}-st">
        <div id="${sid}-lbl" class="${sid}-stamp">${esc(d.label)}</div>
        <div id="${sid}-myth" class="${sid}-display ${sid}-myth" style="font-size:${size}px">${ws.map((w, i) => `<span class="${sid}-sw">${esc(w)}<span id="${sid}-x${i}" class="${sid}-x"></span></span>`).join(" ")}</div>
        ${truth ? `<div id="${sid}-truth" class="${sid}-truth"><span class="${sid}-kicker">${esc(d.truthLabel)}</span><span class="${sid}-tt">${esc(truth)}</span></div>` : ""}
      </div>`;
  const css = `
    #${sid}-c { position: absolute; left: ${box.x}px; top: ${box.y}px; width: ${box.w}px; height: ${box.h}px; display: flex; flex-direction: column; justify-content: center; gap: 44px; }
    .${sid}-stamp { align-self: flex-start; font-family: var(--font-mono); font-weight: 700; font-size: var(--fs-small); letter-spacing: 0.16em; padding: 10px 22px; border: 4px solid var(--accent2); color: var(--accent2); border-radius: var(--r-sm); }
    .${sid}-myth { font-weight: 800; color: var(--ink); }
    .${sid}-sw { position: relative; display: inline-block; }
    .${sid}-x { position: absolute; left: -6px; right: -6px; top: 52%; height: 0.11em; background: var(--accent2); border-radius: 0.05em; }
    .${sid}-truth { display: flex; flex-direction: column; gap: 14px; padding: 36px 40px; background: var(--surface); border-radius: var(--r-lg); border-left: 10px solid var(--accent); }
    .${sid}-tt { font-size: var(--fs-s); font-family: var(--font-display); font-weight: 700; line-height: 1.15; }
  `;
  const s0 = ctx.isFirst ? 0 : 0.1;
  anim.enter(`#${sid}-lbl`, s0, { from: "left", dist: 40 });
  anim.enter(`.${sid}-sw`, s0 + 0.1, { from: "up", stagger: ctx.motion.stagger });
  const strikeAt = Math.max(1.1, Math.min(ctx.durationS * 0.35, 2.4));
  anim.grow(`.${sid}-x`, "x", strikeAt, { dur: 0.22, ease: "power2.out", stagger: 0.07 });
  anim.to(`#${sid}-myth`, { color: mixHex(ctx.skin.palette.ink, ctx.skin.palette.bg, 0.45), duration: 0.4 }, strikeAt + 0.1);
  anim.to(`#${sid}-lbl`, { rotation: -6, duration: 0.2, ease: "back.out(3)" }, strikeAt);
  if (truth) anim.enter(`#${sid}-truth`, Math.min(strikeAt + 0.25 + ws.length * 0.07 + 0.3, ctx.durationS * 0.7), { from: "up" });
  return { html, css, timeline: anim.out() };
};

/** Evidence card: source + date header, the quote with an optional highlighted phrase, a stat. */
export const sourceCard: BlockFn<z.infer<typeof SourceCardData>> = (ctx) => {
  const { sid, box, anim } = ctx;
  const d = ctx.data;
  const q = d.quote;
  const hi = d.highlight && q.includes(d.highlight) ? d.highlight : "";
  const [pre, post] = hi ? [q.slice(0, q.indexOf(hi)), q.slice(q.indexOf(hi) + hi.length)] : [q, ""];
  const size = fitFontSize(q, { maxWidth: box.w - 120, maxLines: 6, base: ctx.type.m, min: 44 });
  const html = `
      ${ctx.headline ? `<div id="${sid}-title" class="${sid}-kicker ${sid}-sch">${esc(ctx.headline)}</div>` : ""}
      <div id="${sid}-c" class="${sid}-sc">
        <div id="${sid}-card" class="${sid}-card ${sid}-scard">
          <div id="${sid}-src" class="${sid}-srow"><span class="${sid}-sic">${iconSvg("file-text", 44)}</span><span class="${sid}-sname">${esc(d.source)}</span>${d.date ? `<span class="${sid}-sdate">${esc(d.date)}</span>` : ""}</div>
          <div id="${sid}-q" class="${sid}-display ${sid}-sq" style="font-size:${size}px">“${esc(pre)}${hi ? `<span class="${sid}-hw"><span id="${sid}-hl" class="${sid}-hl"></span><span class="${sid}-ht">${esc(hi)}</span></span>` : ""}${esc(post)}”</div>
          ${d.url ? `<div id="${sid}-url" class="${sid}-surl">${esc(domainOf(d.url))}</div>` : ""}
        </div>
        ${d.stat ? `<div id="${sid}-stat" class="${sid}-sstat"><span class="${sid}-display ${sid}-sv">${esc(d.stat.value)}</span><span class="${sid}-sl">${esc(d.stat.label)}</span></div>` : ""}
      </div>`;
  const css = `
    .${sid}-sch { position: absolute; left: ${box.x}px; top: ${box.y}px; width: ${box.w}px; text-align: center; font-size: var(--fs-small); }
    #${sid}-c { position: absolute; left: ${box.x}px; top: ${box.y + 60}px; width: ${box.w}px; height: ${box.h - 60}px; display: flex; flex-direction: column; justify-content: center; gap: 40px; }
    .${sid}-scard { padding: 52px 56px; display: flex; flex-direction: column; gap: 34px; }
    .${sid}-srow { display: flex; align-items: center; gap: 18px; font-family: var(--font-mono); font-size: var(--fs-label); text-transform: uppercase; letter-spacing: 0.08em; }
    .${sid}-sic { color: var(--accent); display: flex; }
    .${sid}-sname { font-weight: 700; }
    .${sid}-sdate { margin-left: auto; color: var(--muted); }
    .${sid}-sq { font-weight: 700; line-height: 1.16; }
    .${sid}-hw { position: relative; display: inline-block; }
    .${sid}-hl { position: absolute; left: -8px; right: -8px; top: 12%; bottom: 4%; background: color-mix(in srgb, var(--accent) 40%, transparent); border-radius: var(--r-sm); }
    .${sid}-ht { position: relative; }
    .${sid}-surl { font-family: var(--font-mono); font-size: var(--fs-label); color: var(--muted); }
    .${sid}-sstat { display: flex; align-items: baseline; gap: 26px; justify-content: center; }
    .${sid}-sv { font-size: 150px; font-weight: 900; color: var(--accent); line-height: 1; }
    .${sid}-sl { font-size: var(--fs-body); color: var(--muted); max-width: 420px; line-height: 1.2; }
  `;
  const s0 = ctx.isFirst ? 0 : 0.1;
  if (ctx.headline) anim.fadeIn(`#${sid}-title`, s0);
  anim.enter(`#${sid}-card`, s0 + 0.05, { from: "up" });
  anim.enter(`#${sid}-src`, s0 + 0.3, { from: "left", dist: 30 });
  if (hi) anim.grow(`#${sid}-hl`, "x", Math.min(1.3, ctx.durationS * 0.35), { dur: 0.5 });
  if (d.url) anim.fadeIn(`#${sid}-url`, s0 + 0.7);
  if (d.stat) anim.enter(`#${sid}-stat`, Math.min(1.6, ctx.durationS * 0.45), { from: "scale" });
  return { html, css, timeline: anim.out() };
};

/** News headline card (outlet as plain text, never a logo), headline words land in sequence. */
export const headlineCard: BlockFn<z.infer<typeof HeadlineCardData>> = (ctx) => {
  const { sid, box, anim } = ctx;
  const d = ctx.data;
  const headline = d.headline ?? ctx.headline ?? "";
  const ws = words(headline);
  const size = fitFontSize(headline, { maxWidth: box.w - 120, maxLines: 5, base: ctx.type.l, min: 52 });
  const html = `
      <div id="${sid}-c" class="${sid}-hc">
        <div id="${sid}-card" class="${sid}-card ${sid}-hcard">
          <div id="${sid}-top" class="${sid}-htop">${d.category ? `<span class="${sid}-cat">${esc(d.category)}</span>` : ""}<span class="${sid}-outlet">${esc(d.outlet)}</span></div>
          <div id="${sid}-hl" class="${sid}-display ${sid}-hh" style="font-size:${size}px">${ws.map((w) => `<span class="${sid}-hw">${esc(w)}</span>`).join(" ")}</div>
          <div id="${sid}-meta" class="${sid}-hmeta"><span>${esc(d.date)}</span>${d.url ? `<span>${esc(domainOf(d.url))}</span>` : ""}</div>
        </div>
      </div>`;
  const css = `
    #${sid}-c { position: absolute; left: ${box.x}px; top: ${box.y}px; width: ${box.w}px; height: ${box.h}px; display: flex; flex-direction: column; justify-content: center; }
    .${sid}-hcard { padding: 56px; display: flex; flex-direction: column; gap: 36px; border-top: 12px solid var(--accent); }
    .${sid}-htop { display: flex; align-items: center; gap: 20px; }
    .${sid}-cat { font-family: var(--font-mono); font-size: var(--fs-label); text-transform: uppercase; letter-spacing: 0.1em; background: var(--accent); color: var(--on-accent); padding: 8px 16px; border-radius: var(--r-sm); }
    .${sid}-outlet { font-family: var(--font-display); font-weight: 800; font-size: var(--fs-small); }
    .${sid}-hh { font-weight: 800; line-height: 1.08; }
    .${sid}-hw { display: inline-block; }
    .${sid}-hmeta { display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: var(--fs-label); color: var(--muted); border-top: 2px solid var(--line); padding-top: 24px; }
  `;
  const s0 = ctx.isFirst ? 0 : 0.1;
  anim.set(`#${sid}-card`, { opacity: ctx.isFirst ? 1 : 0 }, 0);
  if (!ctx.isFirst) anim.to(`#${sid}-card`, { opacity: 1, duration: 0.25 }, s0);
  anim.fromTo(`#${sid}-card`, { scale: 0.92, rotation: -2.5 }, { scale: 1, rotation: 0, duration: ctx.motion.dur * 1.2, ease: ctx.motion.ease }, s0);
  anim.fadeIn(`#${sid}-top`, s0 + 0.2);
  anim.enter(`.${sid}-hw`, s0 + 0.3, { from: "up", dist: 30, stagger: Math.min(0.08, 1.4 / Math.max(ws.length, 1)) });
  anim.fadeIn(`#${sid}-meta`, s0 + 0.6 + ws.length * 0.06);
  return { html, css, timeline: anim.out() };
};
