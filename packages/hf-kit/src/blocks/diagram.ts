import type { z } from "zod";
import type { BlockFn } from "./types";
import type { DiagramData } from "./schema";
import { estWidth, fitCss, fitHtml, fitLines, titleCss, titleHtml, type Fitted } from "./common";
import { iconSvg } from "./icons";
import { clamp, r1 } from "../util";

type D = z.infer<typeof DiagramData>;

/**
 * Resolved diagram layout. "single" = one node, drawn centred and large (a 1-node diagram is NOT
 * coerced to another block: see the note in coerce.ts).
 */
export type DiagramLayout = "single" | "vertical" | "horizontal" | "cycle" | "hub" | "grid" | "custom";
export interface Rect { x: number; y: number; w: number; h: number }
export interface GeoEdge { from: number; to: number; label?: string; /** Added by the layout (hub spoke with no edge of its own). */ implicit?: boolean }
export interface DiagramGeometry { layout: DiagramLayout; rects: Rect[]; edges: GeoEdge[]; hub: number; /** Node indices in reveal order. */ order: number[] }

/** Loose input shape shared by the HTML block and the sketch variant. */
export interface DiagramInput {
  layout?: string;
  nodes: Array<{ id: string; label?: string; sub?: string; icon?: string; x?: number; y?: number }>;
  edges?: Array<{ from: string; to: string; label?: string }>;
}

/** Node with the most incident edges (ties → the earlier node). */
function hubIndex(d: DiagramInput): number {
  const deg = d.nodes.map((nd) => (d.edges ?? []).filter((e) => e.from === nd.id || e.to === nd.id).length);
  return deg.reduce((best, v, i) => (v > deg[best] ? i : best), 0);
}

/**
 * Pick the layout for a 9:16 (portrait) or landscape canvas. Portrait rules:
 * horizontal rows of ≥ 3 nodes become a vertical chain (boxes would be ~290 px wide with tiny arrows),
 * grids of ≤ 3 become a chain, hubs/cycles of ≤ 2 become a chain, chains of ≥ 7 become a grid.
 */
export function resolveDiagramLayout(d: DiagramInput, portrait = true): { layout: DiagramLayout; hub: number } {
  const n = d.nodes.length;
  const hub = hubIndex(d);
  const req = d.layout ?? "auto";
  if (n <= 1) return { layout: "single", hub: 0 };
  if (req === "auto" && d.nodes.every((nd) => typeof nd.x === "number" && typeof nd.y === "number")) return { layout: "custom", hub };
  let L: DiagramLayout;
  if (req === "auto") {
    const edges = d.edges ?? [];
    const deg = edges.filter((e) => e.from === d.nodes[hub].id || e.to === d.nodes[hub].id).length;
    const last = d.nodes[n - 1].id;
    if (n >= 4 && deg >= n - 1) L = "hub";
    else if (n >= 3 && edges.some((e) => e.from === last && e.to === d.nodes[0].id)) L = "cycle";
    else L = n <= 5 ? "vertical" : "grid";
  } else L = req as DiagramLayout;
  if (L === "horizontal" && (n >= 4 || (portrait && n >= 3))) L = "vertical";
  if (L === "grid" && n <= 3) L = "vertical";
  if ((L === "hub" || L === "cycle") && n <= 2) L = "vertical";
  if (L === "vertical" && n >= 7) L = "grid";
  return { layout: L, hub };
}

