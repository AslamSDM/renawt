import type { BlockCtx } from "../../blocks/types";
import { formatNumber } from "../../util";
import { domainOf, withUnit } from "../../blocks/common";
import type { SketchDoc } from "../doc";
import { Pager, SK, titleFit, fit, fitLine, lineH, measureText, tick, underline, writeEmphasis } from "./common";

/** kinetic-headline: kicker, then the headline hand-written line by line, a marker underline, the sub. */
export function skHeadline(ctx: BlockCtx<{ kicker?: string; emphasis?: string[]; align?: "center" | "left" }>): SketchDoc {
  const p = new Pager(ctx);
  const { box } = ctx;
  const pal = p.pal;
  const d = ctx.data ?? {};
  const left = d.align === "left";
  const cx = left ? box.x + 10 : box.x + box.w / 2;
  const align = left ? "left" : "center";
  const head = fit(ctx.headline ?? "", box.w - 40, SK.hero, 72, 4);
  const sub = ctx.body ? fit(ctx.body, box.w - 60, SK.body, SK.small, 2) : null;
  const kick = d.kicker ? { size: 48 } : null;
  const total = (kick ? lineH(kick.size) + 34 : 0) + head.lines.length * lineH(head.size) + 46 + (sub ? 30 + sub.lines.length * lineH(sub.size) : 0);
  let y = box.y + Math.max(0, (box.h - total) * 0.42);
  const b = p.b;
  if (kick && d.kicker) {
    b.text(cx, y, d.kicker, { size: kick.size, color: pal.accent2, align });
    y += lineH(kick.size) + 34;
  }
  const w = writeEmphasis(b, cx, y, head.lines, { size: head.size, color: pal.ink, accent: pal.accent, emphasis: d.emphasis, align });
  // Marker underline under the first emphasis word, else under the last line.
  const emph = (d.emphasis ?? [])[0]?.toLowerCase();
  let ux0 = 0, ux1 = 0, uy = 0;
  if (emph) {
    w.els.forEach((segs, i) => {
      for (const s of segs) {
        const t = String(s.text);
        const at = t.toLowerCase().indexOf(emph);
        if (at < 0 || ux1) continue;
        ux0 = s.x + measureText(t.slice(0, at), head.size);
        ux1 = ux0 + measureText(t.slice(at, at + emph.length), head.size);
        uy = y + (i + 1) * lineH(head.size) - head.size * 0.12;
      }
    });
  }
  if (!ux1) {
    const last = head.lines[head.lines.length - 1] ?? "";
    const lw = Math.min(measureText(last, head.size), box.w - 40);
    ux0 = left ? cx : cx - lw / 2;
    ux1 = ux0 + lw;
    uy = w.bottom - head.size * 0.12;
  }
  underline(b, ux0 - 6, ux1 + 6, uy, pal.accent2, 6);
  y = w.bottom + 46;
  if (sub) {
    b.lines(cx, y + 30, sub.lines, { size: sub.size, color: pal.muted, align });
  }
  return p.doc();
}

/** counter: the title, the number written big, a tally of ticks under it, then the label. */
export function skCounter(ctx: BlockCtx<{ value: number; from?: number; decimals?: number; prefix?: string; suffix?: string; label?: string }>): SketchDoc {
  const p = new Pager(ctx);
  const { box } = ctx;
  const pal = p.pal;
  const d = ctx.data;
  const cx = box.x + box.w / 2;
  const b = p.b;
  const title = ctx.headline ? titleFit(ctx.headline, box.w - 40) : null;
  const num = `${d.prefix ?? ""}${formatNumber(d.value, d.decimals ?? 0)}${d.suffix ?? ""}`;
  const numSize = Math.max(96, Math.min(200, Math.floor((box.w - 60) / Math.max(1, measureText(num, 1)))));
  const label = d.label ? fit(d.label, box.w - 80, SK.body, SK.small, 2) : null;
  const total = (title ? title.lines.length * lineH(title.size) + 60 : 0) + lineH(numSize) + 70 + (label ? label.lines.length * lineH(label.size) + 20 : 0);
  let y = box.y + Math.max(0, (box.h - total) * 0.42);
  if (title) { y = b.lines(cx, y, title.lines, { size: title.size, color: pal.ink, align: "center" }).bottom + 60; }
  b.text(cx, y, num, { size: numSize, color: pal.accent, align: "center" });
  const nw = Math.min(measureText(num, numSize), box.w - 40);
  y += lineH(numSize);
  // "ticks": a rough rule with tally marks, drawn as one unit after the number.
  const x0 = cx - nw / 2, x1 = cx + nw / 2;
  const rule = underline(b, x0, x1, y, pal.accent2, 5);
  const ticks = [0.2, 0.4, 0.6, 0.8].map((f) => b.line([[x0 + nw * f, y - 16], [x0 + nw * f + 6, y + 18]], { stroke: pal.accent2, strokeWidth: 4 }));
  b.group(rule, ...ticks);
  y += 70;
  if (label) b.lines(cx, y, label.lines, { size: label.size, color: pal.muted, align: "center" });
  return p.doc();
}

