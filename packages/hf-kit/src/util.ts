import { createHash } from "node:crypto";

/** HTML-escape text content and attribute values. */
export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** JSON literal safe to drop inside an inline <script>. */
export function js(v: unknown): string {
  return JSON.stringify(v).replace(/</g, "\\u003c");
}

/** Seconds with 3 decimals, as a string attribute value. */
export function sec(ms: number): string {
  return r3(ms / 1000).toString();
}

export function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Turn any scene id into a safe composition id: lowercase, [a-z0-9-], starts with a letter. */
export function safeId(raw: string, fallback: string): string {
  let s = String(raw || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!s) s = fallback;
  if (!/^[a-z]/.test(s)) s = `s-${s}`;
  return s.slice(0, 40);
}

export function hash(s: string, len = 10): string {
  return createHash("sha256").update(s).digest("hex").slice(0, len);
}

/** Split a headline into words, keeping punctuation attached. */
export function words(s: string): string[] {
  return String(s || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
}

/** Exact, deterministic number formatting (en-US grouping). */
export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Compact number for axis ticks: 1.2K, 3.4M. */
export function compactNumber(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e12) return `${r1(v / 1e12)}T`;
  if (a >= 1e9) return `${r1(v / 1e9)}B`;
  if (a >= 1e6) return `${r1(v / 1e6)}M`;
  if (a >= 1e4) return `${r1(v / 1e3)}K`;
  if (Number.isInteger(v)) return String(v);
  return String(Math.round(v * 100) / 100);
}

/** Nice axis ticks between min and max (3–6 ticks). */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) max = min + 1;
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v / step) * step);
  return out;
}

/** Rough text width estimate in px for a font size (Latin, proportional). */
export function textWidth(text: string, fontSize: number, factor = 0.56): number {
  return text.length * fontSize * factor;
}

/** Largest font size (step 2) at which `text` fits `maxWidth` across at most `maxLines` lines. */
export function fitFontSize(text: string, opts: { maxWidth: number; maxLines?: number; base: number; min: number; factor?: number }): number {
  const lines = opts.maxLines ?? 1;
  const ws = words(text);
  for (let size = opts.base; size > opts.min; size -= 2) {
    if (layoutLines(ws, opts.maxWidth, size, opts.factor) <= lines) return size;
  }
  return opts.min;
}

function layoutLines(ws: string[], maxWidth: number, size: number, factor?: number): number {
  let lines = 1;
  let cur = 0;
  const space = size * 0.28;
  for (const w of ws) {
    const ww = textWidth(w, size, factor);
    if (ww > maxWidth) return Infinity;
    if (cur === 0) cur = ww;
    else if (cur + space + ww <= maxWidth) cur += space + ww;
    else { lines++; cur = ww; }
  }
  return lines;
}