/** Node rects + resolved edges for a diagram inside `area`. Pure geometry, shared by both renderers. */
export function diagramGeometry(d: DiagramInput, area: Rect, o: { portrait?: boolean } = {}): DiagramGeometry {
  const n = d.nodes.length;
  const { layout, hub } = resolveDiagramLayout(d, o.portrait ?? true);
  const rects: Rect[] = new Array(n);
  const at = (i: number, cx: number, cy: number, w: number, h: number) => { rects[i] = { x: cx - w / 2, y: cy - h / 2, w, h }; };
  const cx = area.x + area.w / 2, cy = area.y + area.h / 2;
  /** Stack `ids` top to bottom, centred, using the vertical space (gaps capped so arrows stay readable). */
  const column = (ids: number[], w: number, hMax: number, heights?: number[]) => {
    const m = ids.length;
    // Room for a readable arrow (≥ ~100 px visible) between rows; edge labels sit beside arrows.
    const gapMin = m >= 6 ? 64 : m === 5 ? 84 : 140;
    const h = clamp((area.h - (m - 1) * gapMin) / m, 90, hMax);
    const hs = ids.map((_, k) => heights?.[k] ?? h);
    const sum = hs.reduce((a, v) => a + v, 0);
    const gap = m > 1 ? clamp((area.h - sum) / (m - 1), 40, 200) : 0;
    let y = area.y + Math.max(0, (area.h - sum - gap * (m - 1)) / 2);
    ids.forEach((i, k) => { at(i, cx, y + hs[k] / 2, w, hs[k]); y += hs[k] + gap; });
  };

  if (layout === "single") {
    at(0, cx, cy, Math.min(area.w, 800), Math.min(360, area.h * 0.42));
  } else if (layout === "vertical") {
    column(d.nodes.map((_, i) => i), Math.min(area.w, 780), n <= 3 ? 230 : 200);
  } else if (layout === "horizontal") {
    // Wide enough for the longest edge label (sits above the arrow, between the boxes).
    const longest = Math.max(0, ...(d.edges ?? []).map((e) => (e.label ?? "").length));
    const gapX = clamp(longest * 0.62 * 30 + 50, 160, 300);
    const w = (area.w - (n - 1) * gapX) / n;
    const h = clamp(w * 0.72, 170, 320);
    d.nodes.forEach((_, i) => at(i, area.x + w / 2 + i * (w + gapX), cy, w, h));
  } else if (layout === "grid") {
    const cols = 2, rows = Math.ceil(n / cols), gapX = 80, gapMin = 90;
    const w = (area.w - gapX) / cols;
    const h = clamp((area.h - (rows - 1) * gapMin) / rows, 96, 220);
    const gapY = rows > 1 ? clamp((area.h - rows * h) / (rows - 1), 40, 180) : 0;
    const y0 = area.y + Math.max(0, (area.h - rows * h - (rows - 1) * gapY) / 2);
    d.nodes.forEach((_, i) => {
      const r = Math.floor(i / cols);
      const inRow = Math.min(cols, n - r * cols);
      // Snake order so consecutive nodes stay adjacent; a lone last node is centred.
      const c = inRow === 1 ? 0.5 : r % 2 === 1 ? cols - 1 - (i % cols) : i % cols;
      at(i, area.x + w / 2 + c * (w + gapX), y0 + h / 2 + r * (h + gapY), w, h);
    });
  } else if (layout === "hub") {
    const ring = d.nodes.map((_, i) => i).filter((i) => i !== hub);
    const k = ring.length;
    if (k <= 2) {
      column(k === 1 ? [hub, ring[0]] : [ring[0], hub, ring[1]], Math.min(area.w, 720), 220);
    } else {
      // Spokes in two rows (top row gets the extra one) around a centred hub: every spoke has a
      // clear straight line to the hub, arrows stay long, and 4 spokes read as a 2 + 2 pair grid.
      const top = Math.ceil(k / 2), bot = k - top, gx = 36;
      const sw = Math.min(400, (area.w - (top - 1) * gx) / top);
      // Box heights scale with the free height so the hub ↔ spoke gaps keep ≥ ~120 px of arrow.
      const sh = clamp(area.h * 0.2, 120, sw >= 300 ? 170 : 200);
      const hw = Math.min(560, area.w * 0.62), hh = clamp(sh + 10, 130, 200);
      at(hub, cx, cy, hw, hh);
      const dy = Math.min((area.h - sh) / 2, hh / 2 + sh / 2 + 300);
      const step = top > 1 ? Math.min(sw + 140, (area.w - sw) / (top - 1)) : 0;
      const row = (ids: number[], y: number) => ids.forEach((i, j) => at(i, cx + (j - (ids.length - 1) / 2) * step, y, sw, sh));
      row(ring.slice(0, top), cy - dy);
      if (bot) row(ring.slice(top), cy + dy);
    }
  } else if (layout === "cycle") {
    const w = n <= 4 ? Math.min(380, area.w * 0.42) : Math.min(300, area.w * 0.36);
    const h = 170;
    const rx = (area.w - w) / 2, ry = Math.min((area.h - h) / 2, 520);
    d.nodes.forEach((_, i) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      at(i, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, w, h);
    });
  } else {
    const w = 300, h = 150;
    d.nodes.forEach((nd, i) => at(i, area.x + w / 2 + (nd.x ?? 0.5) * (area.w - w), area.y + h / 2 + (nd.y ?? 0.5) * (area.h - h), w, h));
  }

  const idx = new Map(d.nodes.map((nd, i) => [nd.id, i]));
  const edges: GeoEdge[] = (d.edges ?? [])
    .filter((e) => idx.has(e.from) && idx.has(e.to) && e.from !== e.to)
    .map((e) => ({ from: idx.get(e.from)!, to: idx.get(e.to)!, label: e.label }));
  if (layout === "hub") {
    // Every spoke connects to the hub: add the missing hub ↔ spoke arrows (direction = the majority).
    const outward = edges.filter((e) => e.from === hub).length >= edges.filter((e) => e.to === hub).length;
    for (let i = 0; i < n; i++) {
      if (i === hub || edges.some((e) => e.from === i || e.to === i)) continue;
      edges.push(outward ? { from: hub, to: i, implicit: true } : { from: i, to: hub, implicit: true });
    }
  }
  const order = layout === "hub" ? [hub, ...d.nodes.map((_, i) => i).filter((i) => i !== hub)] : d.nodes.map((_, i) => i);
  return { layout, rects, edges, hub, order };
}

