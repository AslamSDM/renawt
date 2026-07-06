/**
 * URL → JITTER VIDEO ORCHESTRATOR
 *
 * Pipeline:
 *   1. (caller) Capture page screenshot to disk + drop in public/jitter/.
 *   2. analyzeBrandFromScreenshot — Gemini Pro Vision extracts:
 *        - brand colors (primary/secondary/accent/background/textColor)
 *        - typography mood
 *        - product copy (headlines, features, CTA, price)
 *        - hero asset description
 *   3. synthesizeBrief → JitterBrief with brand-locked colors and verbatim copy.
 *   4. generateJitterDoc → validated JitterDoc.
 *
 * Result: a JitterDoc ready to render via:
 *   npx remotion render remotion/Root.tsx JitterComposition <out.mp4> --props=<doc.json>
 */

import { createHash } from "crypto";
import { readFileSync } from "fs";
import { z } from "zod";
import { chatWithGeminiProVision, chatWithOllamaCloudVision } from "./model";
import {
  generateJitterDoc,
  type JitterBrief,
  type JitterComposerResult,
} from "./jitterComposer";
import type { JitterDoc } from "../video/jitterJson";
import {
  pickTrack,
  moodToMusicKeyword,
  type PickedTrack,
} from "../audio/musicPicker";
import {
  resolveNarration,
  fetchStockImagesForTopics,
  buildCaptionsFromNarration,
  type NarrationInput,
  type UserAsset,
} from "./jitterAssets";
import { withLlmContext } from "../llm/tokenLogger";
import { pickTemplateInspirations, pickBackgroundForBrand } from "./jitterTemplateRegistry";
import { rollDesignSystem } from "./designSystem";
import { critiqueJitterDoc, applyCritique } from "./jitterCritic";
import { pickTemplateExamples } from "./jitterTemplateExamples";
import { noopProgress, type ProgressEmit } from "./progress";

/** Map BrandReport.brand.mood → which scraped jitter.video sections to mine for inspiration. */
const MOOD_TO_SECTIONS: Record<string, string[]> = {
  minimal: ["websites", "text", "ui-elements"],
  techy: ["jitter-ai", "devices", "websites"],
  premium: ["websites", "showreels", "video-titles"],
  bold: ["video-titles", "ads", "social-media"],
  playful: ["social-media", "icons", "text"],
  warm: ["social-media", "text", "logos"],
};

export const BrandReportSchema = z.object({
  productName: z.string(),
  tagline: z.string().optional(),
  headlines: z.array(z.string()).default([]),
  features: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().optional(),
      }),
    )
    .default([]),
  cta: z.string().optional(),
  price: z.string().optional(),
  brand: z.object({
    primary: z.string(),
    secondary: z.string().optional(),
    accent: z.string().optional(),
    background: z.string(),
    textColor: z.string(),
    fontFamily: z.string().default("Inter"),
    fontWeightDisplay: z.number().default(800),
    mood: z
      .enum(["minimal", "playful", "premium", "techy", "warm", "bold"])
      .default("minimal"),
  }),
  layout: z
    .enum(["centered", "split", "asymmetric", "magazine"])
    .default("centered"),
  heroDescription: z.string().optional(),
});

export type BrandReport = z.infer<typeof BrandReportSchema>;

const VISION_SYSTEM = `You are a senior brand & motion designer. Given a screenshot of a product page, extract a STRUCTURED brand report that another LLM will use to design a video.

Return ONLY a single JSON object — no markdown fences, no commentary — matching this shape:

{
  "productName": "string",
  "tagline": "string (the most prominent short phrase)",
  "headlines": ["string (verbatim H1/H2)"],
  "features": [{ "title": "string", "description": "string" }],
  "cta": "Buy",
  "price": "From ₹69900.00",
  "brand": {
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex",
    "background": "#hex (the dominant page background)",
    "textColor": "#hex (the dominant text color)",
    "fontFamily": "Inter (or the closest google font)",
    "fontWeightDisplay": 800,
    "mood": "minimal|playful|premium|techy|warm|bold"
  },
  "layout": "centered|split|asymmetric|magazine",
  "heroDescription": "Describe the hero asset in 1-2 sentences (used for motion direction)."
}

RULES:
- All colors as #RRGGBB hex strings sampled from the screenshot.
- Use VERBATIM headlines and product name from the page — don't translate or paraphrase.
- If a value is genuinely absent in the screenshot, omit the key (do not invent).`;

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

