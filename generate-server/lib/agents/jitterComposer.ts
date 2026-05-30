/**
 * JITTER COMPOSER AGENT
 *
 * LLM-driven generator that emits a Jitter-style video JSON
 * (primitives + operations timeline + optional custom React components)
 * given a brief. Output validated against JitterDocSchema.
 *
 * Render: feed result as defaultProps into <Composition id="JitterComposition" />.
 */

import { z } from "zod";
import { jsonrepair } from "jsonrepair";
import {
  chatWithGeminiPro,
  chatWithGeminiProVision,
  chatWithCloudflareAI,
  CODE_GENERATOR_CONFIG,
  type ChatMessage,
} from "./model";
import {
  JitterDocSchema,
  type JitterDoc,
  artboardDurationFrames,
} from "../video/jitterJson";
import {
  beatGridForBpm,
  describeBeatGrid,
  snapDocToBeats,
} from "../video/beatSnap";

const AVAILABLE_FONTS = [
  "Inter",
  "Space Grotesk",
  "Manrope",
  "Geist",
  "Sora",
  "Outfit",
  "DM Sans",
  "Poppins",
  "Playfair Display",
  "Bebas Neue",
  "Montserrat",
];

/** Mirror of remotion/jitter/builtins.tsx — keep in sync. */
const BUILTIN_NAMES = new Set([
  "BrowserMockup",
  "MacMockup",
  "PhoneMockup",
  "CursorClick",
  "Typewriter",
  "GradientText",
  "GlassCard",
  "GlowHalo",
  "AnimatedGradient",
  "BlurredBlob",
  "MotionLines",
  "FloatingDots",
  "CodeBlock",
  "NumberCounter",
  "ProgressBar",
  "BeatInvert",
  "BeatColorSwap",
  "BeatTextSwap",
  "DotGrid",
  "LineGrid",
  "MeshGradient",
  "NoiseField",
  "AbstractBackdrop",
  "TemplateBackdrop",
  "ScreenshotShowcase",
]);

const BUILTIN_CATALOG = `BUILT-IN COMPONENT CATALOG — reference these by name via \`{ "type": "custom", "component": "<Name>", "props": { ... } }\`. DO NOT define their source in customComponents[] — they are pre-built and styled. Use customComponents[] ONLY for shapes not covered here.

MOCKUPS (always pass a full-bleed image via props.screenshot when you have one):
- BrowserMockup        — props: { url: string, screenshot?: string, theme?: "dark"|"light", contentColor?: string, cornerRadius?: number }
- MacMockup            — props: { screenshot?: string, bezelColor?: string, screenColor?: string }   (16:10 laptop frame with hinge)
- PhoneMockup          — props: { screenshot?: string, bezelColor?: string, screenColor?: string }   (9:19.5 phone frame with notch)

CURSOR / DEMO:
- CursorClick          — props: { fromX, fromY, toX, toY, clickAt?: 0..1 (default 0.7), color?: string, size?: number } — animated cursor traveling and clicking inside its layer box (coords in %).
- ScreenshotShowcase   — props: { screenshots: [url, url?, url?], bezelColor?: hex, cornerRadius?: 18, tilt?: 6, stagger?: 14 }
   Staged web-screen reveal (style of jitter showreel "Animated web screens"). Use INSTEAD of a raw image layer whenever you have product screenshots — never drop a plain Image layer for a screenshot. 1-3 screens stagger in tilted/stacked. Place at 70-80% of artboard width, centered.

TEXT EFFECTS:
- Typewriter           — props: { text: string, cps?: 22, cursor?: true, cursorColor?, fontFamily?, fontSize?: 56, fontWeight?: 600, color?, textAlign?: "left"|"center"|"right" }
- GradientText         — props: { text: string, from: hex, to: hex, angle?: 135, fontFamily?, fontSize?: 120, fontWeight?: 800, textAlign?: "center", letterSpacing?: -2, lineHeight?: 1.0 }

SURFACES / FX:
- GlassCard            — props: { fillColor?: rgba, borderColor?: rgba, cornerRadius?: 24, blur?: 24 }   (backdrop-blur card; place CONTENT in a sibling layer above it, not inside)
- GlowHalo             — props: { color: hex, intensity?: 0.55, size?: 1.1 }   (radial glow behind hero)
- AnimatedGradient     — props: { colors: [hex,hex,hex], angle?: 135, speed?: 1 }   (drifting bg gradient — use as full-bleed scene background)
- BlurredBlob          — props: { color: hex, size?: 1.0, opacity?: 0.5, driftX?: 80, driftY?: 60 }   (drifting blurred color blob)

LINES & PARTICLES:
- MotionLines          — props: { color: hex, strokeWidth?: 2, orientation?: "horizontal"|"vertical" }   (line draws on in ~0.6s)
- FloatingDots         — props: { count?: 18, color?: rgba, size?: 5 }   (subtle particle layer)

DATA:
- CodeBlock            — props: { code: string, typewriter?: true, cps?: 28, background?: "#0a0a0a", color?, accent?, fontSize?: 22, cornerRadius?: 14, padding?: 24 }
- NumberCounter        — props: { from: 0, to: 100, prefix?: "", suffix?: "", decimals?: 0, duration?: 1500ms, fontFamily?, fontSize?: 140, fontWeight?: 800, color?, textAlign?: "center" }
- ProgressBar          — props: { to: 100, duration?: 1500ms, trackColor?, fillColor?, height?: 14, cornerRadius?: 999 }

BEAT HITS — use ONE method per scene, sparingly. These are SUSTAINED color holds, not strobes.
- BeatInvert     — full-bleed TOP-most layer. Fades in a difference-blend plane on each listed beat, holds for ~1 beat, fades out. Inverts everything beneath. Props: { bpm, beats: [8, 24], holdBeats?: 1, fadeBeats?: 0.25, color?: "#fff" }
- BeatColorSwap  — scene BACKGROUND that crossfades between two colors when a listed beat hits and HOLDS the new color until the next listed beat. Smooth, no stutter. Props: { bpm, beats: [8, 16, 24], fromColor, toColor, fadeBeats?: 0.5, minHoldBeats?: 4 }
- BeatTextSwap   — TEXT layer that mirrors BeatColorSwap's flips on the SAME beats so the contrast stays right when bg flips. Use INSTEAD of a normal text layer. Props: { bpm, beats, text, fromColor, toColor, fadeBeats?, minHoldBeats?, fontFamily, fontSize, fontWeight, textAlign }

ABSTRACT BACKGROUNDS (use one as the FIRST full-bleed layer when the brief does NOT auto-inject a backdrop):
- TemplateBackdrop   — props: { palette: [hex,hex,hex,hex,hex], variant: "blobs"|"mesh"|"grid"|"dots"|"lines", intensity?: 0.6, showGrid?: true, gridColor?: "rgba(255,255,255,0.06)" }
   Recolored backdrop driven by scraped jitter.video bg templates. Prefer this for any non-flat background.
- DotGrid            — props: { color?: rgba, background?: hex, spacing?: 28, dotSize?: 2, drift?: true }
- LineGrid           — props: { color?: rgba, background?: hex, spacing?: 80, lineWidth?: 1, perspective?: false }
- MeshGradient       — props: { colors: [hex,hex,hex,hex], speed?: 1, blur?: 80 }
- NoiseField         — props: { color?: rgba, background?: hex, density?: 200, size?: 1.2 }
- AbstractBackdrop   — props: { baseColor?: hex, blobs?: [hex,hex,hex], showGrid?: true, gridColor?: rgba, noise?: true }

USAGE PATTERNS:
- NEVER ship a plain white or plain black background. EVERY scene needs visual texture — TemplateBackdrop, MeshGradient, DotGrid, LineGrid, AbstractBackdrop, or AnimatedGradient as the first full-bleed layer.
- Place AnimatedGradient / BlurredBlob / BeatColorSwap / SolidBg-like rect as the FIRST layer of a scene (full-bleed 1920x1080).
- Put GlowHalo behind a hero mockup (slightly larger box, same center).
- For dashboards: BrowserMockup with the page screenshot in scene 1; PhoneMockup with a focused crop in scene 2.
- For typing demos: combine Typewriter (in a flat box) with a CursorClick on a button at the right moment.
- For numbers: NumberCounter + ProgressBar in a feature scene to dramatize a stat.
- Builtins still respect parent-layer Jitter operations for entry/exit — REMEMBER EVERY non-background layer needs an entry op AND an exit op.
- BEAT HITS go as the LAST (top-most) full-bleed layer in their scene, so they invert / flash everything beneath. Compute beats[] from the ARTBOARD START (not the video start).`;

