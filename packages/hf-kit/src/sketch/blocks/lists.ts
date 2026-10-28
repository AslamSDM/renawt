import type { BlockCtx } from "../../blocks/types";
import type { SketchDoc } from "../doc";
import { Pager, SK, titleFit, cycleColors, fit, lineH, measureText, tick, underline } from "./common";

type Item = string | { text: string; sub?: string; icon?: string };

/** bullet-stack: optional title, then per item a rough checkbox, its line(s), and a tick. One at a time. */
export function skBullets(ctx: BlockCtx<{ items: Item[]; numbered?: boolean }>): SketchDoc {
  const p = new Pager(ctx);
  const { box } = ctx;
  const pal = p.pal;
  const items = ctx.data.items.map((it) => (typeof it === "string" ? { text: it } : it));
  const mark = 64, gapX = 34, tx = box.x + mark + gapX + 6;
  const tw = box.x + box.w - tx;
  const laid = items.map((it) => {
    const main = fit(it.text, tw, 62, SK.small, 2);
    const sub = it.sub ? fit(it.sub, tw, SK.small, SK.small, 1) : null;
    const h = main.lines.length * lineH(main.size) + (sub ? lineH(sub.size) : 0);
    return { it, main, sub, h, n: main.lines.length + (sub ? 1 : 0) };
  });
  const title = ctx.headline ? titleFit(ctx.headline, box.w - 20) : null;
  const gapY = 54;
  const listH = laid.reduce((a, l) => a + l.h + gapY, 0) - gapY;
  const titleH = title ? title.lines.length * lineH(title.size) + 70 : 0;
  // Vertically centre when everything fits on one page.
  p.y = box.y + Math.max(0, (box.h - titleH - listH) * 0.4);
  if (title) {
    const t = p.b.lines(box.x + box.w / 2, p.y, title.lines, { size: title.size, color: pal.ink, align: "center" });
    const lw = Math.min(box.w - 20, Math.max(...title.lines.map((l) => measureText(l, title.size))));
    underline(p.b, box.x + box.w / 2 - lw / 2, box.x + box.w / 2 + lw / 2, t.bottom + 6, pal.accent2, 5);
    p.y = t.bottom + 70;
    p.lines += title.lines.length;
  }
  laid.forEach((l, i) => {
    p.need(l.n, l.h);
    const b = p.b;
    const y = p.y;
    const color = cycleColors(pal)[i % 3];
    const my = y + (lineH(l.main.size) - mark) / 2;
    if (ctx.data.numbered) {
      b.ellipse(box.x, my - 4, mark + 8, mark + 8, { stroke: color, strokeWidth: SK.thin });
      b.text(box.x + (mark + 8) / 2, my + 6, String(i + 1), { size: 50, color, align: "center" });
    } else {
      b.box(box.x + 4, my, mark - 8, mark - 8, { stroke: color, strokeWidth: SK.thin, rounded: true });
    }
    const lines = b.lines(tx, y, l.main.lines, { size: l.main.size, color: pal.ink });
    if (l.sub) b.text(tx, lines.bottom, l.sub.lines[0], { size: l.sub.size, color: pal.muted });
    if (!ctx.data.numbered) tick(b, box.x + 4, my - 10, mark - 4, pal.green).customData = { pauseAfter: 0.12 };
    p.y = y + l.h + gapY;
    p.lines += l.n;
  });
  return p.doc();
}

/** numbered-card: the number written inside a rough circle, "/ total", the title, then the body. */
export function skNumbered(ctx: BlockCtx<{ n: number; total?: number; title?: string; body?: string }>): SketchDoc {
  const p = new Pager(ctx);
  const { box } = ctx;
  const pal = p.pal;
  const d = ctx.data;
  const b = p.b;
  const cx = box.x + box.w / 2;
  const title = fit(d.title ?? ctx.headline ?? "", box.w - 40, 88, 60, 3);
  const body = (d.body ?? ctx.body) ? fit(d.body ?? ctx.body ?? "", box.w - 60, SK.sub, SK.small, 3) : null;
  const circle = 230;
  const total = circle + 70 + title.lines.length * lineH(title.size) + 40 + (body ? body.lines.length * lineH(body.size) + 20 : 0);
  let y = box.y + Math.max(0, (box.h - total) * 0.4);
  const color = cycleColors(pal)[(d.n - 1) % 3];
  b.ellipse(cx - circle / 2, y, circle, circle, { stroke: color, strokeWidth: SK.stroke, roughness: 1.2 });
  // "N" and "/ total" are written as one line (shared unit key).
  const nUnit = { unit: `${ctx.sid}-num` };
  b.text(cx, y + circle / 2 - lineH(150) / 2, String(d.n), { size: 150, color, align: "center", meta: nUnit });
  if (d.total) b.text(cx + circle / 2 + 20, y + circle - lineH(50), `/ ${d.total}`, { size: 50, color: pal.muted, meta: nUnit });
  y += circle + 70;
  const t = b.lines(cx, y, title.lines, { size: title.size, color: pal.ink, align: "center" });
  const lw = Math.min(box.w - 40, measureText(title.lines[title.lines.length - 1] ?? "", title.size));
  underline(b, cx - lw / 2, cx + lw / 2, t.bottom + 4, color, 5);
  y = t.bottom + 40;
  if (body) b.lines(cx, y + 20, body.lines, { size: body.size, color: pal.muted, align: "center" });
  return p.doc();
}
