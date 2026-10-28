import type { VisualSkin } from "@remawt/shared";
import { SKETCH_FONT, excalifontFaceCss } from "./sketch";

/**
 * Skin → design tokens for a 1080×1920 vertical canvas.
 *
 * Safe areas: TikTok / Reels / Shorts draw UI over the top ~220px (status, search, tabs)
 * and the bottom ~420px (caption, handle, buttons). All text stays inside
 * [SAFE.top, height - SAFE.bottom]. Block content lives in CONTENT, captions in CAPTION_BAND.
 */
export interface SafeArea { top: number; bottom: number; side: number }
export const SAFE: SafeArea = { top: 220, bottom: 420, side: 72 };

export interface Box { x: number; y: number; w: number; h: number }

/** Where blocks may place content (above the caption band). */
export function contentBox(width = 1080, height = 1920): Box {
  const top = Math.round(SAFE.top * (height / 1920));
  const bandTop = captionBand(width, height).y;
  return { x: SAFE.side, y: top, w: width - SAFE.side * 2, h: bandTop - 30 - top };
}

/** Caption band: just above the bottom UI zone. */
export function captionBand(width = 1080, height = 1920): Box {
  const bottom = height - Math.round(SAFE.bottom * (height / 1920));
  const h = 240;
  return { x: SAFE.side, y: bottom - h - 60, w: width - SAFE.side * 2, h };
}

/** Typographic scale for a 1080-wide canvas. Nothing readable under 28px. */
export interface TypeScale { hero: number; xl: number; l: number; m: number; s: number; body: number; small: number; label: number; caption: number }
export function typeScale(width = 1080): TypeScale {
  const k = width / 1080;
  const px = (n: number) => Math.round(n * k);
  return { hero: px(156), xl: px(124), l: px(96), m: px(72), s: px(56), body: px(44), small: px(36), label: px(30), caption: px(70) };
}

export interface MotionPreset {
  name: VisualSkin["motion"];
  dur: number;          // base entrance duration (s)
  ease: string;         // entrance ease
  exitEase: string;
  stagger: number;      // per-item stagger (s)
  dist: number;         // entrance travel in px
  transition: TransitionKind;
  tDur: number;         // between-scene transition duration (s)
}
export type TransitionKind = "push" | "dissolve" | "scale" | "blur" | "cut";

export const MOTION: Record<VisualSkin["motion"], MotionPreset> = {
  snappy: { name: "snappy", dur: 0.34, ease: "power4.out", exitEase: "power3.in", stagger: 0.05, dist: 70, transition: "push", tDur: 0.28 },
  smooth: { name: "smooth", dur: 0.7, ease: "power2.out", exitEase: "power2.in", stagger: 0.12, dist: 40, transition: "dissolve", tDur: 0.45 },
  editorial: { name: "editorial", dur: 0.55, ease: "expo.out", exitEase: "power2.in", stagger: 0.08, dist: 52, transition: "blur", tDur: 0.38 },
  playful: { name: "playful", dur: 0.6, ease: "back.out(1.7)", exitEase: "back.in(1.4)", stagger: 0.09, dist: 90, transition: "scale", tDur: 0.4 },
};

export function motionPreset(skin: VisualSkin): MotionPreset {
  return MOTION[skin.motion] ?? MOTION.editorial;
}

export function radius(skin: VisualSkin): { sm: number; md: number; lg: number; pill: number } {
  switch (skin.shapes) {
    case "pill": return { sm: 18, md: 36, lg: 56, pill: 999 };
    case "rounded": return { sm: 12, md: 24, lg: 36, pill: 999 };
    default: return { sm: 2, md: 4, lg: 6, pill: 6 };
  }
}

/** Fonts bundled with the HyperFrames compiler: resolve by name, embedded at render. */
export const BUNDLED_FONTS = new Set([
  "Inter", "Montserrat", "Outfit", "Nunito", "Oswald", "League Gothic", "Archivo Black", "Space Mono", "IBM Plex Mono",
  "JetBrains Mono", "EB Garamond", "Playfair Display", "Source Code Pro", "Noto Sans JP", "Roboto", "Open Sans", "Lato", "Poppins",
]);

/** Weight axes known to exist on Google Fonts; unknown families request the default (400). */
const GF_WEIGHTS: Record<string, string> = {
  Inter: "wght@400;600;700;800;900",
  "EB Garamond": "wght@400;500;600;700;800",
  "Space Grotesk": "wght@400;500;600;700",
  "JetBrains Mono": "wght@400;500;700;800",
  Fraunces: "wght@400;600;700;900",
  "Patrick Hand": "",
  Montserrat: "wght@400;600;700;800;900",
  Poppins: "wght@400;600;700;800;900",
  "Playfair Display": "wght@400;600;700;800;900",
  "Space Mono": "wght@400;700",
  "IBM Plex Mono": "wght@400;500;700",
  Oswald: "wght@400;500;600;700",
  Outfit: "wght@400;600;700;800;900",
};

export function fontFamilies(skin: VisualSkin): string[] {
  return [...new Set([skin.type.display, skin.type.body, skin.type.mono ?? "JetBrains Mono"])];
}

/** Families fetched from Google Fonts (embedded faces such as Excalifont are not). */
function googleFamilies(skin: VisualSkin): string[] {
  return fontFamilies(skin).filter((f) => f !== SKETCH_FONT);
}