export interface JitterBrief {
  /** Free-form goal of the video (product blurb, scene description, etc.) */
  brief: string;
  /** Target render size — defaults to 1920x1080. */
  width?: number;
  height?: number;
  /** Target duration in milliseconds (across all artboards). */
  durationMs?: number;
  /** Optional brand colors / fonts to bias the output. */
  brand?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    textColor?: string;
    fontFamily?: string;
  };
  /** Verbatim page copy (headlines, features, CTA) to use without paraphrasing. */
  copy?: {
    productName?: string;
    tagline?: string;
    headlines?: string[];
    features?: Array<{ title: string; description?: string }>;
    cta?: string;
    price?: string;
  };
  /** Hero image URL/path to embed in scene 1 (Remotion /public path or remote URL). */
  heroImage?: string | null;
  /** Stock images available to drop in as image layers. Each entry may be a
   *  bare URL or a `{url, topic}` pair — the topic helps the composer pick a
   *  photo that matches the scene's content rather than dropping one at random. */
  stockImages?: Array<string | { url: string; topic?: string }>;
  /** User-uploaded named assets (logos, photos, screen recordings) that the user
   *  may reference by alias in `brief`. Drop the matching URL as an image layer
   *  when the brief mentions the alias (or "logo"/"my product" if obvious). */
  userAssets?: Array<{
    url: string;
    alias: string;
    kind: "image" | "video";
    name?: string;
    description?: string;
  }>;
  /** Optional background music. */
  audio?: { url: string; bpm?: number; volume?: number } | null;
  /** Optional voice-over narration (already synthesized). */
  narration?: {
    url: string;
    volume?: number;
    startMs?: number;
    durationMs?: number;
  } | null;
  /** Allow LLM to author custom React components. Default true. */
  allowCustomComponents?: boolean;
  /** Auto-injected backdrop (one of the 26 scraped jitter.video bg templates),
   *  recolored to brand. Renderer puts this as the first layer of every artboard
   *  via the TemplateBackdrop builtin. Composer is told to skip designing its own
   *  background — keep scene bg invisible. */
  backdrop?: {
    templateId: string;
    templateName: string;
    variant: "blobs" | "mesh" | "grid" | "dots" | "lines";
    palette: string[];
    intensity: number;
  } | null;
  /** Optional inspiration templates harvested from jitter.video. Surfaced
   *  to the model as compact summaries (id, name, palette, layer/op counts)
   *  so it can imitate proven layouts without copying them verbatim. */
  templateInspirations?: Array<{
    id: string;
    name: string;
    sections?: string[];
    palette?: string[];
    artboardCount?: number;
    layerCount?: number;
    opCount?: number;
    totalDurationMs?: number;
  }>;
}

