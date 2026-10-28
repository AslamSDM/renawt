import type { BlockCtx } from "./types";
import { esc, fitFontSize } from "../util";

/** Optional scene title at the top of the content box. Returns markup + its height. */
export function titleHtml(ctx: BlockCtx, text: string | undefined, o: { size?: number; maxLines?: number } = {}): { html: string; h: number; size: number } {
  if (!text) return { html: "", h: 0, size: 0 };
  const size = fitFontSize(text, { maxWidth: ctx.box.w, maxLines: o.maxLines ?? 2, base: o.size ?? ctx.type.m, min: ctx.type.s - 8 });
  const lines = Math.min(o.maxLines ?? 2, Math.ceil((text.length * size * 0.56) / ctx.box.w) || 1);
  const h = Math.round(lines * size * 1.08 + 36);
  return {
    html: `<div id="${ctx.sid}-title" class="${ctx.sid}-display ${ctx.sid}-title" style="font-size:${size}px">${esc(text)}</div>`,
    h,
    size,
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