/**
 * Straight arrow between two boxes along their centre line, trimmed where that line leaves each
 * box (plus `gap`), so arrows start and end at box edges whatever the angle.
 */
export function edgeSegment(a: Rect, b: Rect, gap = 16): { x1: number; y1: number; x2: number; y2: number; len: number; ux: number; uy: number } {
  const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
  const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  const trim = (p: Rect) => Math.min(ux === 0 ? Infinity : (p.w / 2 + gap) / Math.abs(ux), uy === 0 ? Infinity : (p.h / 2 + gap) / Math.abs(uy));
  const s = trim(a), e = trim(b);
  const len = Math.max(0, d - s - e);
  return { x1: ax + ux * s, y1: ay + uy * s, x2: ax + ux * (s + len), y2: ay + uy * (s + len), len, ux, uy };
}

/** Per-block text budgets (also used by lint + the planner catalogue). */
export const DIAGRAM_TEXT = { label: 18, sub: 26, edge: 14 } as const;

interface NodeText { label: Fitted; sub: Fitted | null; icon: "none" | "left" | "top"; iconSize: number }

/** Fit a node's label + sub inside its rect: shrink, then wrap (≤ 2 lines), then drop to 1 sub line, then truncate. */
export function fitNodeText(nd: { label: string; sub?: string; icon?: string }, r: Rect, single = false): NodeText {
  const pad = r.w >= 400 ? 30 : 22, padY = 18;
  const icon: NodeText["icon"] = !nd.icon ? "none" : r.w >= 400 || r.h < 170 ? "left" : "top";
  const iconSize = single ? 88 : icon === "top" ? 44 : r.h >= 150 ? 60 : 44;
  const textW = r.w - pad * 2 - (icon === "left" ? iconSize + 22 : 0);
  const budget = r.h - padY * 2 - (icon === "top" ? iconSize + 10 : 0);
  let base = single ? 92 : r.w >= 400 ? 54 : 44;
  let subLines = 2, labLines = 2;
  for (;;) {
    const label = fitLines(nd.label, { maxWidth: textW, maxLines: labLines, base, min: 28, weight: 800 });
    const sub = nd.sub ? fitLines(nd.sub, { maxWidth: textW, maxLines: subLines, base: single ? 36 : 30, min: 22, mono: true }) : null;
    const h = label.lines.length * label.size * 1.08 + (sub ? 6 + sub.lines.length * sub.size * 1.25 : 0);
    if (h <= budget) return { label, sub, icon, iconSize };
    if (sub && subLines > 1) { subLines = 1; continue; }
    if (base > 30) { base -= 4; subLines = 2; continue; }
    if (labLines > 1) { labLines = 1; continue; }
    return { label, sub, icon, iconSize };
  }
}