const SYSTEM_PROMPT = `You are a motion-graphics composer. You design short videos as Jitter-style documents: primitive layers placed in absolute coordinates, animated by an OPERATIONS timeline that targets layers by id.

OUTPUT a SINGLE JSON object matching this shape (no markdown, no commentary, no \`\`\` fences):

{
  "name": "Short title",
  "fps": 30,
  "audio": null,                  // or { "url": "...", "bpm": 120, "volume": 1 }
  "customComponents": [],         // optional — see "CUSTOM COMPONENTS"
  "conf": {
    "id": "root",
    "version": 4,
    "artboards": [
      {
        "id": "art1",
        "name": "Scene 1",
        "width": 1920,
        "height": 1080,
        "duration": 4000,         // milliseconds
        "fillColor": "#0b1020",
        "background": true,
        "operations": [ ... ],
        "layers": [ ... ]
      }
    ]
  }
}

LAYER TYPES — every layer needs a unique \`id\` (string):

1) text:
   { "type": "text", "id": "t1", "x": 100, "y": 100, "width": 800, "height": 80,
     "text": "Hello", "color": "#fff", "fontSize": 48,
     "font": { "name": "Inter", "weight": 700 },
     "textAlign": "left|center|right", "verticalAlign": "top|center|bottom" }

2) image:
   { "type": "image", "id": "i1", "x": 0, "y": 0, "width": 200, "height": 200,
     "url": "https://... or data:image/svg+xml;..." }

3) rect (solid rectangle, optionally with corner radius / shadow):
   { "type": "rect", "id": "r1", "x": 0, "y": 0, "width": 100, "height": 100,
     "fillColor": "#ffffff", "cornerRadius": 12,
     "shadowEnabled": true, "shadowOffsetY": 8, "shadowBlur": 20,
     "shadowColor": "#000", "shadowOpacity": 30 }

4) layerGrp (container — supports background + clipping):
   { "type": "layerGrp", "id": "g1", "x": 200, "y": 200, "width": 600, "height": 200,
     "background": true, "fillColor": "#fff", "cornerRadius": 40,
     "clipsContent": false, "layers": [ ...nested layers... ] }

5) custom (renders a React component you authored in customComponents[]):
   { "type": "custom", "id": "c1", "x": 0, "y": 0, "width": 1920, "height": 1080,
     "component": "MyComponent", "props": { "anyJson": "ok" } }

OPERATION TYPES — all times in MILLISECONDS, targetId references a layer id:

- growIn:   { "type": "growIn",   "targetId": "g1", "scale": 0.5, "startTime": 0,    "endTime": 400,  "easing": "slowDown" }
- shrinkOut:{ "type": "shrinkOut","targetId": "g1", "scale": 0.8, "startTime": 3200, "endTime": 3500, "easing": "accelerate" }
- resize:   { "type": "resize",   "targetId": "g1", "anchor": "center", "fromValue": { "width": 80 }, "startTime": 400, "endTime": 1100, "easing": "natural" }
- fadeIn:   { "type": "fadeIn",   "targetId": "t1", "startTime": 800, "endTime": 1100, "easing": "natural" }
- fadeOut:  { "type": "fadeOut",  "targetId": "t1", "startTime": 3000, "endTime": 3300 }
- slideIn:  { "type": "slideIn",  "targetId": "i1", "direction": "up|down|left|right", "distance": 40, "startTime": 200, "endTime": 600 }
- slideOut: { "type": "slideOut", "targetId": "i1", "direction": "up|down|left|right", "distance": 60, "startTime": 3200, "endTime": 3600, "easing": "accelerate" }
- pulse:    { "type": "pulse",    "targetId": "i1", "scaleAmount": 0.05, "intervalMs": 484, "startTime": 800, "endTime": 3200 }     (rhythmic beat pulse — set intervalMs = beatMs)
- textIn:   { "type": "textIn",   "targetId": "t1", "effect": "appear|slide|fade", "split": "letters|words|none",
              "order": "forward|reverse", "offset": 50, "nodeDuration": 500, "nodeEasing": "slowDown",
              "travelDistance": 20, "slideDirection": "up", "startTime": 900 }

Each operation MUST include a unique \`id\` string.

EASINGS: "none" | "slowDown" (ease-out) | "natural" (ease-in-out, default) | "accelerate" (ease-in).

COORDINATE SYSTEM:
- Top-left origin. x/y/width/height in artboard pixels (numbers, not strings).
- Nested layers in a layerGrp are RELATIVE to the group's top-left.

COMPONENTS — there are TWO sources:
A) BUILT-IN COMPONENTS — a curated, pre-built React library. Reference with \`{ "type": "custom", "component": "<Name>", "props": { ... } }\`. DO NOT redefine these in customComponents[]. The full catalog with props is included in the user message below. PREFER builtins over hand-rolled customComponents.
B) AI-AUTHORED customComponents[] — only when a shape is not covered by builtins. Each entry is \`{ "name": "PascalName", "source": "function PascalName(props) { ... }" }\`. Authoring rules below.

NARRATIVE & DURATION:
- Split videos longer than 6 seconds into 2-5 ARTBOARDS that tell a story (hook → feature → feature → CTA).
- Each artboard is ONE scene with its own background and own intro/outro animations.
- The SUM of artboard \`duration\` values MUST equal the requested total duration in ms (±200ms tolerance).
- End each artboard with a graceful exit (shrinkOut / fadeOut / slideIn-out) starting ~400-700ms before its \`duration\`.

DESIGN LANGUAGE — match the brand provided:
- LOCK to brand.primary / brand.secondary / brand.accent / brand.background EXACTLY. Do not invent off-brand colors.
- Use brand.fontFamily (otherwise "Inter") for all text. Bold display weights (700-900) for headlines, generous tracking on caps, tight line-height (95-110%).
- Generous whitespace: keep at least 10% padding around the frame.
- Use the page copy verbatim where provided. Do not paraphrase product names, headlines, or features.

TEXT SIZING — strict rules (the previous output had random sizes, fix this):
- For a 1920x1080 artboard:
   * Hero headline (max 6 words): fontSize=128, weight 800, ONE text layer only.
   * Subheadline / section title (max 8 words): fontSize=64, weight 700.
   * Body / feature title (max 12 words): fontSize=44, weight 600.
   * Caption / label (max 20 chars): fontSize=28, weight 500.
   * Stat number (NumberCounter): fontSize=180, weight 800.
- For other artboard sizes, scale fontSize linearly with min(width, height) / 1080.
- text layer.width MUST be ≥ (chars * fontSize * 0.62) so the text fits on one or two lines. Set lineHeight 1.15 and ALWAYS set height = ceil(fontSize * lineHeight * expectedLines) + 16.
- NEVER use the same fontSize for two different roles in the same scene. ONE headline size, ONE body size — that's it.
- Hero image / screenshot: ALWAYS via ScreenshotShowcase (custom layer) — never a raw image layer for product screenshots. Box width 70-80% of artboard, height = width × 0.6.

NO PLACEHOLDER CONTENT — HARD RULES:
- NEVER use "yoursite.com", "example.com", "Your Product", "Product Name", "Tagline", "Feature 1", "Click here", "Lorem ipsum", "Sample text", or any other generic stand-in. Every text string MUST come from the BrandReport (productName, tagline, headlines, features, cta, price).
- NEVER drop a BrowserMockup, MacMockup, or PhoneMockup unless you have a real screenshot URL (from the hero image or stock images). An empty mockup with default chrome is forbidden.
- NEVER drop a CodeBlock unless the product is genuinely a coding/dev tool. If you need a "code" visual for a non-dev product, use Typewriter instead with actual product copy.
- BrowserMockup.url must be the REAL product domain (e.g. "openoutreach.app", not "yoursite.com"). Strip protocol.

MOTION PRINCIPLES — HARD RULES:
- NOTHING APPEARS OR DISAPPEARS WITHOUT MOTION. Every non-background, non-beat-overlay layer MUST have:
    (a) an ENTRY op at its first visible moment — one of growIn, slideIn, fadeIn (paired with another), or textIn for text.
    (b) an EXIT op before scene end — one of shrinkOut, slideOut, fadeOut (paired). Pop-in / pop-out is a BUG.
- Pair complementary entries/exits (slideIn-up → slideOut-down, growIn → shrinkOut, slideIn-left → slideOut-right).
- Decisive ease curves: \`slowDown\` for entries, \`accelerate\` for exits, \`natural\` for sustained transforms.
- Stagger text reveals with split="letters" at offset 40-60ms; words at offset 80-120ms.
- Snap event times to the beat / half-beat grid.
- Avoid pure opacity-only animation — pair fades with subtle translate or scale.

LAYOUT QUALITY — HARD RULES (audited after generation):
- CONTRAST: every text layer's color MUST hit at least 4.5:1 WCAG contrast against the visible background BEHIND its bounding box. Default to white on dark bg, near-black on light bg. Never put gray-on-gray, brand-color-on-brand-color, or text that fades into a similar-luminance bg.
- NO OVERLAP: layer bounding boxes (x..x+width, y..y+height) must NOT overlap one another within the same scene unless the overlap is deliberate (e.g. text sitting on a GlassCard, an icon badge on a card corner). When two non-background layers overlap by more than 30% of either's area, that's a BUG.
- NO PERSISTENT LAYERS: no element should just "sit there" for an entire scene. After its entry op finishes, a layer's dwell (time with no motion) must be ≤60% of the scene duration. If a layer must stay visible long, add a pulse / resize / subtle slide mid-scene so it doesn't look frozen.
- DO NOT REUSE LAYER IDS ACROSS ARTBOARDS expecting them to "continue" — each artboard is rendered as its own Sequence and resets. If you want the same content in two scenes, declare new layers with new ids (the visual continuity comes from matching colors / fonts, not from shared ids).

COHERENCE BUDGET (HARD CAPS — do not exceed):
- TOTAL distinct builtin components across the WHOLE video: ≤ 6.
- TOTAL distinct entry kinds per SCENE: ≤ 2 (e.g. one scene uses slideIn + textIn only; another uses growIn + fadeIn only).
- AT MOST ONE beat-effect KIND across the whole video — pick ONE of: BeatInvert OR BeatColorSwap (BeatTextSwap is allowed alongside BeatColorSwap as a paired text-color flip). Do NOT stack BeatInvert with BeatColorSwap.
- Pick a "motion theme" per scene and stick to it. Reuse the same builtins across scenes when sensible (e.g. same BlurredBlob colors, same Typewriter font).
- Less is more. A scene with 4 well-staged layers + 1 strong beat hit beats a scene with 12 layers fighting for attention.

BEAT HITS — pick ONE method for the whole video. These are SUSTAINED, not strobes.
- BeatInvert    — full-bleed TOP-most layer. Inversion fades in over fadeBeats, holds for ~1 beat, fades out. Use 1-2 hits per VIDEO (not per scene) at climactic moments. Props: { bpm, beats:[8, 24], holdBeats?:1, fadeBeats?:0.25 }.
- BeatColorSwap — scene BACKGROUND. Crossfades between two colors on each listed beat and HOLDS until the next. Place as the FIRST layer of the scene. Props: { bpm, beats:[8, 16, 24], fromColor, toColor, fadeBeats?:0.5, minHoldBeats?:4 }.
   - When using BeatColorSwap, place a BeatTextSwap with the SAME beats[] for any large heading layer so the text color flips with the bg and contrast stays correct. Same fromColor/toColor pair, but mapped INVERTED (text fromColor = bg toColor).
- DO NOT strobe on every beat. Pick 1-3 sparse hit beats only.
- Beats[] are integer beat indices counted from ARTBOARD START. Skip 0. Land on 8, 16, 24 (every 2 bars) or just one peak beat per scene.
- BEAT OVERLAYS MUST NOT HAVE ANY OPS APPLIED TO THEM (no fadeIn / slideIn / etc). Their parent wrapper would create an opacity stacking context that traps the blend mode. They animate themselves via the bpm prop.

CUSTOM COMPONENT AUTHORING (READ CAREFULLY — these rules prevent runtime crashes):
- Source is a TypeScript function-component string. JSX IS supported (transpiled at runtime).
- NO imports — these identifiers are in scope:
    React, AbsoluteFill, Audio, Sequence, Img, useCurrentFrame, useVideoConfig, interpolate, spring, staticFile.
- Required boilerplate at the TOP of every component body:
    const frame = useCurrentFrame();
    const { fps, durationInFrames } = useVideoConfig();
  Only call hooks at the top level of the function — never inside loops, conditions, or nested functions.
- When you call \`interpolate\`, the FIRST argument MUST be \`frame\` (or another number you computed from it):
    interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' })
- When you call \`spring\`, you MUST pass both \`frame\` and \`fps\` in the object:
    spring({ frame, fps, config: { damping: 100, stiffness: 200 } })
  NEVER call \`spring()\` or \`spring({...})\` without frame+fps — it will throw "Argument missing for parameter 'frame'".
- The component fills its layer's box: root element must have \`{ width: '100%', height: '100%' }\`.
- Inline styles only via \`style={{ ... }}\` — no \`<style>\` tags.
- For gradients: \`background: 'linear-gradient(135deg, #abc 0%, #def 100%)'\` or \`radial-gradient(...)\`.
- For blur: \`backdropFilter: 'blur(20px)'\`, \`WebkitBackdropFilter: 'blur(20px)'\`.
- For shadows: \`boxShadow: '0 20px 60px rgba(0,0,0,0.25)'\`.
- Each component must be a pure function — no useState, useEffect, refs, async work, or external fetches.
- If you reference props, accept them as the first argument and destructure with safe defaults: \`function MyFx({ color = '#fff', strength = 1 } = {}) { ... }\`.

RULES:
- Output ONLY the JSON object. No prose, no markdown fences.
- Every layer.id and operation.id must be unique.
- Every operation.targetId must reference an existing layer.id (including nested ones).
- Times in milliseconds; durations are positive integers.`;