/** In-process cache of vision brand analysis, keyed by screenshot bytes + hint.
 *  Same screenshot ⇒ same BrandReport, so this safely skips a Gemini Vision
 *  call on warm instances / retries. Cold starts simply repopulate it. */
const brandReportCache = new Map<string, BrandReport>();

function brandCacheKey(screenshotPath: string, hint?: string): string | null {
  try {
    const buf = readFileSync(screenshotPath);
    return createHash("sha1").update(buf).update(hint ?? "").digest("hex");
  } catch {
    return null;
  }
}

export async function analyzeBrandFromScreenshot(
  screenshotPath: string,
  opts: { hint?: string } = {},
): Promise<BrandReport> {
  console.log(`[urlToJitter] Analyzing brand from ${screenshotPath}`);
  const cacheKey = brandCacheKey(screenshotPath, opts.hint);
  if (cacheKey) {
    const hit = brandReportCache.get(cacheKey);
    if (hit) {
      console.log(
        `[urlToJitter] Brand report cache hit (${cacheKey.slice(0, 8)})`,
      );
      return hit;
    }
  }
  const userPrompt = opts.hint
    ? `Extract the brand report. Additional hint: ${opts.hint}`
    : "Extract the brand report from this page screenshot.";

  const maxAttempts = 3;
  let lastError: unknown = null;
  // Route vision to Ollama Cloud (Kimi K2.6) when OLLAMA_VISION_PROVIDER=ollama-cloud.
  // Kimi returns a separate `reasoning` field; chatWithOllamaCloudVision handles that
  // and surfaces the final answer in `content`. High max_tokens leaves room for the
  // reasoning budget so it doesn't starve the JSON output (the 402 OpenRouter credit
  // failure that prompted this switch capped us at 1331 tokens — Ollama Cloud has no
  // such limit).
  const useOllamaCloudVision =
    process.env.OLLAMA_VISION_PROVIDER === "ollama-cloud";
  const visionConfig = {
    temperature: Number(process.env.OLLAMA_VISION_TEMPERATURE || 0.3),
    maxTokens: Number(process.env.OLLAMA_VISION_MAX_TOKENS || 8000),
    model: process.env.OLLAMA_CLOUD_VISION_MODEL || "kimi-k2.6",
  };
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = useOllamaCloudVision
        ? await chatWithOllamaCloudVision(
            { type: "image", path: screenshotPath },
            userPrompt,
            VISION_SYSTEM,
            visionConfig,
          )
        : await chatWithGeminiProVision(
            { type: "image", path: screenshotPath },
            userPrompt,
            VISION_SYSTEM,
            { temperature: 0.2, maxTokens: 4000 },
          );
      const parsed = BrandReportSchema.safeParse(
        JSON.parse(extractJsonBlock(resp.content)),
      );
      if (!parsed.success) {
        const issues = parsed.error.issues
          .slice(0, 8)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("\n");
        throw new Error(`Brand report schema invalid:\n${issues}`);
      }
      if (cacheKey) brandReportCache.set(cacheKey, parsed.data);
      return parsed.data;
    } catch (err) {
      lastError = err;
      console.warn(
        `[urlToJitter] Brand vision attempt ${attempt} failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
  throw new Error(
    `analyzeBrandFromScreenshot failed: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

export function briefFromBrandReport(
  report: BrandReport,
  opts: {
    durationMs?: number;
    heroImageUrl?: string | null;
    extraNotes?: string;
    width?: number;
    height?: number;
  } = {},
): JitterBrief {
  const dur = opts.durationMs ?? 15000;
  const heroLine = report.heroDescription
    ? `Hero asset: ${report.heroDescription}`
    : "";
  const featureLines = report.features
    .map((f) => `  • ${f.title}${f.description ? ` — ${f.description}` : ""}`)
    .join("\n");
  const headlineLines = report.headlines
    .map((h) => `  • "${h}"`)
    .join("\n");
  const briefText = `Product launch video for ${report.productName}.
${report.tagline ? `Tagline: "${report.tagline}".` : ""}
Brand mood: ${report.brand.mood}. Layout style: ${report.layout}.
${heroLine}

Headlines (use verbatim where they fit):
${headlineLines}

Features (use as scenes 2-${Math.max(2, Math.round(dur / 4000) - 1)}):
${featureLines}

${report.cta ? `Closing CTA: "${report.cta}"${report.price ? ` — ${report.price}` : ""}.` : ""}
${opts.extraNotes ? `\nAdditional direction: ${opts.extraNotes}` : ""}

Match the source page's design language exactly: same colors, same typographic weight, same level of whitespace. Use customComponents for elevated CSS effects (animated gradients, glow halos, glass cards, gradient text).`;

  // Roll ONE coherent visual style for the whole video. Mood biases the pick
  // but never locks it, so two videos for the same brand still look different.
  const design = rollDesignSystem({ mood: report.brand.mood });
  console.log(
    `[urlToJitter] designSystem: "${design.styleName}" fonts=${design.fonts.display}/${design.fonts.body} layout=${design.layout} motion=${design.motion.entries.join("+")} backdrop=${design.backdrop.variant}@${design.backdrop.intensity}`,
  );

  // Backdrop look comes from the rolled design system (variant/intensity/seed)
  // so the background matches the chosen style — palette still blends brand.
  const backdrop = pickBackgroundForBrand(
    report.brand.mood,
    {
      background: report.brand.background,
      primary: report.brand.primary,
      secondary: report.brand.secondary,
      accent: report.brand.accent,
      textColor: report.brand.textColor,
    },
    {
      variant: design.backdrop.variant,
      intensity: design.backdrop.intensity,
      seed: design.backdrop.seed,
    },
  );
  console.log(
    `[urlToJitter] backdrop: template=${backdrop.templateName} variant=${backdrop.variant} palette=[${backdrop.palette.join(", ")}] (${backdrop.sourceUrl})`,
  );

  const sections = MOOD_TO_SECTIONS[report.brand.mood] ?? [
    "websites",
    "ui-elements",
    "text",
  ];
  const inspirations = pickTemplateInspirations(sections, {
    perSection: 2,
    minLayers: 8,
  }).map((t) => ({
    id: t.id,
    name: t.name,
    sections: t.sections,
    palette: t.palette,
    artboardCount: t.artboardCount,
    layerCount: t.layerCount,
    opCount: t.opCount,
    totalDurationMs: t.totalDurationMs,
  }));
  if (inspirations.length) {
    console.log(
      `[urlToJitter] templateInspirations: ${inspirations.length} from sections=${sections.join(",")}`,
    );
  }

  const templateExamples = pickTemplateExamples({
    sections,
    mood: report.brand.mood,
    width: opts.width ?? 1920,
    height: opts.height ?? 1080,
    limit: 2,
  });
  if (templateExamples.length) {
    console.log(
      `[urlToJitter] templateExamples: ${templateExamples
        .map((e) => e.name)
        .join(", ")}`,
    );
  }

  return {
    brief: briefText,
    width: opts.width ?? 1920,
    height: opts.height ?? 1080,
    durationMs: dur,
    brand: report.brand,
    copy: {
      productName: report.productName,
      tagline: report.tagline,
      headlines: report.headlines,
      features: report.features,
      cta: report.cta,
      price: report.price,
    },
    heroImage: opts.heroImageUrl ?? null,
    allowCustomComponents: true,
    templateInspirations: inspirations,
    templateExamples,
    design,
    backdrop: {
      templateId: backdrop.templateId,
      templateName: backdrop.templateName,
      variant: backdrop.variant,
      palette: backdrop.palette,
      intensity: backdrop.intensity,
      seed: backdrop.seed,
    },
  };
}

// ============================================================
// Long-video chunking
// ------------------------------------------------------------
// A single LLM call reliably composes ~15s (2-4 scenes). Past that, flash
// models truncate or under-deliver (1 scene for a 30s brief). So for long
// videos we generate beat-aligned ≤15s SEGMENTS — each a small, reliable call
// that's told what comes BEFORE and AFTER it and to keep the exact brand
// colors/fonts — then merge the segment docs into one continuous JitterDoc.
// Merging (not mp4 concat) keeps everything downstream single-doc: one render,
// one stored doc, one editable timeline.
// ============================================================

const CHUNK_TARGET_MS = 15000;

/** Split a list into k near-equal CONTIGUOUS groups (preserves narrative order). */
function splitContiguous<T>(items: T[], k: number): T[][] {
  const groups: T[][] = Array.from({ length: k }, () => []);
  if (items.length === 0) return groups;
  const per = Math.ceil(items.length / k);
  for (let i = 0; i < items.length; i++) {
    groups[Math.min(k - 1, Math.floor(i / per))].push(items[i]);
  }
  return groups;
}

/** Beat-aligned per-segment durations summing exactly to totalMs. */
function splitDurations(totalMs: number, k: number, beatMs?: number): number[] {
  if (k <= 1) return [totalMs];
  let per = Math.round(totalMs / k);
  if (beatMs && beatMs > 0) {
    per = Math.max(beatMs * 4, Math.round(per / beatMs) * beatMs);
  }
  const minTail = beatMs ? beatMs * 4 : 2000;
  const out: number[] = [];
  let remaining = totalMs;
  for (let i = 0; i < k - 1; i++) {
    const d = Math.max(minTail, Math.min(per, remaining - (k - 1 - i) * minTail));
    out.push(d);
    remaining -= d;
  }
  out.push(remaining);
  return out;
}

interface ChunkPlan {
  features: BrandReport["features"];
  includeHook: boolean;
  includeCta: boolean;
  /** One-line description of this segment, used as before/after context for neighbors. */
  focus: string;
}

function planChunks(report: BrandReport, k: number): ChunkPlan[] {
  const groups = splitContiguous(report.features, k);
  return groups.map((features, i) => {
    const includeHook = i === 0;
    const includeCta = i === k - 1;
    const titles = features.map((f) => f.title).filter(Boolean);
    let focus: string;
    if (includeHook) {
      focus = `open with the hook "${report.tagline || report.headlines[0] || report.productName}"${
        titles.length ? `, then introduce ${titles.join(", ")}` : ""
      }`;
    } else if (includeCta) {
      focus = `${titles.length ? `cover ${titles.join(", ")}, then ` : ""}close with the CTA "${
        report.cta || "Get started"
      }"${report.price ? ` (${report.price})` : ""}`;
    } else {
      focus = titles.length ? `showcase ${titles.join(", ")}` : "continue the product story";
    }
    return { features, includeHook, includeCta, focus };
  });
}

/**
 * Continuity-aware brief for ONE segment. Reuses the base brief's brand,
 * backdrop, inspirations, audio and assets verbatim so every segment renders
 * identically — only the copy slice, duration and narrative framing change.
 */
function makeChunkBrief(
  base: JitterBrief,
  report: BrandReport,
  plans: ChunkPlan[],
  idx: number,
  durationMs: number,
  heroImage: string | null,
): JitterBrief {
  const total = plans.length;
  const plan = plans[idx];
  const prev = idx > 0 ? plans[idx - 1] : null;
  const next = idx < total - 1 ? plans[idx + 1] : null;
  const durSec = Math.round((base.durationMs ?? durationMs) / 1000);
  const brandStr = [
    report.brand.primary,
    report.brand.secondary,
    report.brand.accent,
    report.brand.background,
  ]
    .filter(Boolean)
    .join(", ");

  const styleFont = base.design
    ? `${base.design.fonts.display} / ${base.design.fonts.body} (per the DESIGN SYSTEM)`
    : report.brand.fontFamily;
  const briefText = `Segment ${idx + 1} of ${total} of ONE continuous ${durSec}s brand video for ${report.productName}.
This segment is stitched end-to-end with the others, so it MUST look like the same video: identical backdrop, the exact brand palette (${brandStr}), the same DESIGN SYSTEM style${base.design ? ` ("${base.design.styleName}")` : ""} and fonts (${styleFont}). Never restyle, recolor, or switch fonts/sizes/motion between segments.
${
  idx === 0
    ? "This is the OPENING segment — establish the product."
    : `JUST BEFORE this segment the video did: ${prev?.focus}. Continue smoothly from there — do NOT re-introduce or re-title the product; pick up the momentum.`
}
${
  idx === total - 1
    ? "This is the FINAL segment — end on the CTA with a confident closing hold."
    : `RIGHT AFTER this segment the video will: ${next?.focus}. End this segment on a clean hand-off (a held beat / outgoing transition), not a hard stop.`
}
THIS SEGMENT should ${plan.focus}.
Match the source page's design language exactly. Use customComponents for elevated CSS effects (animated gradients, glow halos, glass cards, gradient text).`;

  return {
    ...base,
    brief: briefText,
    durationMs,
    heroImage,
    narration: null, // narration spans the whole video — attached to the merged doc
    copy: {
      productName: report.productName,
      tagline: plan.includeHook ? report.tagline : undefined,
      headlines: plan.includeHook ? report.headlines : [],
      features: plan.features,
      cta: plan.includeCta ? report.cta : undefined,
      price: plan.includeCta ? report.price : undefined,
    },
  };
}

/**
 * Merge per-segment docs into one continuous JitterDoc. Each segment's layer /
 * artboard / operation ids and AI-authored component names are namespaced
 * (`c{i}-…` / `C{i}…`) so nothing collides, then artboards are concatenated in
 * order. Audio, fps and name come from the first segment.
 */
function mergeChunkDocs(docs: JitterDoc[]): JitterDoc {
  const merged: JitterDoc = JSON.parse(JSON.stringify(docs[0]));
  merged.customComponents = [];
  merged.conf.artboards = [];

  docs.forEach((doc, idx) => {
    const localCustom = new Set(doc.customComponents.map((c) => c.name));
    const compName = (n: string) => `C${idx}${n}`;
    const refId = (n: string) => `c${idx}-${n}`;

    for (const c of doc.customComponents) {
      merged.customComponents.push({ ...c, name: compName(c.name) });
    }

    const walkLayers = (layers: any[]) => {
      for (const l of layers) {
        if (!l || typeof l !== "object") continue;
        if (l.id) l.id = refId(l.id);
        if (l.type === "custom" && localCustom.has(l.component)) {
          l.component = compName(l.component);
        }
        if (Array.isArray(l.layers)) walkLayers(l.layers);
      }
    };

    for (const art of doc.conf.artboards) {
      art.id = refId(art.id);
      for (const op of art.operations) {
        op.id = refId(op.id);
        op.targetId = refId(op.targetId);
      }
      walkLayers(art.layers);
      merged.conf.artboards.push(art);
    }
  });

  return merged;
}

export interface UrlToJitterResult {
  brandReport: BrandReport;
  brief: JitterBrief;
  composer: JitterComposerResult;
  music: PickedTrack | null;
}

/**
 * One-call orchestrator. Caller is responsible for capturing the screenshot
 * (Playwright / Puppeteer / manual). Pass the local PATH to that screenshot
 * plus optionally the public URL that the renderer can fetch it from.
 *
 * Flow:
 *   1. Vision → BrandReport.
 *   2. Pick a music track matching mood (returns BPM).
 *   3. Build brief WITH audio + BPM so composer aligns ops to the beat grid.
 *   4. Compose JitterDoc (with post-snap safety net).
 */
export async function generateVideoFromScreenshot(input: {
  url: string;
  screenshotPath: string;
  heroImageUrl?: string | null;
  durationMs?: number;
  extraNotes?: string;
  width?: number;
  height?: number;
  /** Set false to skip background music. Default true. */
  music?: boolean;
  /** Override the music mood keyword (otherwise derived from brand mood). */
  musicMood?: string;
  /** Override the preferred BPM. Default 124. */
  preferredBpm?: number;
  /**
   * Caller-supplied audio. If present, this is used directly and the picker
   * is skipped — composer aligns to THIS BPM up front (no post-compose swap).
   */
  audioOverride?: { url: string; bpm: number; volume?: number; title?: string } | null;
  /** Optional narration — text to TTS, or a pre-existing audio URL. */
  narration?: NarrationInput | null;
  /** Stock-image topics to query Unsplash for (e.g. ["minimalist office", "abstract gradient"]). */
  stockImageTopics?: string[];
  /** Caller-supplied stock image URLs (if you already have a list). */
  stockImageUrls?: string[];
  /** User-uploaded named assets (logos, photos, screen recordings) the agent can reference by alias. */
  userAssets?: UserAsset[];
  /** Caption track config. Caller passes `enabled`+`style`; chunks are auto-derived from narration. */
  captions?: {
    enabled?: boolean;
    style?: "bottom" | "centered" | "minimal";
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    background?: string;
  } | null;
  /** Tag used in narration filename. Defaults to a timestamp. */
  jobId?: string;
  /** For LLM token-usage logging. */
  userId?: string;
  projectId?: string;
  /** Optional progress sink — emits a step event at each pipeline stage. */
  onProgress?: ProgressEmit;
}): Promise<UrlToJitterResult> {
  return withLlmContext(
    {
      label: `urlToJitter:${input.jobId ?? "anon"}`,
      userId: input.userId,
      projectId: input.projectId,
    },
    () => runUrlToJitter(input),
  );
}

async function runUrlToJitter(input: {
  url: string;
  screenshotPath: string;
  heroImageUrl?: string | null;
  durationMs?: number;
  extraNotes?: string;
  width?: number;
  height?: number;
  music?: boolean;
  musicMood?: string;
  preferredBpm?: number;
  audioOverride?: { url: string; bpm: number; volume?: number; title?: string } | null;
  narration?: NarrationInput | null;
  stockImageTopics?: string[];
  stockImageUrls?: string[];
  userAssets?: UserAsset[];
  captions?: {
    enabled?: boolean;
    style?: "bottom" | "centered" | "minimal";
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    background?: string;
  } | null;
  jobId?: string;
  userId?: string;
  projectId?: string;
  onProgress?: ProgressEmit;
}): Promise<UrlToJitterResult> {
  const emit = input.onProgress ?? noopProgress;
  console.log(`[urlToJitter] URL: ${input.url}`);

  await emit({ step: "brand", label: "Analyze brand", status: "running" });
  const brandReport = await analyzeBrandFromScreenshot(input.screenshotPath, {
    hint: `Page URL: ${input.url}`,
  });
  console.log(
    `[urlToJitter] Brand: ${brandReport.productName} | colors=${JSON.stringify(brandReport.brand)} | features=${brandReport.features.length}`,
  );
  await emit({
    step: "brand",
    label: "Analyze brand",
    status: "done",
    detail: `${brandReport.productName} · ${brandReport.brand.mood} · ${brandReport.features.length} features`,
    output: {
      productName: brandReport.productName,
      tagline: brandReport.tagline,
      mood: brandReport.brand.mood,
      colors: brandReport.brand,
      headlines: brandReport.headlines,
      features: brandReport.features?.map((f) => f.title),
      cta: brandReport.cta,
    },
  });

  let music: PickedTrack | null = null;
  if (input.audioOverride) {
    music = {
      url: input.audioOverride.url,
      bpm: input.audioOverride.bpm,
      beatMs: 60000 / input.audioOverride.bpm,
      title: input.audioOverride.title ?? "User-selected track",
      moods: [],
    };
    console.log(
      `[urlToJitter] Music (user-picked): "${music.title}" @ ${music.bpm} BPM (beat=${Math.round(music.beatMs)}ms)`,
    );
  } else if (input.music !== false) {
    await emit({ step: "music", label: "Pick music", status: "running" });
    music = await pickTrack({
      mood: input.musicMood ?? moodToMusicKeyword(brandReport.brand.mood),
      preferredBpm: input.preferredBpm ?? 124,
    });
    console.log(
      `[urlToJitter] Music: "${music.title}" @ ${music.bpm} BPM (beat=${Math.round(music.beatMs)}ms)`,
    );
  }
  if (music) {
    await emit({
      step: "music",
      label: "Pick music",
      status: "done",
      detail: `${music.title} @ ${music.bpm} BPM`,
      output: { title: music.title, bpm: music.bpm, moods: music.moods },
    });
  }

  // Round requested duration to a whole beat so artboards sum cleanly.
  const reqDur = input.durationMs ?? 15000;
  const alignedDur = music
    ? Math.max(
        music.beatMs * 8,
        Math.round(reqDur / music.beatMs) * music.beatMs,
      )
    : reqDur;
  if (music && alignedDur !== reqDur) {
    console.log(
      `[urlToJitter] Duration aligned: ${reqDur}ms → ${Math.round(alignedDur)}ms (${Math.round(alignedDur / music.beatMs)} beats)`,
    );
  }

  const brief = briefFromBrandReport(brandReport, {
    durationMs: Math.round(alignedDur),
    heroImageUrl: input.heroImageUrl,
    extraNotes: input.extraNotes,
    width: input.width,
    height: input.height,
  });

  if (music) {
    brief.audio = {
      url: music.url,
      bpm: music.bpm,
      volume: input.audioOverride?.volume ?? 0.6,
    };
  }

  // Stock images: explicit URLs first, otherwise topic-based search. Keep
  // entries as {url, topic} pairs so the composer can match images to scenes.
  const stockImages: Array<string | { url: string; topic: string }> = [];
  const seenStockUrls = new Set<string>();
  if (input.stockImageUrls?.length) {
    for (const url of input.stockImageUrls) {
      if (!url || seenStockUrls.has(url)) continue;
      seenStockUrls.add(url);
      stockImages.push(url);
    }
  }
  if (input.stockImageTopics?.length) {
    const fetched = await fetchStockImagesForTopics(input.stockImageTopics, 3);
    for (const entry of fetched) {
      if (seenStockUrls.has(entry.url)) continue;
      seenStockUrls.add(entry.url);
      stockImages.push(entry);
    }
  }
  if (stockImages.length) {
    brief.stockImages = stockImages;
    console.log(
      `[urlToJitter] ${stockImages.length} stock images attached`,
    );
  }

  // Narration (TTS or pre-existing).
  const narrationTag = input.jobId || `narration-${Date.now()}`;
  const narration = await resolveNarration(input.narration, narrationTag);
  if (narration) {
    brief.narration = narration;
    console.log(
      `[urlToJitter] narration ready (${narration.url}, ~${narration.estimatedDurationSec ?? "?"}s)`,
    );
  }

  // User-uploaded named assets (logos, screen recordings, photos). Composer
  // can drop them as image layers by URL when the prompt mentions the alias.
  if (input.userAssets?.length) {
    brief.userAssets = input.userAssets;
    console.log(
      `[urlToJitter] ${input.userAssets.length} user assets attached: ${input.userAssets
        .map((a) => `${a.alias}(${a.kind})`)
        .join(", ")}`,
    );
  }

  await emit({ step: "compose", label: "Compose JitterDoc", status: "running" });

  // Long videos: compose in beat-aligned ≤15s segments and merge. Short ones:
  // a single composer call as before.
  const fullDur = brief.durationMs ?? Math.round(alignedDur);
  const chunkCount =
    fullDur > CHUNK_TARGET_MS ? Math.ceil(fullDur / CHUNK_TARGET_MS) : 1;

  let composer: JitterComposerResult;
  if (chunkCount > 1) {
    const durations = splitDurations(fullDur, chunkCount, music?.beatMs);
    const plans = planChunks(brandReport, chunkCount);
    console.log(
      `[urlToJitter] Long video ${fullDur}ms → ${chunkCount} segments [${durations
        .map((d) => Math.round(d / 1000) + "s")
        .join(", ")}]`,
    );
    await emit({
      step: "compose",
      label: "Compose JitterDoc",
      status: "running",
      detail: `composing ${chunkCount} segments in parallel`,
    });
    // Segment briefs are built from static plan context (prev/next focus), not
    // from each other's output, so they compose independently — run in parallel.
    const chunkBriefs = plans.map((_, i) =>
      makeChunkBrief(
        brief,
        brandReport,
        plans,
        i,
        durations[i],
        i === 0 ? (input.heroImageUrl ?? null) : null,
      ),
    );
    const chunkResults = await Promise.all(
      chunkBriefs.map((cb, i) =>
        generateJitterDoc(cb, { maxAttempts: 3 }).then((res) => {
          console.log(
            `[urlToJitter] segment ${i + 1}/${chunkCount}: ${res.doc.conf.artboards.length} scenes (${res.attempts} attempt(s))`,
          );
          return res;
        }),
      ),
    );
    const chunkDocs: JitterDoc[] = chunkResults.map((r) => r.doc);
    const totalAttempts = chunkResults.reduce((s, r) => s + r.attempts, 0);
    const lastRaw = chunkResults.length
      ? chunkResults[chunkResults.length - 1].rawText
      : "";
    const mergedDoc = mergeChunkDocs(chunkDocs);
    const totalFrames = mergedDoc.conf.artboards.reduce(
      (s, a) => s + Math.max(1, Math.round((a.duration * mergedDoc.fps) / 1000)),
      0,
    );
    console.log(
      `[urlToJitter] merged ${chunkCount} segments → ${mergedDoc.conf.artboards.length} scenes, ${mergedDoc.customComponents.length} components`,
    );
    composer = { doc: mergedDoc, totalFrames, attempts: totalAttempts, rawText: lastRaw };
  } else {
    composer = await generateJitterDoc(brief, { maxAttempts: 3 });
  }
  {
    const ab = composer.doc.conf.artboards;
    await emit({
      step: "compose",
      label: "Compose JitterDoc",
      status: "done",
      detail: `${ab.length} scenes · ${ab.reduce((s, a) => s + a.operations.length, 0)} ops · ${composer.doc.customComponents.length} components`,
      output: {
        name: composer.doc.name,
        scenes: ab.map((a) => ({
          name: a.name,
          durationMs: a.duration,
          layers: a.layers.length,
          operations: a.operations.length,
        })),
        customComponents: composer.doc.customComponents.map((c) => c.name),
      },
    });
  }

  // Critic pass (merged content-relevance + scene critic): ONE LLM call scans
  // the doc scene-by-scene and fixes placeholder/invented copy, empty mockups,
  // wrong domains, fabricated stats, weak endings and duplicate headlines.
  await emit({ step: "critique", label: "Critique", status: "running" });
  try {
    const critique = await critiqueJitterDoc(composer.doc, brandReport, {
      sourceUrl: input.url,
      heroImageUrl: input.heroImageUrl ?? null,
    });
    if (critique.issues.length) {
      const counts = applyCritique(composer.doc, critique);
      console.log(
        `[urlToJitter] critique: ${critique.issues.length} issues → ${counts.rewritten} rewritten, ${counts.statsFixed} stats fixed, ${counts.screenshotsFixed} screenshots set, ${counts.dropped} dropped`,
      );
      await emit({
        step: "critique",
        label: "Critique",
        status: "done",
        detail: `${critique.issues.length} issues · ${counts.rewritten} rewritten · ${counts.statsFixed} stats · ${counts.dropped} dropped`,
        output: { issues: critique.issues },
      });
    } else {
      console.log("[urlToJitter] critique: clean (no issues)");
      await emit({
        step: "critique",
        label: "Critique",
        status: "done",
        detail: "clean — no issues",
      });
    }
  } catch (err) {
    console.warn(
      `[urlToJitter] critique failed (continuing): ${err instanceof Error ? err.message : err}`,
    );
    await emit({
      step: "critique",
      label: "Critique",
      status: "failed",
      detail: err instanceof Error ? err.message : "critique failed (skipped)",
    });
  }

  // Force narration into the doc — composer can forget the field or drop
  // durationMs, but we need the authoritative spec for music ducking.
  if (narration) {
    composer.doc.narration = narration;
  }

  // Captions — auto-derive from the narration text if the caller asked for them.
  const captionsCfg = input.captions;
  if (captionsCfg?.enabled !== false && narration && input.narration?.text) {
    const totalMs =
      narration.durationMs ?? Math.round((narration.estimatedDurationSec ?? 0) * 1000);
    if (totalMs > 0) {
      const chunks = buildCaptionsFromNarration(input.narration.text, totalMs, {
        startMs: narration.startMs ?? 0,
      });
      if (chunks.length) {
        composer.doc.captions = {
          enabled: captionsCfg?.enabled ?? true,
          style: captionsCfg?.style ?? "bottom",
          fontFamily: captionsCfg?.fontFamily,
          fontSize: captionsCfg?.fontSize,
          color: captionsCfg?.color,
          background: captionsCfg?.background,
          chunks,
        };
        console.log(
          `[urlToJitter] captions attached (${chunks.length} chunks, style=${composer.doc.captions.style})`,
        );
      }
    }
  }
  return { brandReport, brief, composer, music };
}
