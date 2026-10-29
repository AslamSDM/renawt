import type { z } from "zod";
import type { BlockFn } from "./types";
import type { SplitStatData, SplitTitleData } from "./schema";
import { iconSvg } from "./icons";
import { fitCss, fitHtml, fitLines, withUnit } from "./common";

/** Text budgets (chars); lint + planner catalogue use the same numbers. */
export const SPLIT_TEXT = { label: 14, sub: 22, metric: 28 } as const;
import { esc, fitFontSize, formatNumber, r1 } from "../util";

type TD = z.infer<typeof SplitTitleData>;
type SD = z.infer<typeof SplitStatData>;

/** X vs Y matchup: left side on top, right side on the bottom, VS badge between. */
export const splitTitle: BlockFn<TD> = (ctx) => {
  const { sid, box, anim, skin } = ctx;
  const d = ctx.data;
  const kickerH = ctx.headline ? 80 : 0;
  const qH = d.question ? 110 : 0;
  const panelH = Math.round((box.h - kickerH - qH - 40) / 2);
  const colors = [d.left.color ?? skin.palette.accent, d.right.color ?? skin.palette.accent2 ?? skin.palette.ink];
  const panel = (side: TD["left"], key: "l" | "r", top: number, col: string) => {
    const tw = box.w - 112 - (side.icon ? 184 : 0);
    const lab = fitLines(side.label, { maxWidth: tw, maxLines: 2, base: ctx.type.xl, min: 48, weight: 900 });
    // sub is uppercase mono with 0.1em tracking: budget the width accordingly.
    const sub = side.sub ? fitLines(side.sub.toUpperCase(), { maxWidth: tw / 1.12, maxLines: 1, base: ctx.type.label, min: 22, mono: true }) : null;
    return `<div id="${sid}-${key}" class="${sid}-panel ${sid}-card" style="top:${top}px;height:${panelH}px;border-color:${col}">
          ${side.icon ? `<span class="${sid}-pic" style="color:${col}">${iconSvg(side.icon, 140, { stroke: 1.75 })}</span>` : ""}
          <span class="${sid}-ptx">${fitHtml(sid, side.label, lab, { cls: `${sid}-display ${sid}-pl`, role: "split-title label", max: SPLIT_TEXT.label })}${sub ? fitHtml(sid, side.sub!, sub, { cls: `${sid}-ps`, role: "split-title sub", max: SPLIT_TEXT.sub }) : ""}</span>
        </div>`;
  };
  const topY = box.y + kickerH;
  const botY = topY + panelH + 40;
  const html = `
      ${ctx.headline ? `<div id="${sid}-kicker" class="${sid}-kicker ${sid}-sk">${esc(ctx.headline)}</div>` : ""}
      ${panel(d.left, "l", topY, colors[0])}
      ${panel(d.right, "r", botY, colors[1])}
      <div id="${sid}-vs" class="${sid}-vs" style="top:${r1(topY + panelH + 20 - 90)}px">VS</div>
      ${d.question ? `<div id="${sid}-q" class="${sid}-display ${sid}-q">${esc(d.question)}</div>` : ""}`;
  const css = `
    ${fitCss(sid)}
    .${sid}-sk { position: absolute; left: ${box.x}px; top: ${box.y}px; width: ${box.w}px; text-align: center; font-size: var(--fs-small); }
    .${sid}-panel { position: absolute; left: ${box.x}px; width: ${box.w}px; box-sizing: border-box; display: flex; align-items: center; gap: 44px; padding: 0 56px; border-width: 4px; }
    .${sid}-pic { display: flex; flex: none; }
    .${sid}-ptx { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
    .${sid}-pl { font-weight: 900; }
    .${sid}-ps { font-family: var(--font-mono); color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; }
    .${sid}-vs { position: absolute; left: ${ctx.width / 2 - 90}px; width: 180px; height: 180px; border-radius: 50%; background: var(--accent); color: var(--on-accent); font-family: var(--font-display); font-weight: 900; font-size: 76px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 14px var(--bg); }
    .${sid}-q { position: absolute; left: ${box.x}px; top: ${box.y + box.h - qH + 20}px; width: ${box.w}px; text-align: center; font-size: var(--fs-m); }
  `;
  const s0 = ctx.isFirst ? 0 : 0.1;
  if (ctx.headline) anim.enter(`#${sid}-kicker`, s0, { from: "up", dist: 24 });
  anim.enter(`#${sid}-l`, s0 + 0.1, { from: "left", dist: 260 });
  anim.enter(`#${sid}-r`, s0 + 0.3, { from: "right", dist: 260 });
  anim.enter(`#${sid}-vs`, s0 + 0.6, { from: "scale", ease: "back.out(2)" });
  anim.pulse(`#${sid}-vs`, s0 + 1.2, 1.12, 0.16);
  if (d.question) anim.enter(`#${sid}-q`, Math.min(s0 + 1.1, ctx.durationS * 0.6), { from: "up", dist: 30 });
  return { html, css, timeline: anim.out() };
};

function fmt(v: number, unit: string, decimals: number): string {
  return withUnit(formatNumber(v, decimals), unit);
}

