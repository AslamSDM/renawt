/**
 * PER-CLIP JITTER COMPOSER (reference-video mode)
 *
 * Each clip → one Jitter artboard + customComponents tailored to that clip's
 * style. Caller merges the per-clip outputs into a single JitterDoc.
 *
 * Reuses generateJitterDoc with a per-clip brief that:
 *   - locks duration to the clip duration (so the composer fills exactly one artboard)
 *   - feeds the SceneReport so the composer recreates the look
 *   - encourages customComponents authoring when builtins fall short
 */

import {
  generateJitterDocWithMedia,
  type JitterBrief,
} from "./jitterComposer";
import type { JitterDoc, Artboard, JitterCustomComponent } from "../video/jitterJson";
import type { SceneReport } from "./jitterReferenceAnalyzer";

export interface ClipComposeInput {
  /** 0-based index in the reference. */
  index: number;
  /** Total clips. */
  total: number;
  /** Clip duration in ms — becomes the artboard duration. */
  durationMs: number;
  /** Vision analysis of this clip. */
  report: SceneReport;
  /** Local path to the clip mp4 — passed to the vision-aware composer. */
  clipPath: string;
  /** User-supplied content brief (e.g., "video for product X"). */
  userDescription: string;
  /** Brand from a sourceUrl scrape (optional). */
  brandHint?: {
    productName?: string;
    tagline?: string;
    features?: Array<{ title: string; description?: string }>;
    cta?: string;
  };
  /** Audio (with bpm) so this clip's composer aligns ops to the beat grid. */
  audio?: { url: string; bpm: number; volume?: number };
  /** Hero/logo images the user wants placed. */
  images?: string[];
  /** Stock images available to the composer. Each entry may be a bare URL or
   *  a `{url, topic}` pair so the composer can pick by relevance. */
  stockImages?: Array<string | { url: string; topic?: string }>;
  width?: number;
  height?: number;
}

function buildClipBrief(input: ClipComposeInput): JitterBrief {
  const { report, index, total, durationMs, userDescription } = input;
  const headlines = report.onScreenText.length
    ? `On-screen text seen in this section (you may reuse VERBATIM if it fits the user's content): ${JSON.stringify(report.onScreenText)}`
    : "";
  const transitions = report.motion.transitions.length
    ? `Transitions used: ${report.motion.transitions.join(", ")}`
    : "";
  const effects = report.effects.length
    ? `Special effects: ${report.effects.join(", ")}`
    : "";
  const componentSugg = report.componentSuggestions.length
    ? `\nReference suggested these custom components for this section (consider authoring):\n${report.componentSuggestions
        .map((c) => `  - ${c.name}: ${c.purpose}`)
        .join("\n")}`
    : "";

  const brand = {
    primary: report.palette.primary,
    secondary: report.palette.secondary,
    accent: report.palette.accent,
    background: report.palette.background,
    textColor: report.palette.textColor,
    fontFamily: report.typography.family,
  };

  const briefText = `RECREATE A REFERENCE VIDEO SECTION (clip ${index + 1} of ${total}).

You are SHOWN the reference clip directly. Watch it carefully. Recreate the EXACT same visual style, layout placements, motion vocabulary, and timing — but swap in the user's content described below.

USER CONTENT to swap in (substitute the reference's text/visuals with this):
${userDescription.trim()}
${
  input.brandHint?.productName
    ? `\nProduct name: ${input.brandHint.productName}`
    : ""
}${
    input.brandHint?.tagline ? `\nTagline: "${input.brandHint.tagline}"` : ""
  }${
    input.brandHint?.features?.length
      ? `\nFeatures:\n${input.brandHint.features.map((f) => `  • ${f.title}${f.description ? ` — ${f.description}` : ""}`).join("\n")}`
      : ""
  }${input.brandHint?.cta ? `\nCTA: ${input.brandHint.cta}` : ""}

REFERENCE SECTION (analyst pre-pass — use as anchor; trust your eyes for everything else):
${report.summary}
Mood: ${report.mood}. Layout: ${report.layout}.
Pacing: ${report.motion.pacing}/10. Motion: ${report.motion.description}
${transitions}
${effects}
${headlines}
${componentSugg}
${
  input.images?.length
    ? `\nUSER hero/logo images (place where the reference uses similar imagery):\n${input.images.map((u) => `  - ${u}`).join("\n")}`
    : ""
}${
    input.stockImages?.length
      ? `\nSTOCK images available — only drop one in if the reference clearly shows photography AND the topic matches this clip's content. If nothing matches, skip stock and stay typographic:\n${input.stockImages
          .map((e) => (typeof e === "string" ? `  - ${e}` : `  - ${e.url}  (topic: ${e.topic ?? "generic"})`))
          .join("\n")}`
      : ""
  }

OUTPUT REQUIREMENTS:
- This brief produces ONE artboard.
- The single artboard's duration MUST equal ${durationMs}ms exactly.
- MIRROR the reference's specific motion vocabulary — same entry kinds, same directions, same easings, same pacing.
- Author customComponents[] freely for any visual the primitives + builtins can't express (gradients, particle systems, blob morphs, etc.). This mode trades cost for fidelity.
- Use the brand palette (LOCKED above) for all colors.`;

  return {
    brief: briefText,
    width: input.width ?? 1920,
    height: input.height ?? 1080,
    durationMs,
    brand,
    copy: input.brandHint
      ? {
          productName: input.brandHint.productName,
          tagline: input.brandHint.tagline,
          features: input.brandHint.features,
          cta: input.brandHint.cta,
        }
      : undefined,
    audio: input.audio,
    stockImages: input.stockImages,
    allowCustomComponents: true,
  };
}