/** Google Fonts stylesheet URL for the skin's display/body/mono families. */
export function googleFontsUrl(skin: VisualSkin): string {
  const fams = googleFamilies(skin).map((f) => {
    const w = GF_WEIGHTS[f];
    const name = f.trim().replace(/\s+/g, "+");
    return `family=${name}${w ? `:${w}` : ""}`;
  });
  return `https://fonts.googleapis.com/css2?${fams.join("&")}&display=block`;
}

export function fontLinks(skin: VisualSkin): string {
  const embedded = fontFamilies(skin).includes(SKETCH_FONT) ? [`<style>${excalifontFaceCss()}</style>`] : [];
  return [
    ...embedded,
    `<link rel="preconnect" href="https://fonts.googleapis.com">`,
    `<link rel="preconnect" href="https://fonts.gstatic.com">`,
    `<link rel="stylesheet" href="${googleFontsUrl(skin).replace(/&/g, "&amp;")}">`,
  ].join("\n    ");
}

function stack(f: string, generic: string): string {
  if (f === SKETCH_FONT) return `"${f}", cursive`;
  return `"${f}", ${generic}`;
}

/** Is a colour dark? (for picking contrast ink on accent fills) */
export function isDark(hex: string): boolean {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0");
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140;
}

/** CSS custom properties for the skin, scoped to a selector (a scene's `#root`). */
export function skinVars(skin: VisualSkin, width = 1080, height = 1920): Record<string, string> {
  const t = typeScale(width);
  const rad = radius(skin);
  const p = skin.palette;
  const mono = skin.type.mono ?? "JetBrains Mono";
  return {
    "--bg": p.bg,
    "--surface": p.surface,
    "--ink": p.ink,
    "--accent": p.accent,
    "--accent2": p.accent2 ?? p.accent,
    "--on-accent": isDark(p.accent) ? "#ffffff" : "#0a0a0a",
    "--muted": `color-mix(in srgb, ${p.ink} 58%, ${p.bg})`,
    "--line": `color-mix(in srgb, ${p.ink} 16%, ${p.bg})`,
    "--font-display": stack(skin.type.display, "sans-serif"),
    "--font-body": stack(skin.type.body, "sans-serif"),
    "--font-mono": stack(mono, "monospace"),
    "--r-sm": `${rad.sm}px`,
    "--r-md": `${rad.md}px`,
    "--r-lg": `${rad.lg}px`,
    "--r-pill": `${rad.pill}px`,
    "--fs-hero": `${t.hero}px`,
    "--fs-xl": `${t.xl}px`,
    "--fs-l": `${t.l}px`,
    "--fs-m": `${t.m}px`,
    "--fs-s": `${t.s}px`,
    "--fs-body": `${t.body}px`,
    "--fs-small": `${t.small}px`,
    "--fs-label": `${t.label}px`,
    "--safe-top": `${SAFE.top}px`,
    "--safe-bottom": `${SAFE.bottom}px`,
    "--side": `${SAFE.side}px`,
    "--w": `${width}px`,
    "--h": `${height}px`,
  };
}

export function varsCss(vars: Record<string, string>): string {
  return Object.entries(vars).map(([k, v]) => `${k}: ${v};`).join(" ");
}

/** Deterministic film-grain texture (SVG turbulence, fixed seed) as a CSS background. */
export function grainBackground(seed = 7): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='${seed}' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`;
  return `url("data:image/svg+xml;utf8,${svg.replace(/"/g, "'").replace(/</g, "%3C").replace(/>/g, "%3E")}")`;
}

/**
 * Base CSS every scene gets (scoped under the scene id prefix).
 * The scene root (#root) carries only layout + tokens: NO background on the root.
 */
export function sceneBaseCss(sid: string, skin: VisualSkin, width = 1080, height = 1920): string {
  // Embedded faces are declared in every composition (hyperframes lint checks @font-face per file).
  const faces = fontFamilies(skin).includes(SKETCH_FONT) ? `\n    ${excalifontFaceCss()}` : "";
  return `${faces}
    #root { position: absolute; inset: 0; overflow: hidden; ${varsCss(skinVars(skin, width, height))} color: var(--ink); font-family: var(--font-body); }
    #${sid}-bg { position: absolute; inset: 0; background: var(--bg); }
    #${sid}-stage { position: absolute; inset: 0; }
    .${sid}-display { font-family: var(--font-display); font-weight: 800; letter-spacing: -0.02em; line-height: 1.02; }
    .${sid}-mono { font-family: var(--font-mono); letter-spacing: 0.04em; text-transform: uppercase; }
    .${sid}-kicker { font-family: var(--font-mono); font-size: var(--fs-label); letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
    .${sid}-muted { color: var(--muted); }
    .${sid}-card { background: var(--surface); border-radius: var(--r-lg); border: 2px solid var(--line); }
    .${sid}-ib { display: inline-block; }
  `;
}

/** Mix two hex colours: t=0 → a, t=1 → b. Concrete values for colour tweens (GSAP can't tween var()). */
export function mixHex(a: string, b: string, t: number): string {
  const p = (h: string) => {
    const s = h.replace("#", "");
    const n = s.length === 3 ? s.split("").map((c) => c + c).join("") : s.padEnd(6, "0");
    return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  };
  const A = p(a), B = p(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