function extractJsonBlock(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : text;
  const start = candidate.indexOf("{");
  if (start === -1) {
    throw new Error("No JSON object found in model output");
  }
  // Walk forward, tracking string state + brace/bracket depth.
  let depth = 0;
  let inString = false;
  let escape = false;
  let lastBalanced = -1;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) {
        lastBalanced = i;
        break;
      }
    }
  }
  if (lastBalanced !== -1) {
    return candidate.slice(start, lastBalanced + 1);
  }
  // Fall back to lastIndexOf if no balanced point found.
  const end = candidate.lastIndexOf("}");
  if (end <= start) {
    throw new Error("No JSON object found in model output");
  }
  return candidate.slice(start, end + 1);
}

/**
 * Parse the model's JSON, repairing common LLM faults if strict parsing fails.
 * Gemini occasionally drops a comma between array elements / objects or leaves
 * a trailing comma — e.g. "Expected ',' or ']' after array element at position
 * N". jsonrepair fixes those structurally (string-aware, so it won't corrupt
 * text content). We try strict first so a clean response pays no cost, then
 * repair, and only then surface the original (more informative) parse error.
 */
function parseModelJson(raw: string): unknown {
  const block = extractJsonBlock(raw);
  try {
    return JSON.parse(block);
  } catch (strictErr) {
    try {
      const repaired = jsonrepair(block);
      const value = JSON.parse(repaired);
      console.warn(
        `[JitterComposer] strict JSON parse failed (${
          strictErr instanceof Error ? strictErr.message : strictErr
        }) — recovered via jsonrepair`,
      );
      return value;
    } catch {
      throw strictErr;
    }
  }
}

function buildUserMessage(brief: JitterBrief): string {
  const w = brief.width ?? 1920;
  const h = brief.height ?? 1080;
  const dur = brief.durationMs ?? 5000;
  const brand = brief.brand
    ? `\nBRAND (LOCK — use these exact colors and font):\n${JSON.stringify(brief.brand, null, 2)}`
    : "";
  const copy = brief.copy
    ? `\nPAGE COPY (use VERBATIM where it fits — do not paraphrase product names, headlines, or features):\n${JSON.stringify(brief.copy, null, 2)}`
    : "";
  const hero = brief.heroImage
    ? `\nHERO IMAGE (place prominently in scene 1, ~60-70% of frame):\n  url: ${brief.heroImage}`
    : "";
  const stock = brief.stockImages?.length
    ? `\nSTOCK IMAGES — each line is "url (topic)". ONLY drop one into a scene whose content matches the topic. If no topic matches, DO NOT add a stock image — leave the scene typographic. Never reuse the same stock URL across scenes.\n${brief.stockImages
        .map((entry) => {
          if (typeof entry === "string") return `  - ${entry}`;
          return `  - ${entry.url}  (topic: ${entry.topic ?? "generic"})`;
        })
        .join("\n")}`
    : "";
  const audio = brief.audio
    ? `\nAUDIO (attach this as top-level "audio" in your JSON — do not omit):\n${JSON.stringify(brief.audio)}`
    : "";
  const narration = brief.narration
    ? `\nNARRATION (attach this as top-level "narration" in your JSON — voice-over plays mixed with the music):\n${JSON.stringify(brief.narration)}\nDESIGN FOR NARRATION: keep on-screen text minimal, reveal in sync with the voice. Total scene durations should give the narration room to land.`
    : "";

  const userAssetsBlock = brief.userAssets?.length
    ? `\nUSER ASSETS — the operator uploaded these and may reference them by alias in the BRIEF (e.g. "use [logo] in scene 1"). When the brief mentions an alias by name, drop the matching URL as a layer in that scene. Images go as { "type": "image", "url": "<url>" }. VIDEO assets cannot render directly — use the first frame mental-model and drop the URL only if the brief explicitly asks for a "thumbnail" placeholder; otherwise skip video assets. NEVER reuse the same asset more than twice.\n${brief.userAssets
        .map(
          (a) =>
            `  - [${a.alias}] kind=${a.kind} url=${a.url}${a.description ? `  // ${a.description}` : a.name ? `  // ${a.name}` : ""}`,
        )
        .join("\n")}`
    : "";

  const beatBlock = brief.audio?.bpm
    ? `\nBEAT GRID (the music is locked at ${brief.audio.bpm} BPM — compose ON the grid):\n${describeBeatGrid(beatGridForBpm(brief.audio.bpm))}`
    : "";

  const customs = brief.allowCustomComponents === false
    ? "\nCUSTOM COMPONENTS DISABLED — leave customComponents: []."
    : "";

  const fontBlock = `\nAVAILABLE FONTS (pick from this list for any text layer's font.name — anything else falls back to Inter):\n  ${AVAILABLE_FONTS.join(", ")}`;

  const backdropBlock = brief.backdrop
    ? `\nAUTO BACKDROP (already inserted as the first layer of every artboard — DO NOT add your own background gradients, blobs, AnimatedGradient, BlurredBlob, MeshGradient, AbstractBackdrop, DotGrid, LineGrid, or full-bleed rect backgrounds. The backdrop handles all of that):\n  template: ${brief.backdrop.templateName} (variant=${brief.backdrop.variant})\n  palette: ${brief.backdrop.palette.join(", ")}\nDESIGN CONTENT ON TOP of the backdrop. Set artboard.fillColor to "transparent" and artboard.background to false so the backdrop shows through.`
    : "";

  const inspirations = brief.templateInspirations?.length
    ? `\nINSPIRATION TEMPLATES (reference Jitter projects — do NOT copy verbatim, use as a stylistic prior for layout density, palette range, and motion budget):\n${brief.templateInspirations
        .map(
          (t) =>
            `  - ${t.name} [${(t.sections ?? []).join(", ") || "general"}] artboards=${t.artboardCount ?? "?"} layers=${t.layerCount ?? "?"} ops=${t.opCount ?? "?"} dur=${t.totalDurationMs ?? "?"}ms palette=${(t.palette ?? []).slice(0, 5).join(",")}`,
        )
        .join("\n")}`
    : "";

  // Hint scene count from duration. If audio.bpm given, prefer 2-bar (8 beats) units.
  const beatMs = brief.audio?.bpm ? 60000 / brief.audio.bpm : 0;
  let sceneHint = "";
  if (dur > 6000) {
    if (beatMs) {
      const eightBeatMs = beatMs * 8;
      const sceneCount = Math.max(2, Math.round(dur / eightBeatMs));
      sceneHint = `\nSCENE PLAN: target ${sceneCount} artboards (≈${Math.round(eightBeatMs)}ms = 8 beats each). Hook → feature(s) → CTA.`;
    } else {
      const targetScenes = Math.max(2, Math.round(dur / 4000));
      sceneHint = `\nSCENE PLAN: target ~${targetScenes} artboards (≈${Math.round(dur / targetScenes)}ms each). Hook → feature(s) → CTA.`;
    }
  }

  return `BRIEF:
${brief.brief.trim()}

TARGET:
- Canvas: ${w} x ${h}
- Total duration: ${dur}ms (sum of artboard durations MUST equal this ±200ms)
- fps: 30${sceneHint}${beatBlock}${brand}${copy}${hero}${stock}${audio}${narration}${userAssetsBlock}${fontBlock}${backdropBlock}${inspirations}${customs}

${BUILTIN_CATALOG}

Return the JSON document now.`;
}