export interface ClipComposeOutput {
  artboard: Artboard;
  customComponents: JitterCustomComponent[];
}

/**
 * Compose ONE clip → returns { artboard, customComponents }. The caller
 * merges these across all clips into the final JitterDoc.
 */
export async function composeClip(
  input: ClipComposeInput,
): Promise<ClipComposeOutput> {
  console.log(
    `[refComposer] clip ${input.index + 1}/${input.total} composing (${input.durationMs}ms) with vision…`,
  );
  const brief = buildClipBrief(input);
  const result = await generateJitterDocWithMedia(
    brief,
    { type: "video", path: input.clipPath },
    {
      maxAttempts: 3,
      extraSystemNote:
        "REFERENCE-RECREATION MODE: You are shown the reference clip. Match its layout, motion, and feel. Trust your visual judgment over any text instruction when they conflict.",
    },
  );
  const arts = result.doc.conf.artboards;
  if (!arts.length) {
    throw new Error(
      `Composer returned 0 artboards for clip ${input.index + 1}`,
    );
  }
  // If the agent returned multiple artboards, flatten them down by absorbing
  // their durations into the first one and concatenating their layers/operations.
  const primary: Artboard = {
    ...arts[0],
    id: `ref-clip-${input.index + 1}`,
    name: `Reference clip ${input.index + 1}`,
    duration: input.durationMs,
    operations: [...arts[0].operations],
    layers: [...arts[0].layers],
  };
  if (arts.length > 1) {
    let cursorMs = arts[0].duration;
    for (let i = 1; i < arts.length; i++) {
      const next = arts[i];
      // Shift its operation times to sit after the cursor.
      for (const op of next.operations) {
        const shifted: any = { ...op, startTime: op.startTime + cursorMs };
        if (op.endTime != null) shifted.endTime = op.endTime + cursorMs;
        primary.operations.push(shifted);
      }
      primary.layers.push(...next.layers);
      cursorMs += next.duration;
    }
  }
  return {
    artboard: primary,
    customComponents: result.doc.customComponents ?? [],
  };
}

/**
 * Merge per-clip outputs into a single JitterDoc.
 */
export function mergeClipsToDoc(
  outputs: ClipComposeOutput[],
  audio: { url: string; bpm: number; volume?: number } | null,
  width = 1920,
  height = 1080,
  fps = 30,
): JitterDoc {
  // Dedupe customComponents by name (keep the first definition).
  const seen = new Set<string>();
  const customComponents: JitterCustomComponent[] = [];
  for (const c of outputs.flatMap((o) => o.customComponents)) {
    if (seen.has(c.name)) continue;
    seen.add(c.name);
    customComponents.push(c);
  }
  return {
    name: "Jitter — reference recreation",
    fps,
    audio: audio ? { url: audio.url, bpm: audio.bpm, volume: audio.volume ?? 0.6 } : null,
    customComponents,
    conf: {
      id: "root",
      version: 4,
      artboards: outputs.map((o) => ({ ...o.artboard, width, height })),
    },
  } as JitterDoc;
}