/** Nodes + arrows. Arrows are rotated wrappers (static CSS) whose inner line grows with scaleX. */
export const diagram: BlockFn<D> = (ctx) => {
  const { sid, box, anim, motion } = ctx;
  const d = ctx.data;
  const t = titleHtml(ctx, ctx.headline);
  const top = box.y + (t.h ? t.h + 24 : 0);
  const area = { x: box.x, y: top, w: box.w, h: box.y + box.h - top };
  const g = diagramGeometry(d, area, { portrait: ctx.height >= ctx.width });
  const { rects: pos, edges, layout } = g;
  const n = d.nodes.length;
  const single = layout === "single";

  const nodesHtml = d.nodes.map((nd, i) => {
    const p = pos[i];
    const f = fitNodeText(nd, p, single);
    const ic = f.icon !== "none" ? `<span class="${sid}-node-ic">${iconSvg(nd.icon!, f.iconSize)}</span>` : "";
    const align = f.icon === "left" ? "left" : "center";
    return `<div id="${sid}-n${i}" class="${sid}-node ${sid}-card${f.icon === "top" ? ` ${sid}-node-col` : ""}" style="left:${r1(p.x)}px;top:${r1(p.y)}px;width:${r1(p.w)}px;height:${r1(p.h)}px">
          ${ic}<span class="${sid}-node-tx" style="text-align:${align};align-items:${align === "left" ? "flex-start" : "center"}">${fitHtml(sid, nd.label, f.label, { cls: `${sid}-node-l`, role: "diagram node label", max: DIAGRAM_TEXT.label })}${f.sub ? fitHtml(sid, nd.sub!, f.sub, { cls: `${sid}-node-s`, role: "diagram node sub", max: DIAGRAM_TEXT.sub }) : ""}</span>
        </div>`;
  }).join("\n        ");

  const edgesHtml = edges.map((e, k) => {
    const s = edgeSegment(pos[e.from], pos[e.to]);
    const L = Math.max(24, s.len);
    const ang = (Math.atan2(s.uy, s.ux) * 180) / Math.PI;
    const mx = (s.x1 + s.x2) / 2, my = (s.y1 + s.y2) / 2;
    const lab = e.label ? fitLines(e.label, { maxWidth: Math.min(380, area.w * 0.45), maxLines: 1, base: ctx.type.label, min: 22, mono: true }) : null;
    // Labels never sit on the arrow: beside a vertical-ish arrow (right, or left when there is no
    // room), above a horizontal-ish one.
    let lpos = "";
    if (lab) {
      const lw = estWidth(lab.lines[0] ?? "", lab.size, { mono: true }) + 28;
      if (Math.abs(s.uy) > Math.abs(s.ux)) {
        const right = mx + 22 + lw <= box.x + box.w;
        lpos = `left:${r1(right ? mx + 22 : mx - 22 - lw)}px;top:${r1(my)}px;transform:translateY(-50%)`;
      } else {
        lpos = `left:${r1(clamp(mx, box.x + lw / 2, box.x + box.w - lw / 2))}px;top:${r1(my - 22)}px;transform:translate(-50%,-100%)`;
      }
    }
    return `<div class="${sid}-edge" style="left:${r1(s.x1)}px;top:${r1(s.y1)}px;width:${r1(L)}px;transform:rotate(${r1(ang)}deg)">
          <div id="${sid}-e${k}" class="${sid}-edge-line"></div>
          <div id="${sid}-e${k}h" class="${sid}-edge-head"></div>
        </div>${lab ? `\n        <div id="${sid}-e${k}l" class="${sid}-edge-lbl" style="${lpos}">${fitHtml(sid, e.label!, lab, { cls: `${sid}-edge-tx`, role: "diagram edge label", max: DIAGRAM_TEXT.edge })}</div>` : ""}`;
  }).join("\n        ");

  const html = `
      ${t.html}
      <div id="${sid}-c" class="${sid}-dg">
        ${edgesHtml}
        ${nodesHtml}
      </div>`;

  const css = `
    ${titleCss(ctx)}
    ${fitCss(sid)}
    #${sid}-c { position: absolute; inset: 0; }
    .${sid}-node { position: absolute; display: flex; align-items: center; justify-content: center; gap: 22px; padding: 18px ${single ? 40 : 26}px; box-sizing: border-box; overflow: hidden; border-color: color-mix(in srgb, var(--accent) 55%, var(--line)); }
    .${sid}-node-col { flex-direction: column; gap: 10px; }
    .${sid}-node-ic { color: var(--accent); display: flex; flex: none; }
    .${sid}-node-tx { display: flex; flex-direction: column; min-width: 0; }
    .${sid}-node-l { font-family: var(--font-display); font-weight: 800; line-height: 1.08; }
    .${sid}-node-s { font-family: var(--font-mono); color: var(--muted); margin-top: 6px; line-height: 1.25; }
    .${sid}-edge { position: absolute; height: 0; transform-origin: 0 50%; }
    .${sid}-edge-line { position: absolute; left: 0; right: 18px; top: -4px; height: 8px; background: var(--accent); border-radius: 4px; }
    .${sid}-edge-head { position: absolute; right: 0; top: -15px; width: 0; height: 0; border-left: 26px solid var(--accent); border-top: 15px solid transparent; border-bottom: 15px solid transparent; }
    .${sid}-edge-lbl { position: absolute; background: var(--bg); color: var(--accent); font-family: var(--font-mono); padding: 6px 14px; border-radius: var(--r-sm); white-space: nowrap; }
  `;

  if (t.html) anim.enter(`#${sid}-title`, ctx.isFirst ? 0 : 0.1, { from: "up", dist: 30 });
  // The whole diagram is on screen by ~45% of the scene so the finished picture is held, not
  // glimpsed: nodes in reveal order (hub first), each arrow as soon as both of its ends exist.
  const t0 = 0.3;
  const budget = clamp(ctx.durationS * 0.45 - t0 - 0.6, 0.4, n * 0.7);
  const step = n > 1 ? budget / (n - 1) : 0;
  const at: number[] = new Array(n);
  g.order.forEach((i, k) => { at[i] = t0 + k * step; });
  g.order.forEach((i) => anim.enter(`#${sid}-n${i}`, at[i], { from: "scale", ease: motion.ease }));
  edges.forEach((e, k) => {
    const ta = Math.max(at[e.from], at[e.to]) + Math.min(0.25, step * 0.5 + 0.1);
    anim.fadeIn(`#${sid}-e${k}`, ta, 0.05);
    anim.grow(`#${sid}-e${k}`, "x", ta, { dur: 0.4, ease: "power2.inOut" });
    anim.fadeIn(`#${sid}-e${k}h`, ta + 0.34, 0.12);
    if (e.label) anim.fadeIn(`#${sid}-e${k}l`, ta + 0.36, 0.25);
  });

  return { html, css, timeline: anim.out() };
};