const BEAT_OVERLAY_NAMES = new Set([
  "BeatInvert",
  "BeatColorSwap",
  "BeatTextSwap",
]);

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function relLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const ch = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function contrastRatio(aHex: string, bHex: string): number {
  const a = hexToRgb(aHex);
  const b = hexToRgb(bHex);
  if (!a || !b) return 21; // unknown colors → assume fine
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Walk every text layer in the doc. For any text layer whose color has
 * <4.5:1 contrast against the scene's background fill, flip the text color
 * to whichever of #ffffff / #111111 has the better contrast. Logs a warning.
 */
function enforceTextContrast(doc: JitterDoc): { textFlipped: number } {
  let textFlipped = 0;

  function fixIn(layers: any[], bgHex: string) {
    for (const layer of layers || []) {
      if (!layer || typeof layer !== "object") continue;
      if (layer.type === "text" && typeof layer.color === "string") {
        const ratio = contrastRatio(layer.color, bgHex);
        if (ratio < 4.5) {
          const whiteR = contrastRatio("#ffffff", bgHex);
          const blackR = contrastRatio("#111111", bgHex);
          const newColor = whiteR >= blackR ? "#ffffff" : "#111111";
          console.warn(
            `[JitterComposer] contrast fix: text "${(layer.text ?? "").slice(0, 24)}…" ${layer.color} on ${bgHex} (ratio ${ratio.toFixed(2)}) → ${newColor}`,
          );
          layer.color = newColor;
          textFlipped++;
        }
      }
      if (layer.type === "layerGrp" && Array.isArray(layer.layers)) {
        const innerBg =
          layer.background && typeof layer.fillColor === "string"
            ? layer.fillColor
            : bgHex;
        fixIn(layer.layers, innerBg);
      }
    }
  }

  for (const art of doc.conf.artboards) {
    const bg =
      art.background && typeof art.fillColor === "string"
        ? art.fillColor
        : "#0b1020";
    fixIn(art.layers, bg);
  }
  return { textFlipped };
}

/**
 * Detect non-trivial overlapping layer bounding boxes per artboard. We don't
 * auto-resolve — just log so the LLM tunes its layout next time and humans
 * notice. Beat overlays / backgrounds are skipped.
 */
function reportLayoutOverlaps(doc: JitterDoc): { overlapWarnings: number } {
  let overlapWarnings = 0;

  function isBg(l: any): boolean {
    if (!l) return true;
    if ((l.type === "rect" || l.type === "layerGrp") && l.background === true)
      return true;
    if (l.type === "custom" && BEAT_OVERLAY_NAMES.has(l.component)) return true;
    if (
      l.type === "custom" &&
      (l.component === "TemplateBackdrop" ||
        l.component === "AbstractBackdrop" ||
        l.component === "MeshGradient" ||
        l.component === "DotGrid" ||
        l.component === "LineGrid" ||
        l.component === "AnimatedGradient" ||
        l.component === "NoiseField")
    )
      return true;
    return false;
  }

  function collect(layers: any[], dx: number, dy: number, out: any[]) {
    for (const l of layers || []) {
      if (!l || typeof l !== "object") continue;
      if (isBg(l)) {
        if (l.type === "layerGrp" && Array.isArray(l.layers)) {
          collect(l.layers, dx + (l.x ?? 0), dy + (l.y ?? 0), out);
        }
        continue;
      }
      const x = dx + (l.x ?? 0);
      const y = dy + (l.y ?? 0);
      const w = l.width ?? 0;
      const h = l.height ?? 0;
      if (w > 0 && h > 0) {
        out.push({ id: l.id, x, y, w, h, type: l.type });
      }
      if (l.type === "layerGrp" && Array.isArray(l.layers)) {
        collect(l.layers, x, y, out);
      }
    }
  }

  for (const art of doc.conf.artboards) {
    const boxes: Array<{ id: string; x: number; y: number; w: number; h: number; type: string }> =
      [];
    collect(art.layers, 0, 0, boxes);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
        const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
        const inter = ix * iy;
        if (inter <= 0) continue;
        const minArea = Math.min(a.w * a.h, b.w * b.h);
        const ratio = inter / Math.max(1, minArea);
        if (ratio > 0.3) {
          overlapWarnings++;
          console.warn(
            `[JitterComposer] layout overlap on artboard ${art.id}: ${a.type}#${a.id} and ${b.type}#${b.id} overlap ${Math.round(ratio * 100)}%`,
          );
        }
      }
    }
  }
  return { overlapWarnings };
}

/**
 * Inject the auto-picked TemplateBackdrop as the FIRST layer of every
 * artboard. Set artboard.background=false so the backdrop shows through.
 */
function injectBackdrop(doc: JitterDoc, backdrop: NonNullable<JitterBrief["backdrop"]>): { added: number; replaced: number } {
  let added = 0;
  let replaced = 0;
  let counter = 0;
  for (const art of doc.conf.artboards) {
    (art as any).background = false;
    // Drop any model-authored TemplateBackdrop / AbstractBackdrop / MeshGradient
    // / DotGrid / LineGrid full-bleed layers — we own the backdrop now.
    const beforeLen = art.layers.length;
    art.layers = art.layers.filter((l: any) => {
      if (l.type !== "custom") return true;
      const isBgBuiltin =
        l.component === "TemplateBackdrop" ||
        l.component === "AbstractBackdrop" ||
        l.component === "MeshGradient" ||
        l.component === "DotGrid" ||
        l.component === "LineGrid" ||
        l.component === "AnimatedGradient";
      const isFullBleed =
        (Number(l.width) || 0) >= art.width * 0.9 &&
        (Number(l.height) || 0) >= art.height * 0.9;
      return !(isBgBuiltin && isFullBleed);
    }) as typeof art.layers;
    replaced += beforeLen - art.layers.length;

    const layer: any = {
      type: "custom",
      id: `bd-${art.id}-${counter++}`,
      name: "auto-backdrop",
      x: 0,
      y: 0,
      width: art.width,
      height: art.height,
      scale: 1,
      angle: 0,
      opacity: 100,
      cornerRadius: 0,
      component: "TemplateBackdrop",
      props: {
        palette: backdrop.palette,
        variant: backdrop.variant,
        intensity: backdrop.intensity,
        showGrid: true,
        gridColor: "rgba(255,255,255,0.06)",
      },
    };
    art.layers.unshift(layer);
    added++;
  }
  return { added, replaced };
}

/**
 * Walk every non-background layer. If its bounding box extends past the
 * artboard (with `margin` padding), clamp x/y/width/height so it fits.
 * Also shrinks font-size on text layers proportionally to the height
 * scale-back so the text doesn't visually overflow.
 */