/** Comparison rounds: two columns, vertical bars sized to the values, winner highlighted. */
export const splitStat: BlockFn<SD> = (ctx) => {
  const { sid, box, anim, skin } = ctx;
  const d = ctx.data;
  const k = d.rounds.length;
  const slot = ctx.durationS / k;
  const colW = Math.round((box.w - 60) / 2);
  const headH = 210, labelH = 110, valH = 90;
  const maxBar = box.h - headH - labelH - valH - 30;

  const groups = d.rounds.map((r, j) => {
    const max = Math.max(Math.abs(r.left), Math.abs(r.right)) || 1;
    const hl = Math.max(14, (Math.abs(r.left) / max) * maxBar);
    const hr = Math.max(14, (Math.abs(r.right) / max) * maxBar);
    const leftWins = r.left === r.right ? null : r.higherIsBetter ? r.left > r.right : r.left < r.right;
    const col = (win: boolean | null) => (win === null ? skin.palette.accent : win ? skin.palette.accent : "var(--surface)");
    const baseY = box.y + headH + valH + maxBar;
    const column = (side: "l" | "r", label: string, v: number, h: number, win: boolean | null, x: number) => `
          <div id="${sid}-r${j}${side}v" class="${sid}-sv${win ? ` ${sid}-win` : ""}" style="left:${x}px;top:${r1(baseY - h - valH)}px;width:${colW}px">${esc(fmt(v, r.unit, r.decimals))}</div>
          <div id="${sid}-r${j}${side}b" class="${sid}-sb${win === false ? ` ${sid}-lose` : ""}" style="left:${r1(x + colW * 0.18)}px;top:${r1(baseY - h)}px;width:${r1(colW * 0.64)}px;height:${r1(h)}px;background:${col(win)}"></div>
          <div id="${sid}-r${j}${side}n" class="${sid}-sn" style="left:${x}px;top:${baseY + 22}px;width:${colW}px">${win ? `<span class="${sid}-crown">${iconSvg("crown", 40)}</span>` : ""}${fitHtml(sid, label, fitLines(label, { maxWidth: colW - (win ? 56 : 0), maxLines: 1, base: ctx.type.small, min: 24, weight: 700 }), { cls: `${sid}-snt`, role: "split-stat side label", max: SPLIT_TEXT.label })}</div>`;
    return `<div id="${sid}-g${j}" class="${sid}-grp">
          <div id="${sid}-r${j}k" class="${sid}-kicker ${sid}-rk">Round ${(d.roundNumber ?? 1) + j}</div>
          <div id="${sid}-r${j}m" class="${sid}-display ${sid}-rm">${fitHtml(sid, r.metric, fitLines(r.metric, { maxWidth: box.w, maxLines: 2, base: ctx.type.m, min: 40, weight: 800 }), { cls: `${sid}-rmt`, role: "split-stat metric", max: SPLIT_TEXT.metric, style: "align-items:center" })}</div>
          ${column("l", d.left.label, r.left, hl, leftWins, box.x)}
          ${column("r", d.right.label, r.right, hr, leftWins === null ? null : !leftWins, box.x + colW + 60)}
          <div class="${sid}-base" style="top:${baseY}px"></div>
        </div>`;
  }).join("\n      ");

  const css = `
    ${fitCss(sid)}
    .${sid}-grp { position: absolute; inset: 0; }
    .${sid}-rk { position: absolute; left: ${box.x}px; top: ${box.y}px; width: ${box.w}px; text-align: center; }
    .${sid}-rm { position: absolute; left: ${box.x}px; top: ${box.y + 56}px; width: ${box.w}px; text-align: center; display: flex; justify-content: center; }
    .${sid}-sv { position: absolute; text-align: center; font-family: var(--font-display); font-weight: 900; font-size: 64px; line-height: ${90}px; }
    .${sid}-win { color: var(--accent); }
    .${sid}-sb { position: absolute; border-radius: var(--r-md) var(--r-md) 0 0; }
    .${sid}-lose { border: 3px solid var(--line); border-bottom: 0; box-sizing: border-box; }
    .${sid}-sn { position: absolute; text-align: center; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 12px; }
    .${sid}-crown { color: var(--accent); display: inline-flex; }
    .${sid}-base { position: absolute; left: ${box.x}px; width: ${box.w}px; height: 4px; background: var(--line); }
  `;

  d.rounds.forEach((r, j) => {
    const t0 = j * slot + (j === 0 && !ctx.isFirst ? 0.1 : j === 0 ? 0 : 0.05);
    if (j > 0) {
      anim.set(`#${sid}-g${j}`, { opacity: 0 }, 0);
      anim.fadeTo(`#${sid}-g${j - 1}`, 0, j * slot - 0.18, 0.16);
      anim.fadeTo(`#${sid}-g${j}`, 1, j * slot, 0.01);
    }
    anim.enter(`#${sid}-r${j}k`, t0, { from: "up", dist: 20 });
    anim.enter(`#${sid}-r${j}m`, t0 + 0.08, { from: "up", dist: 30 });
    const tb = t0 + Math.min(0.5, slot * 0.2);
    for (const side of ["l", "r"] as const) {
      const ts = tb + (side === "r" ? 0.15 : 0);
      anim.grow(`#${sid}-r${j}${side}b`, "y", ts, { dur: Math.min(0.9, slot * 0.35) });
      anim.fadeIn(`#${sid}-r${j}${side}n`, t0 + 0.2, 0.3);
      anim.enter(`#${sid}-r${j}${side}v`, ts + Math.min(0.6, slot * 0.25), { from: "up", dist: 24 });
    }
    if (r.left !== r.right) anim.pulse(`#${sid}-g${j} .${sid}-win`, tb + Math.min(1.1, slot * 0.45), 1.1, 0.16);
  });

  return { html: groups, css, timeline: anim.out() };
};
