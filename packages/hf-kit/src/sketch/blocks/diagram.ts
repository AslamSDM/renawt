import type { BlockCtx } from "../../blocks/types";
import { diagramGeometry, edgeSegment, type Rect } from "../../blocks/diagram";
import type { ExEl } from "../board";
import type { SketchDoc } from "../doc";
import { Pager, SK, titleFit, cycleColors, fit, fitLine, lineH, measureText } from "./common";

interface Node { id: string; label: string; sub?: string; icon?: string; x?: number; y?: number }
interface Edge { from: string; to: string; label?: string }
type Layout = "auto" | "vertical" | "horizontal" | "cycle" | "hub" | "grid";

/** Label + sub lines fitted inside a node box (shrink → wrap → ellipsis). */
function nodeText(nd: Node, r: Rect, single: boolean) {
  const tw = r.w - 44;
  let base = single ? 96 : r.w >= 400 ? 60 : 54;
  for (;;) {
    const label = fit(nd.label, tw, base, SK.small, 2);
    const sub = nd.sub ? fit(nd.sub, tw, single ? SK.body : SK.small, 36, r.h >= 200 || single ? 2 : 1) : null;
    const h = label.lines.length * lineH(label.size) + (sub ? sub.lines.length * lineH(sub.size) : 0);
    if (h <= r.h - 28 || base <= SK.small) return { label, sub, h };
    base -= 4;
  }
}

/**
 * diagram: exdraw-style rough boxes with their label lines and labelled arrows, drawn in order:
 * node, its label line(s), then every edge whose two ends are now on the board, then its label.
 * Geometry (layout choice, node rects, hub spokes, edge trimming) is shared with the HTML block.
 */
export function skDiagram(ctx: BlockCtx<{ layout?: Layout; nodes: Node[]; edges?: Edge[] }>): SketchDoc {
  const p = new Pager(ctx);
  const { box } = ctx;
  const pal = p.pal;
  const b = p.b;
  const nodes = ctx.data.nodes;

  let top = box.y;
  if (ctx.headline) {
    const t = titleFit(ctx.headline, box.w - 20);
    top = b.lines(box.x + box.w / 2, box.y, t.lines, { size: t.size, color: pal.ink, align: "center" }).bottom + 60;
  }
  const area = { x: box.x, y: top, w: box.w, h: box.y + box.h - top };
  const g = diagramGeometry(ctx.data, area, { portrait: ctx.height >= ctx.width });
  const single = g.layout === "single";
  const texts = nodes.map((nd, i) => nodeText(nd, g.rects[i], single));
  // Hand-written text is wider than the HTML face: let a box grow (centred) to hold its lines.
  const rects = g.rects.map((r, i) => {
    const need = texts[i].h + 40;
    if (need <= r.h) return r;
    const h = Math.min(need, r.h + 70);
    return { ...r, y: r.y - (h - r.h) / 2, h };
  });

  const els = new Map<number, ExEl>();
  const done = new Set<number>();
  const colors = cycleColors(pal);
  g.order.forEach((i) => {
    const nd = nodes[i];
    const r = rects[i];
    const color = colors[i % colors.length];
    els.set(i, b.box(r.x, r.y, r.w, r.h, { stroke: color, strokeWidth: SK.stroke }));
    const { label, sub, h } = texts[i];
    const cx = r.x + r.w / 2;
    const lines = b.lines(cx, r.y + (r.h - h) / 2, label.lines, { size: label.size, color, align: "center" });
    if (sub) b.lines(cx, lines.bottom, sub.lines, { size: sub.size, color: pal.muted, align: "center" });
    g.edges.forEach((e, k) => {
      if (done.has(k) || !els.has(e.from) || !els.has(e.to)) return;
      const s = edgeSegment(rects[e.from], rects[e.to], 14);
      b.arrow([[s.x1, s.y1], [s.x2, s.y2]], { stroke: pal.ink, strokeWidth: SK.thin, curved: false });
      done.add(k);
      if (e.label) {
        const vertical = Math.abs(s.uy) > Math.abs(s.ux);
        // Above a horizontal arrow the label must not reach into the boxes either side.
        const l = fitLine(e.label, Math.min(380, box.w * 0.42, vertical ? Infinity : s.len + 24), SK.small, 36);
        const lw = measureText(l.line, l.size);
        const mx = (s.x1 + s.x2) / 2, my = (s.y1 + s.y2) / 2;
        // Beside a vertical arrow (flipped left when there is no room right), above a horizontal one.
        let lx = vertical ? mx + 26 : mx - lw / 2;
        if (vertical && lx + lw > box.x + box.w) lx = mx - 26 - lw;
        lx = Math.max(box.x, Math.min(lx, box.x + box.w - lw));
        const ly = vertical ? my - lineH(l.size) / 2 : my - lineH(l.size) - 8;
        b.text(lx, ly, l.line, { size: l.size, color: pal.accent2 });
      }
    });
  });
  return p.doc();
}
