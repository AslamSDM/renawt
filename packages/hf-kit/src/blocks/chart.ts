import type { z } from "zod";
import type { BlockFn } from "./types";
import type { ChartData } from "./schema";
import { seriesColor, titleCss, titleHtml, withUnit } from "./common";
import { compactNumber, esc, formatNumber, niceTicks, r1 } from "../util";

type D = z.infer<typeof ChartData>;

/**
 * Line / area / bar chart in pure SVG + HTML. Line & area draw on with a left→right
 * clip-path wipe (ease "none" so annotations land when the line reaches them); bars grow
 * with scaleY from the baseline.
 */
export const chart: BlockFn<D> = (ctx) => {
  const { sid, box, anim } = ctx;
  const d = ctx.data;
  const t = titleHtml(ctx, ctx.headline);
  const n = Math.max(...d.series.map((s) => s.values.length));
  const all = d.series.flatMap((s) => s.values);
  const dataMin = Math.min(...all), dataMax = Math.max(...all);
  const zeroBase = d.type !== "line" && dataMin >= 0;
  const ticks = niceTicks(d.yMin ?? (zeroBase ? 0 : dataMin), d.yMax ?? dataMax, 4);
  const yLo = d.yMin ?? ticks[0], yHi = d.yMax ?? ticks[ticks.length - 1];

  const legendH = d.series.length > 1 ? 70 : 0;
  const sourceH = d.source ? 60 : 0;
  const top = box.y + t.h + legendH;
  const W = box.w, padL = 120, padR = 40, padT = 30, padB = 70;
  const H = Math.min(760, box.y + box.h - top - sourceH);
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const yOf = (v: number) => padT + plotH - ((v - yLo) / (yHi - yLo || 1)) * plotH;
  const bandW = plotW / n;
  const xOf = (i: number) => (d.type === "bar" ? padL + bandW * (i + 0.5) : padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW));

  const grid = ticks.filter((v) => v >= yLo && v <= yHi).map((v) => `<line x1="${padL}" x2="${W - padR}" y1="${r1(yOf(v))}" y2="${r1(yOf(v))}" class="${sid}-grid"/><text x="${padL - 18}" y="${r1(yOf(v) + 10)}" text-anchor="end" class="${sid}-tick">${esc(withUnit(compactNumber(v), d.unit))}</text>`).join("");
  const every = Math.max(1, Math.ceil(n / 6));
  const xl = (d.labels ?? []).slice(0, n).map((lb, i) => ((i % every === 0 && n - 1 - i >= every) || i === n - 1 ? `<text x="${r1(xOf(i))}" y="${H - 22}" text-anchor="middle" class="${sid}-tick">${esc(lb)}</text>` : "")).join("");
  const base = `<svg class="${sid}-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${grid}<line x1="${padL}" x2="${W - padR}" y1="${r1(yOf(zeroBase ? 0 : yLo))}" y2="${r1(yOf(zeroBase ? 0 : yLo))}" class="${sid}-axis"/>${xl}</svg>`;

  let plot = "";
  const drawStart = 0.5;
  const drawDur = Math.max(1.2, Math.min(ctx.durationS * 0.55, 4));
  const marks: string[] = [];

  if (d.type === "bar") {
    const k = d.series.length;
    const bw = Math.min(90, (bandW * 0.72) / k);
    const y0 = yOf(Math.max(yLo, 0));
    d.series.forEach((s, si) => {
      s.values.forEach((v, i) => {
        const x = xOf(i) - (bw * k) / 2 + si * bw;
        const yv = yOf(v);
        const h = Math.max(4, y0 - yv);
        plot += `<div id="${sid}-b${si}-${i}" class="${sid}-bar" style="left:${r1(x + 3)}px;top:${r1(y0 - h)}px;width:${r1(bw - 6)}px;height:${r1(h)}px;background:${seriesColor(ctx, si, s.color)}"></div>`;
        if (k === 1 && n <= 8) marks.push(`<div id="${sid}-bv${i}" class="${sid}-val" style="left:${r1(x + bw / 2)}px;top:${r1(y0 - h - 54)}px">${esc(withUnit(Math.abs(v) < 1e5 ? formatNumber(v, Number.isInteger(v) ? 0 : 1) : compactNumber(v), d.unit))}</div>`);
      });
    });
    const stagger = drawDur / (n * d.series.length);
    d.series.forEach((s, si) => s.values.forEach((_, i) => {
      const at = drawStart + (i * d.series.length + si) * stagger;
      anim.grow(`#${sid}-b${si}-${i}`, "y", at, { dur: 0.6 });
      if (d.series.length === 1 && n <= 8) anim.fadeIn(`#${sid}-bv${i}`, at + 0.4, 0.25);
    }));
  } else {
    d.series.forEach((s, si) => {
      const col = seriesColor(ctx, si, s.color);
      const pts = s.values.map((v, i) => [xOf(i), yOf(v)] as const);
      const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${r1(x)} ${r1(y)}`).join(" ");
      const area = d.type === "area" ? `<path d="${line} L${r1(pts[pts.length - 1][0])} ${r1(yOf(Math.max(yLo, 0)))} L${r1(pts[0][0])} ${r1(yOf(Math.max(yLo, 0)))} Z" fill="${col}" fill-opacity="0.22"/>` : "";
      plot += `<div id="${sid}-s${si}" class="${sid}-series"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${area}<path d="${line}" fill="none" stroke="${col}" stroke-width="${si === 0 ? 9 : 6}" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
      const [lx, ly] = pts[pts.length - 1];
      marks.push(`<div id="${sid}-end${si}" class="${sid}-dot" style="left:${r1(lx)}px;top:${r1(ly)}px;background:${col}"></div>`);
      if (si === 0) marks.push(`<div id="${sid}-endv" class="${sid}-val ${sid}-val-end" style="left:${r1(Math.min(lx, W - 120))}px;top:${r1(ly - 76)}px">${esc(withUnit(formatNumber(s.values[s.values.length - 1], Number.isInteger(s.values[s.values.length - 1]) ? 0 : 1), d.unit))}</div>`);
      anim.wipe(`#${sid}-s${si}`, drawStart + si * 0.25, drawDur, "none");
      anim.enter(`#${sid}-end${si}`, drawStart + si * 0.25 + drawDur - 0.05, { from: "scale", dur: 0.3 });
      if (si === 0) anim.enter(`#${sid}-endv`, drawStart + drawDur, { from: "up", dist: 20 });
    });
  }

  const placed: Array<{ x: number; y: number }> = [];
  const LW = 300, LH = 96;
  d.annotations.forEach((a, k) => {
    const s = d.series[a.series] ?? d.series[0];
    const i = Math.min(a.index, s.values.length - 1);
    const x = xOf(i), y = yOf(s.values[i]);
    const lx = Math.max(LW / 2, Math.min(W - LW / 2, x));
    const hits = (ly: number) => placed.some((p) => Math.abs(p.x - lx) < LW + 12 && Math.abs(p.y - ly) < LH + 12);
    let above = y > padT + 140;
    let ly = above ? y - 120 : y + 40;
    if (hits(ly)) { above = !above; ly = above ? y - 120 : y + 40; }
    for (let tries = 0; hits(ly) && tries < 4; tries++) ly += above ? -(LH + 16) : LH + 16;
    ly = Math.max(-40, Math.min(H - LH, ly));
    placed.push({ x: lx, y: ly });
    marks.push(`<div id="${sid}-a${k}" class="${sid}-dot ${sid}-adot" style="left:${r1(x)}px;top:${r1(y)}px"></div>`);
    marks.push(`<div id="${sid}-al${k}" class="${sid}-ann" style="left:${r1(lx)}px;top:${r1(ly)}px">${esc(a.label)}</div>`);
    const frac = d.type === "bar" ? (i + 0.5) / n : n === 1 ? 0 : i / (n - 1);
    const at = drawStart + drawDur * frac;
    anim.enter(`#${sid}-a${k}`, at, { from: "scale", dur: 0.3 });
    anim.enter(`#${sid}-al${k}`, at + 0.1, { from: above ? "up" : "down", dist: 24 });
  });

  const legend = d.series.length > 1
    ? `<div id="${sid}-legend" class="${sid}-legend">${d.series.map((s, si) => `<span class="${sid}-lg"><i style="background:${seriesColor(ctx, si, s.color)}"></i>${esc(s.name)}</span>`).join("")}</div>`
    : "";

  const html = `
      ${t.html}
      ${legend}
      <div id="${sid}-plot" class="${sid}-plot">
        ${base}
        ${plot}
        ${marks.join("\n        ")}
      </div>
      ${d.source ? `<div id="${sid}-src" class="${sid}-src">Source · ${esc(d.source)}</div>` : ""}`;

  const css = `
    ${titleCss(ctx)}
    #${sid}-legend { position: absolute; left: ${box.x}px; top: ${box.y + t.h}px; width: ${box.w}px; display: flex; justify-content: center; gap: 40px; font-size: var(--fs-small); }
    .${sid}-lg { display: inline-flex; align-items: center; gap: 14px; }
    .${sid}-lg i { display: inline-block; width: 34px; height: 10px; border-radius: 5px; }
    #${sid}-plot { position: absolute; left: ${box.x}px; top: ${top}px; width: ${W}px; height: ${H}px; }
    .${sid}-svg, .${sid}-series { position: absolute; left: 0; top: 0; }
    .${sid}-series svg { display: block; }
    .${sid}-grid { stroke: var(--line); stroke-width: 2; }
    .${sid}-axis { stroke: var(--muted); stroke-width: 3; }
    .${sid}-tick { fill: var(--muted); font-family: var(--font-mono); font-size: 30px; }
    .${sid}-bar { position: absolute; border-radius: var(--r-sm) var(--r-sm) 0 0; }
    .${sid}-dot { position: absolute; width: 30px; height: 30px; margin: -15px 0 0 -15px; border-radius: 50%; box-shadow: 0 0 0 8px color-mix(in srgb, var(--bg) 70%, transparent); }
    .${sid}-adot { background: var(--ink); width: 24px; height: 24px; margin: -12px 0 0 -12px; }
    .${sid}-val { position: absolute; width: 240px; margin-left: -120px; text-align: center; font-family: var(--font-display); font-weight: 800; font-size: 44px; }
    .${sid}-val-end { font-size: 54px; color: var(--accent); }
    .${sid}-ann { position: absolute; width: 300px; margin-left: -150px; text-align: center; font-family: var(--font-mono); font-size: var(--fs-label); background: var(--surface); border: 2px solid var(--line); border-radius: var(--r-md); padding: 10px 14px; box-sizing: border-box; line-height: 1.25; }
    #${sid}-src { position: absolute; left: ${box.x}px; top: ${top + H + 16}px; width: ${box.w}px; text-align: center; font-family: var(--font-mono); font-size: var(--fs-label); color: var(--muted); letter-spacing: 0.06em; }
  `;

  if (t.html) anim.enter(`#${sid}-title`, ctx.isFirst ? 0 : 0.1, { from: "up", dist: 30 });
  if (legend) anim.fadeIn(`#${sid}-legend`, 0.3);
  anim.fadeIn(`.${sid}-svg`, 0.2, 0.4);
  if (d.source) anim.fadeIn(`#${sid}-src`, 0.6, 0.4);
  return { html, css, timeline: anim.out() };
};
