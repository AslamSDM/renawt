/**
 * Vision-driven brand analyser.
 *
 * Takes the hero screenshot of the target site and extracts a rich brand
 * contract — sampled palette (real hex), detected fonts, materiality,
 * layout signals, motion cues, hero composition. Replaces the text-only
 * brandAnalyser whenever a screenshot is available.
 */

import { chatWithGeminiFlashVision } from "./model";
import type { ProductData } from "../types";

export interface VisionBrand {
  palette: {
    primary: string;
    accent: string;
    background: string;
    foreground: string;
    surfaces: string[];
  };
  typography: {
    primaryFont: string;
    secondaryFont?: string;
    fontWeights: number[];
    characterStyle: string;
  };
  materiality: "matte" | "glossy" | "metallic" | "glass" | "paper" | "neon";
  mood: string;
  layoutSignals: string;
  motionCues: string;
  heroComposition: string;
  visualLanguage: string;
}

const VISION_BRAND_PROMPT = `You are a brand designer reverse-engineering a website's visual language so a video can be designed in EXACTLY the same style.

Analyse the screenshot and emit ONE JSON object — no prose, no fences:

{
  "palette": {
    "primary": "#hex   — the dominant brand color (text accents, CTAs)",
    "accent":  "#hex   — secondary highlight color",
    "background": "#hex — main page background",
    "foreground": "#hex — main text color",
    "surfaces":  ["#hex","#hex"] — card/panel/elevated-surface colors (2-4)
  },
  "typography": {
    "primaryFont":   "named font with fallbacks, e.g. 'SF Pro Display, Helvetica Neue, sans-serif'",
    "secondaryFont": "supporting font if different",
    "fontWeights":   [400, 600, 800],
    "characterStyle": "geometric / humanist / serif / display / monospace"
  },
  "materiality": "matte | glossy | metallic | glass | paper | neon — which best describes the surfaces in the screenshot",
  "mood": "3-6 words capturing the feeling: e.g. 'crisp, premium, restrained, technical'",
  "layoutSignals": "1-2 sentences on the layout — grid system, generous whitespace, card density, edge alignment, hierarchy",
  "motionCues": "1-2 sentences on motion vocabulary cues — does the design suggest cinematic camera moves, subtle parallax, kinetic type, snappy slides, gentle fades",
  "heroComposition": "1-2 sentences on the hero — product centred / asymmetric / full-bleed image / abstract gradient / 3D render / photographic lifestyle",
  "visualLanguage": "the ONE-LINE summary a designer can use as the brief: e.g. 'Cinematic 3D product hero on near-black background, micro-typography in large weights, glass surfaces, subtle parallax depth.'"
}

RULES
- Sample ACTUAL pixel colors from the screenshot. Do NOT use generic palettes (#0ea5e9 etc).
- Pick fonts you can name from glyph shapes. If unsure, say "system-ui display" not "Inter".
- materiality must be ONE of the 6 options. Pick what dominates the surfaces.
- Output ONLY the JSON.`;

export async function analyzeBrandFromScreenshot(
  screenshotUrl: string,
  productData?: Partial<ProductData>,
): Promise<VisionBrand | null> {
  const ctx = productData
    ? `Product context: ${productData.name || ""} — ${productData.description || ""}`
    : "";
  const prompt = ctx ? `${ctx}\n\n${VISION_BRAND_PROMPT}` : VISION_BRAND_PROMPT;

  try {
    const resp = await chatWithGeminiFlashVision(
      { type: "image", path: screenshotUrl },
      prompt,
      undefined,
      { temperature: 0.2, maxTokens: 1200 },
    );
    const text = resp.content || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      console.warn("[VisionBrand] No JSON in response");
      return null;
    }
    const parsed = JSON.parse(match[0]) as VisionBrand;
    return parsed;
  } catch (err) {
    console.warn(
      `[VisionBrand] Vision analysis failed: ${(err as Error).message}`,
    );
    return null;
  }
}
