import { createRequire } from "node:module";
import { ICONS } from "./icons.data";

const ALIASES: Record<string, string> = {
  "alert-triangle": "triangle-alert",
  "bar-chart-3": "chart-column",
  "bar-chart": "chart-column",
  "check-circle-2": "circle-check",
  "check-circle": "circle-check",
  home: "house",
  "line-chart": "chart-line",
  money: "banknote",
  dollar: "circle-dollar-sign",
  growth: "trending-up",
  fingerprint: "fingerprint-pattern",
};

let lucide: Record<string, Array<[string, Record<string, string>]>> | null | undefined;
function lucideNodes() {
  if (lucide !== undefined) return lucide;
  try {
    const req = createRequire(import.meta.url);
    lucide = req("lucide-static/icon-nodes.json");
  } catch {
    lucide = null;
  }
  return lucide;
}

/** Inner SVG markup for a lucide icon (24×24 viewBox). Falls back to a circle. */
export function iconInner(name: string | undefined): string {
  const n = String(name || "").trim().toLowerCase();
  const key = ALIASES[n] ?? n;
  if (ICONS[key]) return ICONS[key];
  if (ICONS[n]) return ICONS[n];
  const nodes = lucideNodes()?.[key];
  if (nodes) return nodes.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(" ")}/>`).join("");
  return `<circle cx="12" cy="12" r="9"/>`;
}

export function iconExists(name: string): boolean {
  const n = name.trim().toLowerCase();
  return !!(ICONS[ALIASES[n] ?? n] || lucideNodes()?.[ALIASES[n] ?? n]);
}

/** Full inline SVG for an icon (stroke = currentColor). */
export function iconSvg(name: string | undefined, size: number, opts: { id?: string; cls?: string; stroke?: number } = {}): string {
  return `<svg${opts.id ? ` id="${opts.id}"` : ""}${opts.cls ? ` class="${opts.cls}"` : ""} xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${opts.stroke ?? 2}" stroke-linecap="round" stroke-linejoin="round">${iconInner(name)}</svg>`;
}