/**
 * Estimate rendered width of a single line of text given font size + weight.
 * Conservative average for sans display fonts at 700-900 weight.
 */
function estimateTextWidth(text: string, fontSize: number, weight = 700): number {
  if (!text) return 0;
  const factor = weight >= 700 ? 0.62 : 0.55;
  return text.length * fontSize * factor;
}

/**
 * For every text layer, shrink fontSize so the longest word fits the box width
 * with margin, AND grow the box height to accommodate the wrapped lines.
 * Prevents the "text overflowing the artboard" issue users see when the LLM
 * sets fontSize=180 inside a 400px-wide card.
 */
function autoFitTextLayers(doc: JitterDoc): { fitted: number } {
  let fitted = 0;
  function fix(layers: any[]) {
    for (const l of layers || []) {
      if (!l || typeof l !== "object") continue;
      if (l.type === "layerGrp" && Array.isArray(l.layers)) {
        fix(l.layers);
      }
      if (l.type !== "text") continue;
      const text = String(l.text ?? "");
      if (!text.trim()) continue;
      const fontSize = Number(l.fontSize) || 32;
      const weight = Number(l.font?.weight ?? 600);
      const lineHeight = Number(l.lineHeight) || 1.15;
      const boxW = Math.max(40, Number(l.width) || 200);

      // 1) Find the widest single word; fontSize must be small enough for it to fit.
      const longestWord = text.split(/\s+/).reduce((m, w) => (w.length > m.length ? w : m), "");
      const wordWidth = estimateTextWidth(longestWord, fontSize, weight);
      let newFontSize = fontSize;
      if (wordWidth > boxW) {
        const ratio = boxW / wordWidth;
        newFontSize = Math.max(14, Math.floor(fontSize * ratio * 0.95));
      }

      // 2) Estimate wrap line count using newFontSize, grow height if needed.
      const fullW = estimateTextWidth(text, newFontSize, weight);
      const linesEstimate = Math.max(1, Math.ceil(fullW / boxW));
      const neededHeight = Math.ceil(newFontSize * lineHeight * linesEstimate) + 8;
      if (newFontSize !== fontSize) {
        l.fontSize = newFontSize;
        fitted++;
      }
      if (Number(l.height) < neededHeight) {
        l.height = neededHeight;
        fitted++;
      }
    }
  }
  for (const art of doc.conf.artboards) {
    fix(art.layers);
  }
  return { fitted };
}

/**
 * If the composer placed a raw <image> layer covering >50% of an artboard
 * AND that layer points at the brief's hero image, convert it to a
 * BrowserMockup so the screenshot has chrome + a sensible aspect instead of
 * sitting raw on top of other content.
 */
function wrapHeroImageInMockup(doc: JitterDoc, heroImageUrl: string): { wrapped: number } {
  let wrapped = 0;
  for (const art of doc.conf.artboards) {
    for (const l of art.layers as any[]) {
      if (!l || l.type !== "image") continue;
      if (l.url !== heroImageUrl) continue;
      const areaRatio =
        ((Number(l.width) || 0) * (Number(l.height) || 0)) /
        (art.width * art.height);
      if (areaRatio < 0.35) continue;
      // Convert in-place to a ScreenshotShowcase — staged reveal in the
      // style of the "Animated web screens" jitter showreel.
      l.type = "custom";
      l.component = "ScreenshotShowcase";
      l.props = {
        screenshots: [heroImageUrl],
        bezelColor: "#0a0a0a",
        cornerRadius: 18,
        tilt: 6,
        stagger: 14,
      };
      // 16:10ish aspect so the stacked screens have room to breathe.
      const w = Number(l.width) || art.width * 0.75;
      const targetH = Math.round(w * 0.62);
      if (Number(l.height) > targetH * 1.2 || Number(l.height) < targetH * 0.7) {
        l.height = targetH;
      }
      delete l.url;
      wrapped++;
    }
  }
  return { wrapped };
}

function clampLayersToArtboard(
  doc: JitterDoc,
  margin = 40,
): { clamped: number } {
  let clamped = 0;
  function fix(layers: any[], maxW: number, maxH: number) {
    for (const l of layers || []) {
      if (!l || typeof l !== "object") continue;
      if (l.type === "layerGrp" && Array.isArray(l.layers)) {
        fix(l.layers, l.width || maxW, l.height || maxH);
      }
      // Skip our backdrop and any other full-bleed layer that's meant to fill.
      if (
        l.type === "custom" &&
        (BEAT_OVERLAY_NAMES.has(l.component) ||
          l.component === "TemplateBackdrop")
      ) {
        continue;
      }
      const w = Number(l.width) || 0;
      const h = Number(l.height) || 0;
      let x = Number(l.x) || 0;
      let y = Number(l.y) || 0;
      const minX = margin;
      const minY = margin;
      const maxX = maxW - margin;
      const maxY = maxH - margin;
      let didFix = false;
      // Shrink first if larger than usable area.
      const usableW = Math.max(40, maxX - minX);
      const usableH = Math.max(40, maxY - minY);
      let newW = w;
      let newH = h;
      if (w > usableW) {
        newW = usableW;
        didFix = true;
      }
      if (h > usableH) {
        newH = usableH;
        didFix = true;
      }
      if (newH !== h && l.type === "text" && typeof l.fontSize === "number") {
        l.fontSize = Math.max(16, Math.round(l.fontSize * (newH / h)));
      }
      if (newW !== w || newH !== h) {
        l.width = newW;
        l.height = newH;
      }
      // Then shift back inside bounds.
      if (x + newW > maxX) {
        x = maxX - newW;
        didFix = true;
      }
      if (y + newH > maxY) {
        y = maxY - newH;
        didFix = true;
      }
      if (x < minX) {
        x = minX;
        didFix = true;
      }
      if (y < minY) {
        y = minY;
        didFix = true;
      }
      if (didFix) {
        l.x = x;
        l.y = y;
        clamped++;
      }
    }
  }
  for (const art of doc.conf.artboards) {
    fix(art.layers, art.width, art.height);
  }
  return { clamped };
}

/**
 * Heuristic overlap separator. For every pair of non-bg sibling layers whose
 * bounding boxes overlap by >35% of either's area, slide the lower one down
 * (along Y) until the overlap drops below 5%. Bounded by artboard height —
 * once you hit the floor, shrink the layer instead.
 */
function separateLayerOverlaps(doc: JitterDoc): { moved: number } {
  let moved = 0;

  function isBg(l: any): boolean {
    if (!l) return true;
    if ((l.type === "rect" || l.type === "layerGrp") && l.background === true)
      return true;
    if (l.type === "custom" && BEAT_OVERLAY_NAMES.has(l.component)) return true;
    if (l.type === "custom" && l.component === "TemplateBackdrop") return true;
    return false;
  }

  function overlapRatio(a: any, b: any): number {
    const ix = Math.max(
      0,
      Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
    );
    const iy = Math.max(
      0,
      Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
    );
    const inter = ix * iy;
    if (inter <= 0) return 0;
    return inter / Math.max(1, Math.min(a.width * a.height, b.width * b.height));
  }

  for (const art of doc.conf.artboards) {
    const siblings = (art.layers || []).filter((l: any) => !isBg(l));
    siblings.sort((a: any, b: any) => (a.y ?? 0) - (b.y ?? 0));
    for (let i = 0; i < siblings.length; i++) {
      for (let j = i + 1; j < siblings.length; j++) {
        const a = siblings[i];
        const b = siblings[j];
        let guard = 12;
        while (overlapRatio(a, b) > 0.35 && guard-- > 0) {
          // Push b down past a.
          const newY = a.y + a.height + 24;
          if (newY + b.height > art.height - 32) {
            // No room — shrink b.
            const overshoot = newY + b.height - (art.height - 32);
            b.height = Math.max(48, b.height - overshoot);
            if (b.type === "text" && typeof b.fontSize === "number") {
              b.fontSize = Math.max(16, Math.round(b.fontSize * 0.85));
            }
          }
          b.y = Math.min(newY, art.height - b.height - 32);
          moved++;
        }
      }
    }
  }
  return { moved };
}

