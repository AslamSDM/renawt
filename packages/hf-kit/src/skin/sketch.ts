import { readFileSync } from "node:fs";
import type { VisualSkin } from "@remawt/shared";

/**
 * Sketch ("hand-drawn", Excalidraw-style) skin support: the semantic palette blocks draw with,
 * and the embedded Excalifont face (OFL-1.1, Latin subset, see assets/fonts/OFL.txt).
 */
export const SKETCH_FONT = "Excalifont";

export interface SketchPalette {
  bg: string;
  ink: string;
  muted: string;
  panel: string;
  accent: string;
  accent2: string;
  blue: string;
  teal: string;
  green: string;
  yellow: string;
  gold: string;
  red: string;
  purple: string;
  /** Translucent marker colour for highlights. */
  marker: string;
}

/** 3Blue1Brown palette on #1F2126 (contentgen/yt tools/theme.py). */
const DARK = { muted: "#8A8F98", panel: "#2A2D34", blue: "#58C4DD", teal: "#5CD0B3", green: "#83C167", yellow: "#F4D35E", gold: "#F0AC5F", red: "#FC6255", purple: "#B189C6", marker: "#F4D35E" };
/** Excalidraw's own light-theme stroke colours on paper. */
const LIGHT = { muted: "#6B6F76", panel: "#F1ECE1", blue: "#1971C2", teal: "#0C8599", green: "#2F9E44", yellow: "#F08C00", gold: "#E8590C", red: "#E03131", purple: "#6741D9", marker: "#FFD43B" };

function luma(hex: string): number {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0");
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function sketchPalette(skin: VisualSkin): SketchPalette {
  const p = skin.palette;
  const base = luma(p.bg) < 140 ? DARK : LIGHT;
  return { ...base, bg: p.bg, ink: p.ink, panel: p.surface || base.panel, accent: p.accent, accent2: p.accent2 ?? base.gold };
}

export function isHanddrawn(skin: VisualSkin | undefined): boolean {
  return !!(skin as (VisualSkin & { handdrawn?: boolean }) | undefined)?.handdrawn;
}

let fontUrl: string | null = null;
/** Excalifont (Latin subset, woff2) as a data: URL, so renders need no font file or network. */
export function excalifontDataUrl(): string {
  if (!fontUrl) {
    const buf = readFileSync(new URL("../../assets/fonts/Excalifont-latin.woff2", import.meta.url));
    fontUrl = `data:font/woff2;base64,${buf.toString("base64")}`;
  }
  return fontUrl;
}

/** `<style>` with the @font-face for Excalifont (goes in index.html <head>). */
export function excalifontFaceCss(): string {
  return `@font-face { font-family: "${SKETCH_FONT}"; src: url("${excalifontDataUrl()}") format("woff2"); font-weight: 100 900; font-style: normal; font-display: block; }`;
}
