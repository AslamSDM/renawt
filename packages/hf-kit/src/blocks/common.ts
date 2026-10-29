import type { BlockCtx } from "./types";
import { esc } from "../util";

/** Optional scene title at the top of the content box (fitted: shrink → wrap ≤ maxLines → ellipsis). Returns markup + its height. */
export function titleHtml(ctx: BlockCtx, text: string | undefined, o: { size?: number; maxLines?: number } = {}): { html: string; h: number; size: number } {
  if (!text) return { html: "", h: 0, size: 0 };
  const f = fitLines(text, { maxWidth: ctx.box.w, maxLines: o.maxLines ?? 2, base: o.size ?? ctx.type.m, min: ctx.type.s - 8, weight: 800 });
  const h = Math.round(f.lines.length * f.size * 1.08 + 36);
  return {
    html: `<div id="${ctx.sid}-title" class="${ctx.sid}-display ${ctx.sid}-title" style="font-size:${f.size}px">${f.lines.map((l) => `<span class="${ctx.sid}-tl" style="display:block;white-space:nowrap">${esc(l)}</span>`).join("")}</div>`,
    h,
    size: f.size,
  };
}

export function titleCss(ctx: BlockCtx): string {
  const { sid, box } = ctx;
  return `#${sid}-title { position: absolute; left: ${box.x}px; top: ${box.y}px; width: ${box.w}px; text-align: center; }`;
}

/** Accent colours for series / sides. */
export function seriesColor(ctx: BlockCtx, i: number, override?: string): string {
  if (override) return override;
  const p = ctx.skin.palette;
  return [p.accent, p.accent2 ?? "var(--muted)", "var(--muted)"][i] ?? "var(--muted)";
}

/** Money/percent-aware value formatting. */
export function withUnit(value: string, unit: string): string {
  if (!unit) return value;
  if (/^[$€£¥₹]$/.test(unit)) return `${unit}${value}`;
  if (unit === "%") return `${value}%`;
  return `${value} ${unit}`;
}

export function domainOf(url?: string): string {
  if (!url) return "";
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url.slice(0, 40); }
}

// ---------------------------------------------------------------------------------------------
// Text fitting for user text drawn inside a box (HTML blocks). Mirrors sketch/board.ts fitText +
// sketch/blocks/common.ts fit: shrink (base → min, step 2), then wrap (≤ maxLines), then cut the
// last line with an ellipsis. Lines are rendered one element each (white-space: nowrap +
// text-overflow: ellipsis as a CSS safety net), so the browser never re-wraps differently from the
// estimate and text can never spill out of its box. lint.ts uses the same estimator (estWidth).
// ---------------------------------------------------------------------------------------------

/** Advance widths in em for a proportional sans display face (Inter-like), per character class. */
function charEm(ch: string): number {
  if (ch === " ") return 0.27;
  if ("il.,:;'!|ı".includes(ch)) return 0.27;
  if ("jftrI()[]\"-/".includes(ch)) return 0.38;
  if ("mwMW@%".includes(ch)) return 0.86;
  if (/[0-9$€£]/.test(ch)) return 0.6;
  if (/[A-Z]/.test(ch)) return 0.68;
  if (/[a-z]/.test(ch)) return 0.57;
  if (/[⺀-鿿가-힯]/.test(ch)) return 1;
  return 0.62;
}

/** Estimated rendered width (px) of one line. `weight` ≥ 700 widens by 6%; mono uses 0.62 em per char. */
export function estWidth(text: string, size: number, o: { weight?: number; mono?: boolean } = {}): number {
  let em = 0;
  for (const ch of String(text ?? "")) em += o.mono ? 0.62 : charEm(ch);
  return em * size * ((o.weight ?? 400) >= 700 ? 1.06 : 1) * (o.mono ? 1 : 1.08);
}

export interface FitOpts { maxWidth: number; maxLines: number; base: number; min: number; weight?: number; mono?: boolean }
export interface Fitted { size: number; lines: string[]; truncated: boolean }

