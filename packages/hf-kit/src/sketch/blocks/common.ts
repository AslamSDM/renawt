import type { BlockCtx } from "../../blocks/types";
import { sketchPalette, type SketchPalette } from "../../skin/sketch";
import { fitText, measureText, wrapText, LINE_HEIGHT, type Board, type ExEl, type TextOpts } from "../board";
import { MAX_LINES_PER_PAGE, MIN_BODY, newBoard, type SketchDoc } from "../doc";

/** Type sizes for hand-drawn text on a 1080-wide frame (body never under 44px). */
export const SK = { hero: 112, title: 76, sub: 60, body: 54, small: MIN_BODY, stroke: 4, thin: 3 };

/** Stroke colours used for series / nodes, in order. */
export function cycleColors(pal: SketchPalette): string[] {
  return [pal.accent, pal.accent2, pal.green, pal.purple, pal.teal, pal.red, pal.yellow];
}

/**
 * Page flow: places blocks of lines top-down and starts a new page (a fresh Board) when the page
 * would exceed MAX_LINES_PER_PAGE written lines or run past the bottom of the content box.
 */
export class Pager {
  readonly pages: Board[] = [];
  b!: Board;
  y = 0;
  lines = 0;
  readonly pal: SketchPalette;
  constructor(public ctx: BlockCtx<any>, public top = ctx.box.y, public bottom = ctx.box.y + ctx.box.h) {
    this.pal = sketchPalette(ctx.skin);
    this.newPage();
  }
  newPage(): void {
    this.b = newBoard(this.ctx, this.pages.length);
    this.pages.push(this.b);
    this.y = this.top;
    this.lines = 0;
  }
  /** Make room for `n` lines spanning `h` px; returns true when a new page was started. */
  need(n: number, h: number): boolean {
    if (this.lines > 0 && (this.lines + n > MAX_LINES_PER_PAGE || this.y + h > this.bottom)) { this.newPage(); return true; }
    return false;
  }
  doc(): SketchDoc { return { pages: this.pages }; }
}

/** Cut `line` so that `line…` fits `maxWidth` at `size`. */
export function ellipsizeSk(line: string, size: number, maxWidth: number): string {
  let s = line.trimEnd();
  if (measureText(s, size) <= maxWidth) return s;
  while (s.length > 1 && measureText(`${s}…`, size) > maxWidth) s = s.slice(0, -1).trimEnd();
  return `${s}…`;
}

/**
 * Wrapped lines of `text`, fitted between base..min to ≤ maxLines. If it still does not fit at
 * `min`, the last line is cut with an ellipsis (and any single word wider than the line is cut too):
 * a page never exceeds its line budget and no line is wider than maxWidth.
 */
export function fit(text: string, maxWidth: number, base: number, min: number, maxLines: number): { size: number; lines: string[]; truncated: boolean } {
  const r = fitText(text, { maxWidth, maxLines, base, min });
  const wide = r.lines.some((l) => measureText(l, r.size) > maxWidth);
  if (r.lines.length <= maxLines && !wide) return { ...r, truncated: false };
  const lines = r.lines.slice(0, Math.max(1, maxLines)).map((l) => ellipsizeSk(l, r.size, maxWidth));
  if (r.lines.length > maxLines) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = last.endsWith("…") ? last : ellipsizeSk(`${last}…`, r.size, maxWidth);
  }
  return { size: r.size, lines, truncated: true };
}

/** One line: the largest size in [min, base] at which it fits, else cut with an ellipsis at `min`. */
export function fitLine(text: string, maxWidth: number, base: number, min: number): { size: number; line: string; truncated: boolean } {
  const f = fit(text, maxWidth, base, min, 1);
  return { size: f.size, line: f.lines[0] ?? "", truncated: f.truncated };
}

/** Scene title: one line when it fits at ≥ 60px, else up to two lines. */
export function titleFit(text: string, maxWidth: number): { size: number; lines: string[] } {
  const one = fitText(text, { maxWidth, maxLines: 1, base: SK.title, min: 60 });
  if (one.lines.length === 1) return one;
  const two = fit(text, maxWidth, 68, 52, 2);
  return { size: two.size, lines: two.lines };
}

export function lineH(size: number): number {
  return size * LINE_HEIGHT;
}

/** Lines written one per unit, centred on cx (or left at x). Returns the elements and bottom y. */
export function writeLines(b: Board, x: number, y: number, lines: string[], o: TextOpts & { gap?: number }): { els: ExEl[]; bottom: number } {
  return b.lines(x, y, lines, o);
}

/**
 * Lines with accent words: each line is split into coloured segments (still one unit per line).
 */
export function writeEmphasis(b: Board, cx: number, y: number, lines: string[], o: TextOpts & { emphasis?: string[]; accent: string; gap?: number }): { els: ExEl[][]; bottom: number } {
  const size = o.size ?? 44;
  const step = lineH(size) + (o.gap ?? 0);
  const emph = (o.emphasis ?? []).map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}'%$]/gu, "")).filter(Boolean);
  const els = lines.map((line, i) => {
    const words = line.split(" ");
    const segs: Array<{ text: string; color?: string }> = [];
    words.forEach((w, k) => {
      const bare = w.toLowerCase().replace(/[^\p{L}\p{N}'%$]/gu, "");
      const hit = emph.includes(bare);
      const t = k < words.length - 1 ? `${w} ` : w;
      const color = hit ? o.accent : o.color;
      const prev = segs[segs.length - 1];
      if (prev && prev.color === color) prev.text += t;
      else segs.push({ text: t, color });
    });
    return b.segLine(cx, y + i * step, segs, o);
  });
  return { els, bottom: y + lines.length * step - (o.gap ?? 0) };
}

/** Wobbly hand-drawn underline (a marker swipe) under [x0, x1] at y. */
export function underline(b: Board, x0: number, x1: number, y: number, color: string, width = 5): ExEl {
  const w = x1 - x0;
  return b.line([[x0, y], [x0 + w * 0.35, y + 4], [x0 + w * 0.7, y - 2], [x1, y + 3]], { stroke: color, strokeWidth: width, curved: true, roughness: 1.4 });
}

/** A hand-drawn tick mark inside a w×w square at (x, y). */
export function tick(b: Board, x: number, y: number, w: number, color: string): ExEl {
  return b.line([[x + w * 0.12, y + w * 0.55], [x + w * 0.4, y + w * 0.85], [x + w * 0.92, y + w * 0.12]], { stroke: color, strokeWidth: SK.stroke + 1, roughness: 1.2 });
}

export { measureText, wrapText };
