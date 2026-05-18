/**
 * REFERENCE-VIDEO CLIP ANALYZER
 *
 * Per-clip Gemini Pro Vision pass that produces a structured SceneReport
 * the per-clip composer can recreate. Stays out of LLM-prose mode — the
 * downstream composer would otherwise drift.
 */

import { z } from "zod";
import { chatWithGeminiProVision } from "./model";

export const SceneReportSchema = z.object({
  /** 1-2 sentence summary of what's on screen. */
  summary: z.string(),
  /** Dominant palette sampled from frames. */
  palette: z.object({
    primary: z.string(),
    secondary: z.string().optional(),
    accent: z.string().optional(),
    background: z.string(),
    textColor: z.string(),
  }),
  /** Mood label. */
  mood: z
    .enum(["minimal", "playful", "premium", "techy", "warm", "bold", "cinematic"])
    .default("minimal"),
  /** Layout shape. */
  layout: z
    .enum(["centered", "split", "asymmetric", "grid", "fullbleed", "stack"])
    .default("centered"),
  /** Typography mood. */
  typography: z.object({
    family: z.string().default("Inter"),
    weight: z.number().default(700),
    style: z
      .enum(["display", "serif", "mono", "sans", "condensed", "expressive"])
      .default("sans"),
  }),
  /** Motion notes. */
  motion: z.object({
    /** Free-form description of how things move in this clip. */
    description: z.string(),
    /** Dominant transition kinds (e.g., slide, scale, dissolve, wipe). */
    transitions: z.array(z.string()).default([]),
    /** Pacing 1-10 (1 slow, 10 frantic). */
    pacing: z.number().min(1).max(10).default(5),
  }),
  /** Verbatim text seen on screen, if any. */
  onScreenText: z.array(z.string()).default([]),
  /** Special FX cues (particles, glow, blur, gradient drift, etc.). */
  effects: z.array(z.string()).default([]),
  /** Component suggestions the composer should consider authoring. */
  componentSuggestions: z
    .array(
      z.object({
        name: z
          .string()
          .regex(/^[A-Z][A-Za-z0-9]*$/, "PascalCase suggested component name"),
        purpose: z.string(),
      }),
    )
    .default([]),
});

export type SceneReport = z.infer<typeof SceneReportSchema>;

const SYSTEM_PROMPT = `You are a senior motion-design analyst. You watch a SHORT clip from a reference video and produce a STRUCTURED report another LLM will use to recreate the look in code (using a Jitter-style primitive + operations engine plus authored React components).

Return ONLY a single JSON object — no markdown fences, no commentary — matching this shape:

{
  "summary": "string — 1-2 sentences",
  "palette": {
    "primary": "#hex", "secondary": "#hex", "accent": "#hex",
    "background": "#hex", "textColor": "#hex"
  },
  "mood": "minimal|playful|premium|techy|warm|bold|cinematic",
  "layout": "centered|split|asymmetric|grid|fullbleed|stack",
  "typography": { "family": "Inter|Space Grotesk|Manrope|Geist|Sora|Outfit|DM Sans|Poppins|Playfair Display|Bebas Neue|Montserrat", "weight": 700, "style": "display|serif|mono|sans|condensed|expressive" },
  "motion": {
    "description": "string — how elements enter, hold, exit",
    "transitions": ["slide-up", "scale-pop", "dissolve", "wipe-left", ...],
    "pacing": 1..10
  },
  "onScreenText": ["verbatim text seen on screen"],
  "effects": ["e.g. drifting noise gradient", "soft white glow halo", "particle dots"],
  "componentSuggestions": [
    { "name": "PascalName", "purpose": "what visual it represents" }
  ]
}

RULES:
- All colors as #RRGGBB hex strings sampled from frames.
- Be precise about MOTION — distinguish slide, scale, fade, rotate, wipe, blur transitions.
- Include any text shown on screen VERBATIM in onScreenText.
- componentSuggestions: 0-3 entries, ONLY for visuals not expressible by primitives (rect/text/image/group). Skip suggestions for plain backgrounds, simple text, or simple image placement.`;

function extractJsonBlock(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in vision output");
  }
  return candidate.slice(start, end + 1);
}

export async function analyzeReferenceClip(
  clipPath: string,
  opts: { index?: number; total?: number } = {},
): Promise<SceneReport> {
  const tag =
    opts.index != null && opts.total != null
      ? `clip ${opts.index + 1}/${opts.total}`
      : "clip";
  console.log(`[refAnalyzer] ${tag}: vision analyze ${clipPath}`);
  const userPrompt = `Analyze this short reference clip (${tag}) and return the structured report.`;

  const maxAttempts = 3;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await chatWithGeminiProVision(
        { type: "video", path: clipPath },
        userPrompt,
        SYSTEM_PROMPT,
        { temperature: 0.2, maxTokens: 4000 },
      );
      const parsed = SceneReportSchema.safeParse(
        JSON.parse(extractJsonBlock(resp.content)),
      );
      if (!parsed.success) {
        const issues = parsed.error.issues
          .slice(0, 8)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("\n");
        throw new Error(`SceneReport schema invalid:\n${issues}`);
      }
      return parsed.data;
    } catch (err) {
      lastError = err;
      console.warn(
        `[refAnalyzer] ${tag} attempt ${attempt} failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
  throw new Error(
    `analyzeReferenceClip failed for ${clipPath}: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}