/** strike-through: MYTH label, the myth written line by line, a red strike per line, then the FACT. */
export function skStrike(ctx: BlockCtx<{ myth?: string; label?: string; truth?: string; truthLabel?: string }>): SketchDoc {
  const p = new Pager(ctx);
  const { box } = ctx;
  const pal = p.pal;
  const d = ctx.data ?? {};
  const b = p.b;
  const x = box.x + 20;
  const myth = fit(d.myth ?? ctx.headline ?? "", box.w - 60, 84, 56, d.truth ? 3 : 5);
  const truth = d.truth ? fit(d.truth, box.w - 60, SK.sub, SK.small, 2) : null;
  const total = lineH(50) + 24 + myth.lines.length * lineH(myth.size) + (truth ? 90 + lineH(50) + 24 + truth.lines.length * lineH(truth.size) : 0);
  let y = box.y + Math.max(0, (box.h - total) * 0.4);
  b.text(x, y, d.label ?? "MYTH", { size: 50, color: pal.red });
  y += lineH(50) + 24;
  const m = b.lines(x, y, myth.lines, { size: myth.size, color: pal.ink });
  m.els.forEach((el, i) => {
    const ly = y + i * lineH(myth.size) + myth.size * 0.62;
    const s = b.line([[el.x - 10, ly + 6], [el.x + el.width * 0.5, ly - 4], [el.x + el.width + 12, ly + 2]], { stroke: pal.red, strokeWidth: 6, roughness: 1.5, curved: true });
    s.customData = { pauseAfter: 0.05 };
  });
  y = m.bottom + 90;
  if (truth) {
    const lw = measureText(d.truthLabel ?? "FACT", 50);
    b.text(x, y, d.truthLabel ?? "FACT", { size: 50, color: pal.green });
    tick(b, x + lw + 22, y + 6, 52, pal.green);
    y += lineH(50) + 24;
    b.lines(x, y, truth.lines, { size: truth.size, color: pal.ink });
  }
  return p.doc();
}

/** source-card: rough card, the quote written line by line, a marker on the highlight, the citation. */
export function skSource(ctx: BlockCtx<{ quote: string; source: string; date?: string; url?: string; highlight?: string; stat?: { value: string; label: string } }>): SketchDoc {
  const p = new Pager(ctx);
  const { box } = ctx;
  const pal = p.pal;
  const d = ctx.data;
  const b = p.b;
  const pad = 48;
  const q = fit(`“${d.quote}”`, box.w - pad * 2, SK.sub, SK.small, Math.max(2, 6 - (d.stat ? 2 : 0) - (d.url ? 1 : 0)));
  const cite = `— ${[d.source, d.date].filter(Boolean).join(", ")}`;
  const citeL = fit(cite, box.w - pad * 2, 46, SK.small, 1);
  const statH = d.stat ? lineH(120) + lineH(46) + 50 : 0;
  const cardH = pad + q.lines.length * lineH(q.size) + 36 + lineH(citeL.size) + (d.url ? lineH(40) : 0) + pad;
  let y = box.y + Math.max(0, (box.h - cardH - statH) * 0.4);
  const cx = box.x + box.w / 2;
  if (d.stat) {
    const sv = fitLine(d.stat.value, box.w - 40, 120, 72);
    b.text(cx, y, sv.line, { size: sv.size, color: pal.accent, align: "center" });
    y += lineH(120);
    const sl = fitLine(d.stat.label, box.w - 40, 46, 36);
    b.text(cx, y, sl.line, { size: sl.size, color: pal.muted, align: "center" });
    y += lineH(46) + 50;
  }
  b.box(box.x, y, box.w, cardH, { stroke: pal.ink, strokeWidth: SK.thin, fill: pal.panel, fillStyle: "solid" });
  const ty = y + pad;
  const qs = b.lines(box.x + pad, ty, q.lines, { size: q.size, color: pal.ink });
  // Marker highlight over the highlighted words (drawn after the quote is written).
  if (d.highlight) {
    const hl = d.highlight.toLowerCase();
    q.lines.forEach((line, i) => {
      const at = line.toLowerCase().indexOf(hl);
      if (at < 0) return;
      const hx = box.x + pad + measureText(line.slice(0, at), q.size);
      const hw = measureText(line.slice(at, at + hl.length), q.size);
      b.box(hx - 8, ty + i * lineH(q.size) + q.size * 0.12, hw + 16, q.size * 1.05, { stroke: "transparent", fill: pal.marker, fillStyle: "solid", opacity: 38, rounded: false, roughness: 2 });
    });
  }
  b.text(box.x + pad, qs.bottom + 36, citeL.lines[0] ?? cite, { size: citeL.size, color: pal.accent2 });
  if (d.url) b.text(box.x + pad, qs.bottom + 36 + lineH(citeL.size), domainOf(d.url), { size: 40, color: pal.muted });
  return p.doc();
}

