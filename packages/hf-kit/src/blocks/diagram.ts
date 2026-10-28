import type { z } from "zod";
import type { BlockFn } from "./types";
import type { DiagramData } from "./schema";
import { titleCss, titleHtml } from "./common";
import { iconSvg } from "./icons";
import { esc, r1 } from "../util";

type D = z.infer<typeof DiagramData>;
type Layout = Exclude<D["layout"], "auto"> | "custom";

interface P { x: number; y: number; w: number; h: number }

function pickLayout(d: D): Layout {
  if (d.layout !== "auto") return d.layout;
  if (d.nodes.every((n) => n.x !== undefined && n.y !== undefined)) return "custom";
  const n = d.nodes.length;
  const froms = new Set(d.edges.map((e) => e.from));
  if (n >= 4 && froms.size === 1 && d.edges.length >= n - 1) return "hub";
  const last = d.nodes[n - 1]?.id;
  if (n >= 3 && d.edges.some((e) => e.from === last && e.to === d.nodes[0].id)) return "cycle";
  if (n <= 5) return "vertical";
  return "grid";
}

/** Nodes + arrows. Arrows are rotated wrappers (static CSS) whose inner line grows with scaleX. */
export const diagram: BlockFn<D> = (ctx) => {
  const { sid, box, anim, motion } = ctx;
  const d = ctx.data;
  const t = titleHtml(ctx, ctx.headline);
  const area = { x: box.x, y: box.y + t.h, w: box.w, h: box.h - t.h };
  const layout = pickLayout(d);
  const n = d.nodes.length;
  const pos: P[] = [];

  const place = (cx: number, cy: number, w: number, h: number) => pos.push({ x: cx - w / 2, y: cy - h / 2, w, h });
  if (layout === "vertical") {
    const h = Math.min(170, (area.h - (n - 1) * 70) / n);
    const gap = (area.h - n * h) / Math.max(n - 1, 1);
    d.nodes.forEach((_, i) => place(area.x + area.w / 2, area.y + h / 2 + i * (h + (n > 1 ? gap : 0)) + (n === 1 ? (area.h - h) / 2 : 0), Math.min(640, area.w), h));
  } else if (layout === "horizontal") {
    const w = (area.w - (n - 1) * 60) / n;
    d.nodes.forEach((_, i) => place(area.x + w / 2 + i * (w + 60), area.y + area.h / 2, w, 200));
  } else if (layout === "cycle" || layout === "hub") {
    const cx = area.x + area.w / 2, cy = area.y + area.h / 2;
    const ring = layout === "hub" ? d.nodes.slice(1) : d.nodes;
    const w = 280, h = 140;
    const rx = area.w / 2 - w / 2, ry = Math.min(area.h / 2 - h / 2, rx * 1.15);
    if (layout === "hub") place(cx, cy, 320, 170);
    ring.forEach((_, i) => {
      const a = -Math.PI / 2 + (i / ring.length) * Math.PI * 2;
      place(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, w, h);
    });
  } else if (layout === "grid") {
    const cols = 2, rows = Math.ceil(n / cols);
    const w = (area.w - 60) / 2, h = Math.min(170, (area.h - (rows - 1) * 60) / rows);
    const gy = (area.h - rows * h) / Math.max(rows - 1, 1);
    d.nodes.forEach((_, i) => place(area.x + w / 2 + (i % cols) * (w + 60), area.y + h / 2 + Math.floor(i / cols) * (h + gy), w, h));
  } else {
    const w = 300, h = 150;
    d.nodes.forEach((nd) => place(area.x + w / 2 + (nd.x ?? 0.5) * (area.w - w), area.y + h / 2 + (nd.y ?? 0.5) * (area.h - h), w, h));
  }

  const idx = new Map(d.nodes.map((nd, i) => [nd.id, i]));
  const big = layout === "vertical" || layout === "grid" || layout === "horizontal";
  const nodesHtml = d.nodes.map((nd, i) => {
    const p = pos[i];
    return `<div id="${sid}-n${i}" class="${sid}-node ${sid}-card" style="left:${r1(p.x)}px;top:${r1(p.y)}px;width:${r1(p.w)}px;height:${r1(p.h)}px">
          ${nd.icon ? `<span class="${sid}-node-ic">${iconSvg(nd.icon, big ? 64 : 48)}</span>` : ""}
          <span class="${sid}-node-tx"><span class="${sid}-node-l">${esc(nd.label)}</span>${nd.sub ? `<span class="${sid}-node-s">${esc(nd.sub)}</span>` : ""}</span>
        </div>`;
  }).join("\n        ");

  // Edge geometry: trim from rect boundary to rect boundary.
  const trim = (p: P, ux: number, uy: number) => {
    const hw = p.w / 2 + 16, hh = p.h / 2 + 16;
    const tx = ux === 0 ? Infinity : hw / Math.abs(ux);
    const ty = uy === 0 ? Infinity : hh / Math.abs(uy);
    return Math.min(tx, ty);
  };
  const edges = d.edges.filter((e) => idx.has(e.from) && idx.has(e.to) && e.from !== e.to);
  const edgesHtml = edges.map((e, k) => {
    const a = pos[idx.get(e.from)!], b = pos[idx.get(e.to)!];
    const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const s = trim(a, ux, uy), en = trim(b, ux, uy);
    const L = Math.max(24, len - s - en);
    const x1 = ax + ux * s, y1 = ay + uy * s;
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    const mx = x1 + (ux * L) / 2, my = y1 + (uy * L) / 2;
    return `<div class="${sid}-edge" style="left:${r1(x1)}px;top:${r1(y1)}px;width:${r1(L)}px;transform:rotate(${r1(ang)}deg)">
          <div id="${sid}-e${k}" class="${sid}-edge-line"></div>
          <div id="${sid}-e${k}h" class="${sid}-edge-head"></div>
        </div>${e.label ? `\n        <div id="${sid}-e${k}l" class="${sid}-edge-lbl" style="left:${r1(mx)}px;top:${r1(my)}px">${esc(e.label)}</div>` : ""}`;
  }).join("\n        ");

  const html = `
      ${t.html}
      <div id="${sid}-c" class="${sid}-dg">
        ${edgesHtml}
        ${nodesHtml}
      </div>`;

  const css = `
    ${titleCss(ctx)}
    #${sid}-c { position: absolute; inset: 0; }
    .${sid}-node { position: absolute; display: flex; align-items: center; justify-content: center; gap: 22px; padding: 0 28px; box-sizing: border-box; border-color: color-mix(in srgb, var(--accent) 55%, var(--line)); }
    .${sid}-node-ic { color: var(--accent); display: flex; flex: none; }
    .${sid}-node-tx { display: flex; flex-direction: column; text-align: ${big ? "left" : "center"}; }
    .${sid}-node-l { font-family: var(--font-display); font-weight: 800; font-size: ${big ? 54 : 40}px; line-height: 1.05; }
    .${sid}-node-s { font-family: var(--font-mono); font-size: var(--fs-label); color: var(--muted); margin-top: 6px; }
    .${sid}-edge { position: absolute; height: 0; transform-origin: 0 50%; }
    .${sid}-edge-line { position: absolute; left: 0; right: 18px; top: -4px; height: 8px; background: var(--accent); border-radius: 4px; }
    .${sid}-edge-head { position: absolute; right: 0; top: -15px; width: 0; height: 0; border-left: 26px solid var(--accent); border-top: 15px solid transparent; border-bottom: 15px solid transparent; }
    .${sid}-edge-lbl { position: absolute; transform: translate(-50%, -50%); background: var(--bg); color: var(--accent); font-family: var(--font-mono); font-size: var(--fs-label); padding: 6px 14px; border-radius: var(--r-sm); white-space: nowrap; }
  `;

  if (t.html) anim.enter(`#${sid}-title`, ctx.isFirst ? 0 : 0.1, { from: "up", dist: 30 });
  const t0 = 0.3;
  const window = Math.max(1.2, Math.min(ctx.durationS * 0.6, n * 0.8));
  const step = window / n;
  const at = d.nodes.map((_, i) => t0 + i * step);
  d.nodes.forEach((_, i) => anim.enter(`#${sid}-n${i}`, at[i], { from: "scale", ease: motion.ease }));
  edges.forEach((e, k) => {
    const ta = Math.max(at[idx.get(e.from)!], at[idx.get(e.to)!]) + Math.min(0.35, step * 0.5);
    anim.fadeIn(`#${sid}-e${k}`, ta, 0.05);
    anim.grow(`#${sid}-e${k}`, "x", ta, { dur: 0.45, ease: "power2.inOut" });
    anim.fadeIn(`#${sid}-e${k}h`, ta + 0.38, 0.12);
    if (e.label) anim.fadeIn(`#${sid}-e${k}l`, ta + 0.4, 0.25);
  });

  return { html, css, timeline: anim.out() };
};
