import type { BlockCtx } from "../../blocks/types";
import type { ExEl } from "../board";
import type { SketchDoc } from "../doc";
import { Pager, SK, titleFit, cycleColors, fit, lineH, measureText } from "./common";

interface Node { id: string; label: string; sub?: string; icon?: string; x?: number; y?: number }
interface Edge { from: string; to: string; label?: string }
type Layout = "auto" | "vertical" | "horizontal" | "cycle" | "hub" | "grid";

/**
 * diagram: exdraw-style rough boxes with their label lines and labelled arrows, drawn in order:
 * node, its label line(s), then every edge whose two ends are now on the board, then its label.
 */
export function skDiagram(ctx: BlockCtx<{ layout?: Layout; nodes: Node[]; edges?: Edge[] }>): SketchDoc {
  const p = new Pager(ctx);
  const { box } = ctx;
  const pal = p.pal;
  const b = p.b;
  const nodes = ctx.data.nodes;
  const edges = ctx.data.edges ?? [];
  const n = nodes.length;
  const custom = nodes.every((nd) => typeof nd.x === "number" && typeof nd.y === "number");
  let layout: Layout = ctx.data.layout ?? "auto";
  if (layout === "auto") layout = custom ? "auto" : n <= 5 ? "vertical" : "grid";
  if (layout === "horizontal" && n > 3) layout = "grid";

  let top = box.y;
  if (ctx.headline) {
    const t = titleFit(ctx.headline, box.w - 20);
    top = b.lines(box.x + box.w / 2, box.y, t.lines, { size: t.size, color: pal.ink, align: "center" }).bottom + 60;
  }
  const area = { x: box.x, y: top, w: box.w, h: box.y + box.h - top };

  // Node sizes and centres.
  const cols = layout === "grid" ? 2 : layout === "horizontal" ? n : 1;
  let bw = layout === "vertical" ? Math.min(660, area.w - 120) : layout === "horizontal" ? (area.w - (n - 1) * 70) / n : layout === "grid" ? (area.w - 110) / 2 : 330;
  const rowsN = layout === "grid" ? Math.ceil(n / 2) : layout === "vertical" ? n : 1;
  const rowsFor = layout === "cycle" || layout === "hub" ? Math.ceil(n / 2) + 1 : rowsN;
  // Shrink labels until the rows fit with at least 90 px between them (room for arrows + labels).
  let base = layout === "vertical" ? 60 : 54;
  const labelSize = (nd: Node) => fit(nd.label, bw - 44, base, SK.small, 2);
  const nodeH = (nd: Node) => { const l = labelSize(nd); return 40 + l.lines.length * lineH(l.size) + (nd.sub ? lineH(SK.small) : 0); };
  let bh = Math.max(...nodes.map(nodeH));
  const fits = () => (layout === "vertical" ? nodes.reduce((a, nd) => a + nodeH(nd), 0) : rowsFor * bh) + (rowsFor - 1) * 70 <= area.h;
  while (base > SK.small && !fits()) { base -= 2; bh = Math.max(...nodes.map(nodeH)); }
  const centres: Array<[number, number]> = [];
  if (custom && layout === "auto") {
    nodes.forEach((nd) => centres.push([area.x + bw / 2 + (area.w - bw) * nd.x!, area.y + bh / 2 + (area.h - bh) * nd.y!]));
  } else if (layout === "cycle" || layout === "hub") {
    bw = 300; bh = Math.max(...nodes.map(nodeH));
    const cx = area.x + area.w / 2, cy = area.y + area.h / 2;
    const ring = layout === "hub" ? nodes.slice(1) : nodes;
    const rx = (area.w - bw) / 2, ry = Math.min((area.h - bh) / 2, 420);
    if (layout === "hub") centres.push([cx, cy]);
    ring.forEach((_, i) => {
      const a = -Math.PI / 2 + (i / ring.length) * Math.PI * 2;
      centres.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    });
  } else if (layout === "vertical") {
    const hs = nodes.map(nodeH);
    const sumH = hs.reduce((a, h) => a + h, 0);
    const gapY = n > 1 ? Math.max(60, Math.min(150, (area.h - sumH) / (n - 1))) : 0;
    let yy = area.y + Math.max(0, (area.h - sumH - gapY * (n - 1)) / 2);
    hs.forEach((h) => { centres.push([area.x + area.w / 2, yy + h / 2]); yy += h + gapY; });
  } else {
    const gapY = rowsN > 1 ? Math.max(60, Math.min(150, (area.h - rowsN * bh) / (rowsN - 1))) : 0;
    const blockH = rowsN * bh + (rowsN - 1) * gapY;
    const y0 = area.y + Math.max(0, (area.h - blockH) / 2);
    nodes.forEach((_, i) => {
      const r = Math.floor(i / cols), c = layout === "grid" && r % 2 === 1 ? cols - 1 - (i % cols) : i % cols;
      const x = area.x + bw / 2 + c * (bw + (area.w - cols * bw) / Math.max(1, cols - 1));
      centres.push([x, y0 + bh / 2 + r * (bh + gapY)]);
    });
  }

  const els = new Map<string, ExEl>();
  const drawn = new Set<string>();
  const done = new Set<number>();
  const colors = cycleColors(pal);
  nodes.forEach((nd, i) => {
    const [cx, cy] = centres[i];
    const color = colors[i % colors.length];
    const h = layout === "vertical" ? nodeH(nd) : bh;
    const shape = b.box(cx - bw / 2, cy - h / 2, bw, h, { stroke: color, strokeWidth: SK.stroke });
    els.set(nd.id, shape);
    const l = labelSize(nd);
    const textH = l.lines.length * lineH(l.size) + (nd.sub ? lineH(SK.small) : 0);
    const ty = cy - textH / 2;
    const lines = b.lines(cx, ty, l.lines, { size: l.size, color, align: "center" });
    if (nd.sub) b.text(cx, lines.bottom, nd.sub, { size: SK.small, color: pal.muted, align: "center" });
    drawn.add(nd.id);
    edges.forEach((e, k) => {
      if (done.has(k) || !drawn.has(e.from) || !drawn.has(e.to)) return;
      const a = els.get(e.from)!, z = els.get(e.to)!;
      const arrow = b.arrowBetween(a, z, { stroke: pal.ink, strokeWidth: SK.thin, gap: 14 });
      done.add(k);
      if (e.label) {
        const pts = arrow.points as number[][];
        const mx = arrow.x + (pts[0][0] + pts[pts.length - 1][0]) / 2, my = arrow.y + (pts[0][1] + pts[pts.length - 1][1]) / 2;
        const vertical = Math.abs(pts[pts.length - 1][1] - pts[0][1]) > Math.abs(pts[pts.length - 1][0] - pts[0][0]);
        const lw = measureText(e.label, SK.small);
        const lx = vertical ? Math.min(mx + 26, box.x + box.w - lw) : mx - lw / 2;
        const ly = vertical ? my - lineH(SK.small) / 2 : my - lineH(SK.small) - 8;
        b.text(lx, ly, e.label, { size: SK.small, color: pal.accent2 });
      }
    });
  });
  return p.doc();
}