/** headline-card: a rough newspaper frame: outlet, double rule, dateline, the headline line by line. */
export function skNews(ctx: BlockCtx<{ outlet: string; headline?: string; date: string; url?: string; category?: string }>): SketchDoc {
  const p = new Pager(ctx);
  const { box } = ctx;
  const pal = p.pal;
  const d = ctx.data;
  const b = p.b;
  const pad = 44;
  const cx = box.x + box.w / 2;
  const head = fit(d.headline ?? ctx.headline ?? "", box.w - pad * 2, 78, 52, 4);
  const h = pad + lineH(68) + 40 + lineH(44) + 40 + head.lines.length * lineH(head.size) + pad + (d.url ? lineH(40) : 0);
  let y = box.y + Math.max(0, (box.h - h) * 0.42);
  const outer = b.box(box.x, y, box.w, h, { stroke: pal.ink, strokeWidth: SK.stroke, rounded: false });
  const inner = b.box(box.x + 14, y + 14, box.w - 28, h - 28, { stroke: pal.ink, strokeWidth: 2, rounded: false });
  b.group(outer, inner);
  y += pad;
  const ol = fitLine(d.outlet, box.w - pad * 2, 68, 44);
  b.text(cx, y, ol.line, { size: ol.size, color: pal.ink, align: "center" });
  y += lineH(68) + 16;
  const r1 = b.line([[box.x + pad, y], [box.x + box.w - pad, y]], { stroke: pal.ink, strokeWidth: 3 });
  const r2 = b.line([[box.x + pad, y + 10], [box.x + box.w - pad, y + 10]], { stroke: pal.ink, strokeWidth: 2 });
  b.group(r1, r2);
  y += 24;
  b.text(cx, y, [d.category, d.date].filter(Boolean).join("  ·  "), { size: 44, color: pal.accent2, align: "center" });
  y += lineH(44) + 40;
  const hl = b.lines(box.x + pad, y, head.lines, { size: head.size, color: pal.ink });
  if (d.url) b.text(box.x + pad, hl.bottom + 10, domainOf(d.url), { size: 40, color: pal.muted });
  return p.doc();
}

/** outro: the CTA hand-written, the handle circled, a rough arrow to the follow button. */
export function skOutro(ctx: BlockCtx<{ cta?: string; handle?: string; sub?: string }>): SketchDoc {
  const p = new Pager(ctx);
  const { box } = ctx;
  const pal = p.pal;
  const d = ctx.data ?? {};
  const b = p.b;
  const cx = box.x + box.w / 2;
  const ctaText = d.cta ?? ctx.skin.outro?.cta ?? "Follow for more";
  const cta = fit(ctaText, box.w - 60, 104, 64, 2);
  const head = ctx.headline && ctx.headline !== ctaText ? fit(ctx.headline, box.w - 60, SK.sub, SK.small, 2) : null;
  const sub = d.sub ? fit(d.sub, box.w - 80, SK.body, SK.small, 1) : null;
  const total = (head ? head.lines.length * lineH(head.size) + 50 : 0) + cta.lines.length * lineH(cta.size) + (d.handle ? 40 + lineH(66) + 30 : 0) + (sub ? sub.lines.length * lineH(sub.size) + 30 : 0) + 260;
  let y = box.y + Math.max(0, (box.h - total) * 0.35);
  if (head) y = b.lines(cx, y, head.lines, { size: head.size, color: pal.muted, align: "center" }).bottom + 50;
  y = b.lines(cx, y, cta.lines, { size: cta.size, color: pal.accent, align: "center" }).bottom;
  if (d.handle) {
    y += 40;
    const hw = measureText(d.handle, 66);
    b.text(cx, y, d.handle, { size: 66, color: pal.ink, align: "center" });
    b.ellipse(cx - hw / 2 - 40, y - 18, hw + 80, lineH(66) + 36, { stroke: pal.accent2, strokeWidth: SK.thin, roughness: 1.4 });
    y += lineH(66) + 30;
  }
  if (sub) y = b.lines(cx, y, sub.lines, { size: sub.size, color: pal.muted, align: "center" }).bottom + 30;
  // Curved arrow towards the platform follow button (bottom right of the safe box).
  const ax = Math.min(box.x + box.w - 30, cx + 300), ay = Math.min(box.y + box.h - 10, y + 230);
  b.arrow([[cx - 60, y + 40], [cx + 140, y + 200], [ax, ay]], { stroke: pal.accent2, strokeWidth: 5, curved: true, roughness: 1.3 });
  return p.doc();
}

export { withUnit };
