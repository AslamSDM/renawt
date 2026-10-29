import type { BlockCtx } from "../../blocks/types";
import { formatNumber } from "../../util";
import { withUnit } from "../../blocks/common";
import type { SketchDoc } from "../doc";
import { Pager, SK, titleFit, fit, fitLine, lineH, measureText } from "./common";

interface Side { label: string; sub?: string; icon?: string; color?: string }
interface Round { metric: string; left: number; right: number; unit?: string; decimals?: number; higherIsBetter?: boolean }

/**
 * split-stat: one page per round. The header line (left vs right), the metric, two hachured bars
 * drawn one after the other, their values written above, then the winner circled.
 */
export function skSplitStat(ctx: BlockCtx<{ left: Side; right: Side; rounds: Round[]; roundNumber?: number }>): SketchDoc {
  const p = new Pager(ctx);
  const { box } = ctx;
  const pal = p.pal;
  const d = ctx.data;
  const cL = d.left.color ?? pal.accent, cR = d.right.color ?? pal.accent2;
  const cx = box.x + box.w / 2;
  d.rounds.forEach((r, k) => {
    if (k > 0) p.newPage();
    const b = p.b;
    let y = box.y;
    if (ctx.headline && k === 0) {
      const t = titleFit(ctx.headline, box.w - 20);
      y = b.lines(cx, y, t.lines, { size: t.size, color: pal.ink, align: "center" }).bottom + 40;
    }
    // Header "left vs right": shrink to fit, then cut each side's label to its half of the line.
    let hs = 64;
    while (hs > SK.small && measureText(`${d.left.label} vs ${d.right.label}`, hs) > box.w - 20) hs -= 2;
    const half = (box.w - 20 - measureText(" vs ", hs)) / 2;
    const hl = fitLine(d.left.label, half, hs, hs).line, hr = fitLine(d.right.label, half, hs, hs).line;
    b.segLine(cx, y, [{ text: `${hl} `, color: cL }, { text: "vs ", color: pal.muted }, { text: hr, color: cR }], { size: hs, align: "center" });
    y += lineH(64) + 30;
    const label = d.roundNumber ? `Round ${d.roundNumber + k}: ${r.metric}` : r.metric;
    const m = fit(label, box.w - 40, SK.sub, SK.small, 2);
    y = b.lines(cx, y, m.lines, { size: m.size, color: pal.ink, align: "center" }).bottom + 40;
    const fmt = (v: number) => withUnit(formatNumber(v, r.decimals ?? 0), r.unit ?? "");
    const valSize = 72;
    const base = box.y + box.h - lineH(SK.body) - 20;
    const maxH = base - (y + lineH(valSize) + 30);
    const top = Math.max(Math.abs(r.left), Math.abs(r.right)) || 1;
    const bw = 230;
    const xs = [cx - box.w / 4, cx + box.w / 4];
    const better = (r.higherIsBetter ?? true) ? (r.left >= r.right ? 0 : 1) : (r.left <= r.right ? 0 : 1);
    const heads: Array<{ x: number; y: number; w: number }> = [];
    [r.left, r.right].forEach((v, i) => {
      const h = Math.max(12, (Math.abs(v) / top) * maxH);
      const color = i === 0 ? cL : cR;
      b.box(xs[i] - bw / 2, base - h, bw, h, { stroke: color, strokeWidth: SK.thin, fill: color, fillStyle: "hachure", rounded: false });
      const vy = base - h - lineH(valSize) - 10;
      b.text(xs[i], vy, fmt(v), { size: valSize, color, align: "center" });
      heads.push({ x: xs[i], y: vy, w: measureText(fmt(v), valSize) });
      const sl = fitLine(i === 0 ? d.left.label : d.right.label, box.w / 2 - 30, SK.body, 36);
      b.text(xs[i], base + 14, sl.line, { size: sl.size, color: pal.muted, align: "center" });
    });
    const w = heads[better];
    b.ellipse(w.x - w.w / 2 - 34, w.y - 14, w.w + 68, lineH(valSize) + 28, { stroke: pal.green, strokeWidth: SK.stroke, roughness: 1.6 });
  });
  return p.doc();
}

/** split-title (X vs Y): two rough boxes, top and bottom, "vs" circled between, the question. */
export function skSplitTitle(ctx: BlockCtx<{ left: Side; right: Side; question?: string }>): SketchDoc {
  const p = new Pager(ctx);
  const { box } = ctx;
  const pal = p.pal;
  const d = ctx.data;
  const b = p.b;
  const cx = box.x + box.w / 2;
  const bh = 260, gap = 150;
  let y = box.y + Math.max(0, (box.h - (bh * 2 + gap + lineH(SK.sub) + 50)) * 0.4);
  const side = (s: Side, color: string, yy: number) => {
    b.box(box.x + 40, yy, box.w - 80, bh, { stroke: color, strokeWidth: SK.stroke });
    const l = fit(s.label, box.w - 160, 96, 60, 1);
    const th = lineH(l.size) + (s.sub ? lineH(SK.body) : 0);
    b.text(cx, yy + (bh - th) / 2, l.lines[0] ?? s.label, { size: l.size, color, align: "center" });
    if (s.sub) {
      const sub = fitLine(s.sub, box.w - 160, SK.body, 36);
      b.text(cx, yy + (bh - th) / 2 + lineH(l.size), sub.line, { size: sub.size, color: pal.muted, align: "center" });
    }
  };
  side(d.left, d.left.color ?? pal.accent, y);
  y += bh;
  b.ellipse(cx - 70, y + gap / 2 - 55, 140, 110, { stroke: pal.ink, strokeWidth: SK.thin, roughness: 1.5 });
  b.text(cx, y + gap / 2 - lineH(64) / 2, "vs", { size: 64, color: pal.ink, align: "center" });
  y += gap;
  side(d.right, d.right.color ?? pal.accent2, y);
  y += bh + 50;
  if (d.question) { const q = fitLine(d.question, box.w - 20, SK.sub, SK.small); b.text(cx, y, q.line, { size: q.size, color: pal.yellow, align: "center" }); }
  return p.doc();
}