/** Greedy wrap at `size`; a word wider than the line is broken by characters. */
export function wrapEst(text: string, size: number, maxWidth: number, o: { weight?: number; mono?: boolean } = {}): string[] {
  const ws = String(text ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const out: string[] = [];
  let cur = "";
  const push = (w: string) => {
    // Break an over-long word into chunks that fit.
    while (estWidth(w, size, o) > maxWidth && w.length > 1) {
      let k = w.length - 1;
      while (k > 1 && estWidth(w.slice(0, k), size, o) > maxWidth) k--;
      out.push(w.slice(0, k));
      w = w.slice(k);
    }
    return w;
  };
  for (const w0 of ws) {
    const next = cur ? `${cur} ${w0}` : w0;
    if (estWidth(next, size, o) <= maxWidth) { cur = next; continue; }
    if (cur) out.push(cur);
    cur = push(w0);
  }
  if (cur) out.push(cur);
  return out;
}

/** Cut `line` so that `line…` fits `maxWidth`. */
export function ellipsize(line: string, size: number, maxWidth: number, o: { weight?: number; mono?: boolean } = {}): string {
  let s = line.trimEnd();
  if (estWidth(`${s}…`, size, o) <= maxWidth) return `${s}…`;
  while (s.length > 1 && estWidth(`${s}…`, size, o) > maxWidth) s = s.slice(0, -1).trimEnd();
  return `${s}…`;
}

/** Shrink, then wrap, then truncate: the result always fits maxWidth × maxLines at `size`. */
export function fitLines(text: string, o: FitOpts): Fitted {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return { size: o.base, lines: [], truncated: false };
  const wo = { weight: o.weight, mono: o.mono };
  for (let s = o.base; s >= o.min; s -= 2) {
    const ws = t.split(" ");
    // A single word wider than the line at this size: keep shrinking instead of breaking it.
    if (ws.some((w) => estWidth(w, s, wo) > o.maxWidth) && s - 2 >= o.min) continue;
    const lines = wrapEst(t, s, o.maxWidth, wo);
    if (lines.length <= o.maxLines && !ws.some((w) => estWidth(w, s, wo) > o.maxWidth)) return { size: s, lines, truncated: false };
  }
  const lines = wrapEst(t, o.min, o.maxWidth, wo);
  const broken = t.split(" ").some((w) => estWidth(w, o.min, wo) > o.maxWidth);
  if (lines.length <= o.maxLines) return { size: o.min, lines, truncated: broken };
  const kept = lines.slice(0, Math.max(1, o.maxLines));
  kept[kept.length - 1] = ellipsize(kept[kept.length - 1], o.min, o.maxWidth, wo);
  return { size: o.min, lines: kept, truncated: true };
}

/**
 * Fitted text as markup: one nowrap span per line inside `<span class=cls>`. When the fitter had to
 * cut the text, the wrapper carries data-fit="truncated" + the original text + the char budget, which
 * lint.ts turns into an error the repair loop can act on.
 */
export function fitHtml(sid: string, text: string, f: Fitted, o: { cls: string; id?: string; role: string; max?: number; style?: string }): string {
  const meta = f.truncated ? ` data-fit="truncated" data-fit-role="${esc(o.role)}" data-fit-text="${esc(text)}"${o.max ? ` data-fit-max="${o.max}"` : ""}` : "";
  return `<span${o.id ? ` id="${o.id}"` : ""} class="${o.cls} ${sid}-fit" style="font-size:${f.size}px${o.style ? `;${o.style}` : ""}"${meta}>${f.lines.map((l) => `<span class="${sid}-fl">${esc(l)}</span>`).join("")}</span>`;
}

/** CSS for fitHtml lines (include once per scene that uses it). */
export function fitCss(sid: string): string {
  return `.${sid}-fit { display: flex; flex-direction: column; min-width: 0; max-width: 100%; }
    .${sid}-fl { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; padding: 0.08em 0; margin: -0.08em 0; }`;
}
