import type { BlockCtx } from "../../blocks/types";
import { compactNumber } from "../../util";
import { withUnit } from "../../blocks/common";
import type { SketchDoc } from "../doc";
import { Pager, SK, titleFit, cycleColors, fit, lineH, measureText } from "./common";

interface ChartD {
  type?: "line" | "bar" | "area";
  labels?: string[];
  series: Array<{ name: string; values: number[]; color?: string }>;
  unit?: string;
  yMin?: number;
  yMax?: number;
  annotations?: Array<{ index: number; label: string; series?: number }>;
  source?: string;
}

/**
 * chart: hand-drawn axes first, then each series drawn on (rough polyline, or hachured bars one
 * by one), then the value labels and annotations are written, then the source line.
 */
export function skChart(ctx: BlockCtx<ChartD>): SketchDoc {
  const p = new Pager(ctx);
  const { box } = ctx;
  const pal = p.pal;
  const b = p.b;
  const d = ctx.data;
  const type = d.type ?? "line";
  const unit = d.unit ?? "";
  const colors = cycleColors(pal);
  let y = box.y;
  if (ctx.headline) {
    const t = titleFit(ctx.headline, box.w - 20);
    y = b.lines(box.x + box.w / 2, y, t.lines, { size: t.size, color: pal.ink, align: "center" }).bottom + 50;
  }
  const all = d.series.flatMap((s) => s.values);
  const [lo, hi] = niceRange(d.yMin ?? (type === "bar" ? Math.min(0, ...all) : Math.min(...all)), d.yMax ?? Math.max(...all));
  const fmt = (v: number) => withUnit(compactNumber(v), unit);
  const yLabW = Math.max(measureText(fmt(hi), SK.small), measureText(fmt(lo), SK.small)) + 20;
  const sourceH = d.source ? lineH(SK.small) + 20 : 0;
  const legendH = d.series.length > 1 ? lineH(SK.small) + 16 : 0;
  const plot = { x: box.x + yLabW + 10, y: y + 30 + legendH, w: box.w - yLabW - 40, h: box.y + box.h - (y + 30 + legendH) - lineH(SK.small) - 30 - sourceH };
  const n = Math.max(...d.series.map((s) => s.values.length));
  const X = (i: number) => (type === "bar" ? plot.x + ((i + 0.5) / n) * plot.w : plot.x + (n === 1 ? plot.w / 2 : (i / (n - 1)) * plot.w));
  const Y = (v: number) => plot.y + plot.h - ((v - lo) / (hi - lo || 1)) * plot.h;

  // Axes (one unit): y axis up, x axis right, both with arrow heads.
  const ya = b.arrow([[plot.x, plot.y + plot.h + 6], [plot.x, plot.y - 30]], { stroke: pal.ink, strokeWidth: SK.thin, curved: false });
  const xa = b.arrow([[plot.x - 6, plot.y + plot.h], [plot.x + plot.w + 24, plot.y + plot.h]], { stroke: pal.ink, strokeWidth: SK.thin, curved: false });
  b.group(ya, xa);
  // Axis labels: y max, y min, first and last x label.
  b.text(plot.x - 16, Y(hi) - lineH(SK.small) / 2, fmt(hi), { size: SK.small, color: pal.muted, align: "right" });
  b.text(plot.x - 16, Y(lo) - lineH(SK.small) * 0.75, fmt(lo), { size: SK.small, color: pal.muted, align: "right" });
  const labels = d.labels ?? [];
  if (labels.length) {
    b.text(X(0), plot.y + plot.h + 14, labels[0], { size: SK.small, color: pal.muted, align: type === "bar" ? "center" : "left" });
    if (labels.length > 1) b.text(X(labels.length - 1), plot.y + plot.h + 14, labels[labels.length - 1], { size: SK.small, color: pal.muted, align: type === "bar" ? "center" : "right" });
  }
  if (d.series.length > 1) {
    let lx = plot.x + 10;
    d.series.forEach((s, k) => {
      const color = s.color ?? colors[k % colors.length];
      b.text(lx, y, s.name, { size: SK.small, color });
      lx += measureText(s.name, SK.small) + 50;
    });
  }

  d.series.forEach((s, k) => {
    const color = s.color ?? colors[k % colors.length];
    if (type === "bar") {
      const slot = plot.w / n, m = d.series.length;
      const bw = Math.min(140, (slot * 0.72) / m);
      s.values.forEach((v, i) => {
        const x = X(i) - (bw * m) / 2 + k * bw;
        const top = Y(Math.max(v, 0)), base = Y(Math.max(lo, 0));
        b.box(x + 4, top, bw - 8, Math.max(6, base - top), { stroke: color, strokeWidth: SK.thin, fill: color, fillStyle: "hachure", rounded: false });
        if (n <= 6 && m === 1) b.text(x + bw / 2, top - lineH(SK.small) - 6, fmt(v), { size: SK.small, color, align: "center" });
      });
    } else {
      const pts = s.values.map((v, i) => [X(i), Y(v)] as [number, number]);
      if (type === "area") {
        const poly: Array<[number, number]> = [...pts, [X(s.values.length - 1), Y(lo)], [X(0), Y(lo)], pts[0]];
        const area = b.line(poly, { stroke: "transparent", fill: color, fillStyle: "hachure", strokeWidth: 2 });
        const ln = b.line(pts, { stroke: color, strokeWidth: SK.stroke + 1, curved: true });
        b.group(ln, area);
      } else {
        b.line(pts, { stroke: color, strokeWidth: SK.stroke + 1, curved: true });
      }
      const last = pts[pts.length - 1];
      b.text(Math.min(last[0], box.x + box.w), last[1] - lineH(SK.small) - 10, fmt(s.values[s.values.length - 1]), { size: SK.small, color, align: "right" });
    }
  });

  // Annotations: the label written near the point (first free spot above, then below), then an arrow to it.
  const taken: Array<{ x: number; y: number; w: number; h: number }> = [];
  const hit = (r: { x: number; y: number; w: number; h: number }) => taken.some((t) => r.x < t.x + t.w + 16 && t.x < r.x + r.w + 16 && r.y < t.y + t.h + 10 && t.y < r.y + r.h + 10);
  (d.annotations ?? []).forEach((a) => {
    const s = d.series[a.series ?? 0] ?? d.series[0];
    const i = Math.min(a.index, s.values.length - 1);
    const px = X(i), py = Y(s.values[i]);
    const lab = fit(a.label, Math.min(380, plot.w * 0.45), SK.small, SK.small, 2);
    const lh = lab.lines.length * lineH(lab.size);
    const lw = Math.max(...lab.lines.map((l) => measureText(l, lab.size)));
    const cands: Array<{ x: number; y: number; up: boolean }> = [];
    for (const up of [true, false]) {
      for (const dy of [100, 100 + lh + 20, 100 + 2 * (lh + 20)]) {
        for (const dx of [0, -lw / 2 - 30, lw / 2 + 30]) cands.push({ x: Math.max(box.x, Math.min(px - lw / 2 + dx, box.x + box.w - lw)), y: up ? py - dy - lh : py + dy, up });
      }
    }
    const inside = (c: { x: number; y: number }) => c.y >= plot.y - 10 && c.y + lh <= plot.y + plot.h - 10 && c.x >= box.x && c.x + lw <= box.x + box.w;
    const c = cands.find((c) => inside(c) && !hit({ x: c.x, y: c.y, w: lw, h: lh })) ?? cands.find(inside) ?? cands[0];
    const lx = Math.max(box.x, Math.min(c.x, box.x + box.w - lw));
    taken.push({ x: lx, y: c.y, w: lw, h: lh });
    b.lines(lx, c.y, lab.lines, { size: lab.size, color: pal.yellow });
    const ax = Math.max(lx + 10, Math.min(px, lx + lw - 10));
    b.arrow(c.up ? [[ax, c.y + lh + 6], [px, py - 14]] : [[ax, c.y - 6], [px, py + 14]], { stroke: pal.yellow, strokeWidth: SK.thin, curved: false });
  });
  if (d.source) b.text(box.x, box.y + box.h - lineH(SK.small), `Source: ${d.source}`.slice(0, 60), { size: SK.small, color: pal.muted });
  return p.doc();
}

/** Round an axis range out to a "nice" step (1, 2, 2.5 or 5 × 10^n, about 4 steps). */
export function niceRange(lo: number, hi: number): [number, number] {
  if (!(hi > lo)) return [lo - 1, hi + 1];
  const raw = (hi - lo) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step];
}
