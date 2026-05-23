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

import { z } from "zod";
import { chatWithGeminiProVision } from "./model";
import {
  generateJitterDoc,
  type JitterBrief,
  type JitterComposerResult,
} from "./jitterComposer";
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
import {
  reviewContentRelevance,
  applyContentFixes,
} from "./contentRelevanceChecker";

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

export async function analyzeBrandFromScreenshot(
  screenshotPath: string,
  opts: { hint?: string } = {},
): Promise<BrandReport> {
  console.log(`[urlToJitter] Analyzing brand from ${screenshotPath}`);
  const userPrompt = opts.hint
    ? `Extract the brand report. Additional hint: ${opts.hint}`
    : "Extract the brand report from this page screenshot.";

  const maxAttempts = 3;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await chatWithGeminiProVision(
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

  const backdrop = pickBackgroundForBrand(report.brand.mood, {
    background: report.brand.background,
    primary: report.brand.primary,
    secondary: report.brand.secondary,
    accent: report.brand.accent,
    textColor: report.brand.textColor,
  });
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
    backdrop: {
      templateId: backdrop.templateId,
      templateName: backdrop.templateName,
      variant: backdrop.variant,
      palette: backdrop.palette,
      intensity: backdrop.intensity,
    },
  };
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
}): Promise<UrlToJitterResult> {
  console.log(`[urlToJitter] URL: ${input.url}`);
  const brandReport = await analyzeBrandFromScreenshot(input.screenshotPath, {
    hint: `Page URL: ${input.url}`,
  });
  console.log(
    `[urlToJitter] Brand: ${brandReport.productName} | colors=${JSON.stringify(brandReport.brand)} | features=${brandReport.features.length}`,
  );

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
    music = await pickTrack({
      mood: input.musicMood ?? moodToMusicKeyword(brandReport.brand.mood),
      preferredBpm: input.preferredBpm ?? 124,
    });
    console.log(
      `[urlToJitter] Music: "${music.title}" @ ${music.bpm} BPM (beat=${Math.round(music.beatMs)}ms)`,
    );
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

  const composer = await generateJitterDoc(brief, { maxAttempts: 3 });

  // Content-relevance pass: scan every text / mockup / code layer and
  // strip placeholder content + rewrite invented text using verbatim
  // BrandReport copy. One extra LLM call.
  try {
    const review = await reviewContentRelevance(composer.doc, brandReport, {
      sourceUrl: input.url,
      heroImageUrl: input.heroImageUrl ?? null,
    });
    if (review.issues.length) {
      const counts = applyContentFixes(composer.doc, review);
      console.log(
        `[urlToJitter] content-relevance: ${review.issues.length} issues found → ${counts.rewritten} rewritten, ${counts.dropped} dropped`,
      );
    } else {
      console.log("[urlToJitter] content-relevance: clean (no issues)");
    }
  } catch (err) {
    console.warn(
      `[urlToJitter] content-relevance check failed (continuing): ${err instanceof Error ? err.message : err}`,
    );
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