const EXIT_OP_TYPES = new Set(["fadeOut", "slideOut", "shrinkOut"]);
const ENTRY_OP_TYPES = new Set([
  "fadeIn",
  "slideIn",
  "growIn",
  "textIn",
  "resize",
]);

/**
 * Patch any non-background layer that lacks an entry or exit op with a
 * default fadeIn / fadeOut. Without this, LLM-dropped layers (often images)
 * pop in or "stick" on the artboard for the rest of the scene.
 */
function enforceMotionCoverage(doc: JitterDoc): {
  exitsAdded: number;
  entriesAdded: number;
} {
  let exitsAdded = 0;
  let entriesAdded = 0;
  let opId = 0;

  function isBackground(layer: any): boolean {
    if (!layer) return false;
    if (layer.type === "layerGrp" && layer.background === true) return true;
    if (layer.type === "rect" && layer.background === true) return true;
    if (
      layer.type === "custom" &&
      typeof layer.component === "string" &&
      (BEAT_OVERLAY_NAMES.has(layer.component) ||
        layer.component === "TemplateBackdrop" ||
        layer.component === "AbstractBackdrop" ||
        layer.component === "MeshGradient" ||
        layer.component === "DotGrid" ||
        layer.component === "LineGrid" ||
        layer.component === "AnimatedGradient" ||
        layer.component === "NoiseField")
    ) {
      return true;
    }
    return false;
  }

  function walk(layers: any[], ops: any[], artDur: number) {
    for (const layer of layers || []) {
      if (!layer || typeof layer !== "object") continue;
      if (layer.type === "layerGrp" && Array.isArray(layer.layers)) {
        walk(layer.layers, ops, artDur);
      }
      if (isBackground(layer) || !layer.id) continue;

      const targeting = ops.filter((o) => o.targetId === layer.id);
      const entries = targeting.filter((o) => ENTRY_OP_TYPES.has(o.type));
      const exits = targeting.filter((o) => EXIT_OP_TYPES.has(o.type));

      if (entries.length === 0) {
        ops.push({
          id: `auto-in-${layer.id}-${opId++}`,
          type: "fadeIn",
          targetId: layer.id,
          startTime: 0,
          endTime: Math.min(450, Math.max(250, Math.round(artDur * 0.14))),
          easing: "slowDown",
        });
        entriesAdded++;
      } else {
        // Lengthen any entry op that's <200ms — a 50ms fadeIn looks like a pop.
        for (const e of entries) {
          const dur = (e.endTime ?? 0) - (e.startTime ?? 0);
          if (dur < 200) {
            e.endTime = (e.startTime ?? 0) + 300;
            entriesAdded++;
          }
        }
      }
      if (exits.length === 0) {
        const exitDur = Math.min(450, Math.max(250, Math.round(artDur * 0.14)));
        ops.push({
          id: `auto-out-${layer.id}-${opId++}`,
          type: "fadeOut",
          targetId: layer.id,
          startTime: Math.max(0, artDur - exitDur - 100),
          endTime: Math.max(exitDur, artDur - 100),
          easing: "accelerate",
        });
        exitsAdded++;
      } else {
        // Lengthen short exit ops AND push them to land before scene-end.
        for (const e of exits) {
          const dur = (e.endTime ?? 0) - (e.startTime ?? 0);
          if (dur < 200) {
            e.endTime = (e.startTime ?? 0) + 300;
            exitsAdded++;
          }
          if ((e.endTime ?? 0) > artDur) {
            e.endTime = artDur - 50;
            e.startTime = Math.max(0, e.endTime - 350);
          }
        }
      }
    }
  }

  for (const art of doc.conf.artboards) {
    walk(art.layers, art.operations, art.duration);
  }
  return { exitsAdded, entriesAdded };
}

function validateCrossRefs(doc: JitterDoc): string[] {
  const errors: string[] = [];
  function collectIds(layers: any[], acc: Set<string>) {
    for (const l of layers) {
      if (!l || typeof l !== "object") continue;
      if (l.id) acc.add(l.id);
      if (l.type === "layerGrp" && Array.isArray(l.layers)) {
        collectIds(l.layers, acc);
      }
    }
  }
  const customNames = new Set(doc.customComponents.map((c) => c.name));
  for (const art of doc.conf.artboards) {
    const ids = new Set<string>();
    collectIds(art.layers, ids);
    for (const op of art.operations) {
      if (!ids.has(op.targetId)) {
        errors.push(
          `Artboard ${art.id}: operation ${op.id} targets unknown layer id "${op.targetId}"`,
        );
      }
    }
    function checkCustomRefs(layers: any[]) {
      for (const l of layers) {
        if (
          l.type === "custom" &&
          !customNames.has(l.component) &&
          !BUILTIN_NAMES.has(l.component)
        ) {
          errors.push(
            `Artboard ${art.id}: layer ${l.id} references unknown component "${l.component}" (not in customComponents[] and not a built-in)`,
          );
        }
        if (l.type === "layerGrp") checkCustomRefs(l.layers || []);
      }
    }
    checkCustomRefs(art.layers);
  }
  return errors;
}

export interface JitterComposerResult {
  doc: JitterDoc;
  totalFrames: number;
  attempts: number;
  rawText: string;
}

/**
 * Vision-aware variant. Same prompt + brief, but Gemini Pro Vision SEES the
 * provided media (an mp4 clip or a screenshot) while writing the JitterDoc —
 * massively improves "recreate this look" fidelity.
 */
export async function generateJitterDocWithMedia(
  brief: JitterBrief,
  media: { type: "video" | "image"; path: string },
  opts: { maxAttempts?: number; extraSystemNote?: string } = {},
): Promise<JitterComposerResult> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const userMessage = buildUserMessage(brief);
  const sysCombined = `${SYSTEM_PROMPT}\n\n${opts.extraSystemNote ?? ""}`;

  let lastError: unknown = null;
  let raw = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(
        `[JitterComposer/vision] Attempt ${attempt}/${maxAttempts} (media=${media.type})`,
      );
      const fixupNote =
        attempt > 1
          ? `\n\nPREVIOUS OUTPUT WAS INVALID:\n${lastError instanceof Error ? lastError.message : String(lastError)}\n\nReturn ONLY the corrected JSON object — no markdown fences, no commentary.`
          : "";
      const resp = await chatWithGeminiProVision(
        media,
        userMessage + fixupNote,
        sysCombined,
        { temperature: 0.3, maxTokens: 16000 },
      );
      raw = resp.content;
      const json = parseModelJson(raw);
      const parsed = JitterDocSchema.safeParse(json);
      if (!parsed.success) {
        const issues = parsed.error.issues
          .slice(0, 8)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("\n");
        throw new Error(`Schema validation failed:\n${issues}`);
      }
      const refErrors = validateCrossRefs(parsed.data);
      if (refErrors.length) {
        throw new Error(`Cross-reference errors:\n${refErrors.join("\n")}`);
      }
      const targetMs = brief.durationMs ?? 5000;
      const sumMs = parsed.data.conf.artboards.reduce(
        (s, a) => s + (a.duration || 0),
        0,
      );
      if (sumMs < targetMs * 0.85) {
        throw new Error(
          `Duration deficit: artboards sum to ${sumMs}ms but brief requested ${targetMs}ms. Add ${Math.ceil((targetMs - sumMs) / 4000)} more artboards (hook → features → CTA). Each artboard should be ~4000-8000ms.`,
        );
      }
      const emptyArts2: string[] = [];
      for (const a of parsed.data.conf.artboards) {
        const contentLayers = (a.layers || []).filter((l: any) => {
          if (!l) return false;
          if (l.type === "custom") {
            if (
              l.component === "TemplateBackdrop" ||
              l.component === "AbstractBackdrop" ||
              l.component === "MeshGradient" ||
              l.component === "DotGrid" ||
              l.component === "LineGrid" ||
              l.component === "AnimatedGradient" ||
              l.component === "BlurredBlob" ||
              l.component === "NoiseField" ||
              l.component === "FloatingDots" ||
              l.component === "BeatInvert" ||
              l.component === "BeatColorSwap"
            )
              return false;
          }
          if ((l.type === "rect" || l.type === "layerGrp") && l.background === true)
            return false;
          return true;
        });
        if (contentLayers.length === 0) emptyArts2.push(a.id);
      }
      if (emptyArts2.length) {
        throw new Error(
          `Empty artboards (no content layers, only background): ${emptyArts2.join(", ")}. Every artboard MUST have AT LEAST 2 content layers (text/image/mockup/card).`,
        );
      }
      let finalDoc = parsed.data;
      if (finalDoc.audio?.bpm) {
        const { doc: snapped, stats } = snapDocToBeats(finalDoc);
        if (stats.opsShifted || stats.artboardsResized) {
          console.log(
            `[JitterComposer/vision] Beat-snap: ${stats.opsShifted} ops shifted, ${stats.artboardsResized} artboards resized, total drift ${stats.totalDriftMs}ms`,
          );
        }
        finalDoc = snapped;
      }
      const motion = enforceMotionCoverage(finalDoc);
      if (motion.exitsAdded || motion.entriesAdded) {
        console.log(
          `[JitterComposer/vision] Motion coverage: injected ${motion.entriesAdded} entries, ${motion.exitsAdded} exits`,
        );
      }
      const contrast = enforceTextContrast(finalDoc);
      if (contrast.textFlipped) {
        console.log(
          `[JitterComposer/vision] Contrast: flipped ${contrast.textFlipped} text colors to meet 4.5:1`,
        );
      }
      reportLayoutOverlaps(finalDoc);
      const totalFrames = finalDoc.conf.artboards.reduce(
        (sum, a) => sum + artboardDurationFrames(a, finalDoc.fps),
        0,
      );
      return { doc: finalDoc, totalFrames, attempts: attempt, rawText: raw };
    } catch (err) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[JitterComposer/vision] Attempt ${attempt} failed: ${errMsg}`,
      );
    }
  }

  throw new Error(
    `JitterComposer (vision) failed after ${maxAttempts} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

export async function generateJitterDoc(
  brief: JitterBrief,
  opts: { maxAttempts?: number } = {},
): Promise<JitterComposerResult> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserMessage(brief) },
  ];

  let lastError: unknown = null;
  let raw = "";

  // Default: Gemini Pro. Override with JITTER_LLM=cloudflare to try CF Kimi K2.6
  // (warning: historically produces invalid JitterDoc JSON — kept for testing).
  const LARGE_CONFIG = {
    ...CODE_GENERATOR_CONFIG,
    maxTokens: Number(process.env.JITTER_MAX_TOKENS || 16000),
  };
  const useCloudflare = process.env.JITTER_LLM === "cloudflare";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(
        `[JitterComposer] Attempt ${attempt}/${maxAttempts} (provider: ${useCloudflare ? "cloudflare-kimi" : "gemini-pro"})`,
      );
      const resp = useCloudflare
        ? await chatWithCloudflareAI(messages, LARGE_CONFIG)
        : await chatWithGeminiPro(messages, LARGE_CONFIG);
      raw = resp.content;
      const json = parseModelJson(raw);
      const parsed = JitterDocSchema.safeParse(json);
      if (!parsed.success) {
        const issues = parsed.error.issues
          .slice(0, 8)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("\n");
        throw new Error(`Schema validation failed:\n${issues}`);
      }
      const refErrors = validateCrossRefs(parsed.data);
      if (refErrors.length) {
        throw new Error(`Cross-reference errors:\n${refErrors.join("\n")}`);
      }
      // Duration contract: total artboard duration must hit the requested ms within
      // tolerance. Lite models love to ship 2 short scenes regardless of brief.
      const targetMs = brief.durationMs ?? 5000;
      const sumMs = parsed.data.conf.artboards.reduce(
        (s, a) => s + (a.duration || 0),
        0,
      );
      if (sumMs < targetMs * 0.85) {
        throw new Error(
          `Duration deficit: artboards sum to ${sumMs}ms but brief requested ${targetMs}ms. Add ${Math.ceil((targetMs - sumMs) / 4000)} more artboards (hook → features → CTA). Each artboard should be ~4000-8000ms.`,
        );
      }
      const emptyArts: string[] = [];
      for (const a of parsed.data.conf.artboards) {
        const contentLayers = (a.layers || []).filter((l: any) => {
          if (!l) return false;
          if (l.type === "custom") {
            // Backgrounds aren't content.
            if (
              l.component === "TemplateBackdrop" ||
              l.component === "AbstractBackdrop" ||
              l.component === "MeshGradient" ||
              l.component === "DotGrid" ||
              l.component === "LineGrid" ||
              l.component === "AnimatedGradient" ||
              l.component === "BlurredBlob" ||
              l.component === "NoiseField" ||
              l.component === "FloatingDots" ||
              l.component === "BeatInvert" ||
              l.component === "BeatColorSwap"
            )
              return false;
          }
          if ((l.type === "rect" || l.type === "layerGrp") && l.background === true)
            return false;
          return true;
        });
        if (contentLayers.length === 0) emptyArts.push(a.id);
      }
      if (emptyArts.length) {
        throw new Error(
          `Empty artboards (no content layers, only background): ${emptyArts.join(", ")}. Every artboard MUST have AT LEAST 2 content layers (text/image/mockup/card). Add headlines, feature copy, CTAs, or mockups to these scenes.`,
        );
      }
      // Safety net: if BPM provided, snap any stray timings to the half-beat grid.
      let finalDoc = parsed.data;
      if (finalDoc.audio?.bpm) {
        const { doc: snapped, stats } = snapDocToBeats(finalDoc);
        if (stats.opsShifted || stats.artboardsResized) {
          console.log(
            `[JitterComposer] Beat-snap: ${stats.opsShifted} ops shifted, ${stats.artboardsResized} artboards resized, total drift ${stats.totalDriftMs}ms`,
          );
        }
        finalDoc = snapped;
      }
      const motion = enforceMotionCoverage(finalDoc);
      if (motion.exitsAdded || motion.entriesAdded) {
        console.log(
          `[JitterComposer] Motion coverage: injected ${motion.entriesAdded} entries, ${motion.exitsAdded} exits`,
        );
      }
      const contrast = enforceTextContrast(finalDoc);
      if (contrast.textFlipped) {
        console.log(
          `[JitterComposer] Contrast: flipped ${contrast.textFlipped} text colors to meet 4.5:1`,
        );
      }
      if (brief.backdrop) {
        const bd = injectBackdrop(finalDoc, brief.backdrop);
        console.log(
          `[JitterComposer] Backdrop injected on ${bd.added} artboards (template=${brief.backdrop.templateName} variant=${brief.backdrop.variant})`,
        );
      }
      reportLayoutOverlaps(finalDoc);
      const totalFrames = finalDoc.conf.artboards.reduce(
        (sum, a) => sum + artboardDurationFrames(a, finalDoc.fps),
        0,
      );
      return { doc: finalDoc, totalFrames, attempts: attempt, rawText: raw };
    } catch (err) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[JitterComposer] Attempt ${attempt} failed: ${errMsg}`);
      messages.push({ role: "assistant", content: raw || "<no output>" });
      messages.push({
        role: "user",
        content: `Your previous output was invalid. Fix these issues and return ONLY the corrected JSON object (no markdown):\n${errMsg}`,
      });
    }
  }

  throw new Error(
    `JitterComposer failed after ${maxAttempts} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}
