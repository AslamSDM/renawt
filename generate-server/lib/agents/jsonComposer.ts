/**
 * JSON COMPOSER AGENT
 *
 * Replaces the LLM-driven Remotion code generator. Emits a Video JSON
 * (validated against the registry's per-component prop schemas) plus
 * any AI-defined custom components. A deterministic codegen step then
 * wraps the JSON into a self-contained Remotion file for the renderer.
 */

import { z } from "zod";
import { chatWithGeminiPro, CODE_GENERATOR_CONFIG } from "./model";
import type { VideoGenerationStateType } from "./state";
import { BUILTIN_COMPONENTS } from "../video/registry";
import {
  buildRegistryPrompt,
  CUSTOM_COMPONENT_GUIDE,
} from "../video/registryPrompt";
import {
  VideoJsonSchema,
  type VideoJson,
  totalFrames,
} from "../video/videoJson";
import { buildRemotionCode } from "../video/codegen";

const SYSTEM_PROMPT = `You are a video composition designer. You output a JSON description of a Remotion video using a fixed registry of built-in components plus optional AI-authored custom components.

OUTPUT a single JSON object matching this shape (no commentary, no markdown):
{
  "fps": 30,
  "width": 1920,
  "height": 1080,
  "audio": { "url": "...", "bpm": 120 } | null,
  "scenes": [
    {
      "id": "intro",
      "durationInFrames": 90,
      "layers": [
        { "component": "GradientBg", "props": { "from": "#000", "to": "#222" } },
        { "component": "Title", "props": { "text": "Hello", "delay": 5 } }
      ]
    }
  ],
  "customComponents": []
}

DURATION RULE (STRICT):
- The brief specifies a TARGET duration in frames. The sum of \`scenes[].durationInFrames\` MUST equal this target EXACTLY.
- If audio BPM is given, snap each scene to a multiple of framesPerBeat AND ensure the total still hits the target (use one final adjustment scene to absorb remainder).
- Do NOT under-fill (silent end) or over-fill (cut audio mid-beat).

PRODUCT FIT RULE:
- The brief includes \`productType\` ("saas" | "ecommerce" | "service" | "other") and a raw description.
- Match the visual language to the product — do NOT default to a SaaS dashboard pitch.
  - ecommerce / hardware / physical: lead with product imagery (ImageBg with product photos), tactile language, materials, usage scenes. Avoid "dashboards", "API", "workflows".
  - saas: feature cards, screenshot mockups (BrowserMockup), KPI stats.
  - service: testimonials, outcome metrics (NumberCounter), trust signals.
  - other: stay grounded in the actual description; no SaaS clichés.
- Pull every concrete noun and benefit verbatim from the product description and features. Do not invent generic copy.

RULES:
- Each scene is a stack of layers rendered in order (first = bottom).
- Always start a scene with a background layer (GradientBg/SolidBg/ImageBg) unless intentional.
- durationInFrames at 30fps: 30 = 1s.
- Reference each component by EXACT name; props must match the listed shape.
- Coordinates: x/y accept "50%" or "120px". Center is "50%"/"50%".
- If a built-in cannot express the design, define a customComponent and reference it by name.
- Output ONLY the JSON object. No prose, no \`\`\` fences.`;

function extractScriptText(videoScript: any): {
  tagline: string;
  introSubtext: string;
  features: Array<{ title: string; description: string }>;
  ctaHeadline: string;
  ctaSubtext: string;
} {
  const scenes = videoScript?.scenes || [];
  const intro = scenes.find((s: any) => s.type === "intro");
  const features = scenes.filter((s: any) => s.type === "feature");
  const cta = scenes.find((s: any) => s.type === "cta");
  return {
    tagline: intro?.content?.headline || "Build faster",
    introSubtext: intro?.content?.subtext || "",
    features: features.map((f: any) => ({
      title: f.content?.headline || "Feature",
      description: f.content?.subtext || "",
    })),
    ctaHeadline: cta?.content?.headline || "Get started",
    ctaSubtext: cta?.content?.subtext || "",
  };
}

function resolveTargetFrames(state: VideoGenerationStateType): number {
  const fromScript = (state.videoScript as any)?.totalDuration;
  if (typeof fromScript === "number" && fromScript > 0) return fromScript;
  const fromPrefs = (state.userPreferences as any)?.duration;
  if (typeof fromPrefs === "number" && fromPrefs > 0) return fromPrefs * 30;
  return 900; // 30s fallback
}

function vertictalGuidance(productType: string | undefined): string {
  switch (productType) {
    case "ecommerce":
      return "VERTICAL: ecommerce / physical product. Lead with product imagery via ImageBg + Title overlay. Use Quote / TestimonialCard for social proof, NumberCounter for stats (units sold, ratings). AVOID BrowserMockup, CodeBlock, dashboards. Materials, build, in-use shots are the focus.";
    case "service":
      return "VERTICAL: service business. Lead with outcomes (NumberCounter, StatCard, ProgressBar). TestimonialCard is essential. CTABanner with booking/contact framing.";
    case "saas":
      return "VERTICAL: SaaS. BrowserMockup or screenshot ImageBg, FeatureCard list, NumberCounter for KPIs, CodeBlock if developer-facing.";
    default:
      return "VERTICAL: generic. Stay strictly grounded in the product description — do NOT invent SaaS-style features.";
  }
}

function buildContextPrompt(state: VideoGenerationStateType): string {
  const scriptText = extractScriptText(state.videoScript);
  const audio = state.userPreferences.audio;
  const recordings = state.recordings || [];
  const pd: any = state.productData || {};
  const targetFrames = resolveTargetFrames(state);
  const targetSeconds = (targetFrames / 30).toFixed(1);

  const lines: string[] = [
    "## VIDEO BRIEF",
    `TARGET DURATION: ${targetFrames} frames (${targetSeconds}s @ 30fps) — sum(scenes[].durationInFrames) MUST equal ${targetFrames}.`,
    `Style: ${state.userPreferences.style}`,
    `Video type: ${state.userPreferences.videoType || "creative"}`,
    `Aspect ratio: ${(state.userPreferences as any).aspectRatio || "16:9"}`,
    "",
    "## PRODUCT",
    `Name: ${pd.name || "Untitled"}`,
    `Tagline: ${pd.tagline || "(none)"}`,
    `Type: ${pd.productType || "unknown"}`,
    vertictalGuidance(pd.productType),
    `Description: ${pd.description || "(none)"}`,
  ];

  if (Array.isArray(pd.features) && pd.features.length) {
    lines.push("Features (use these EXACT terms — no SaaS substitutions):");
    for (const f of pd.features) {
      lines.push(`  - ${f.title}: ${f.description}`);
    }
  }

  if (Array.isArray(pd.testimonials) && pd.testimonials.length) {
    lines.push("Testimonials:");
    for (const t of pd.testimonials) {
      lines.push(`  - "${t.quote}" — ${t.author}, ${t.role}`);
    }
  }

  if (Array.isArray(pd.images) && pd.images.length) {
    lines.push(
      "Product images (use as ImageBg.src or PhoneMockup.src for physical-product visuals):",
      ...pd.images.slice(0, 6).map((u: string) => `  - ${u}`),
    );
  }

  lines.push(
    "",
    "## SCRIPT (text content from upstream writer)",
    `Tagline: ${scriptText.tagline}`,
    `Intro subtext: ${scriptText.introSubtext}`,
    `Features:`,
    ...scriptText.features.map(
      (f, i) => `  ${i + 1}. ${f.title} — ${f.description}`,
    ),
    `CTA: ${scriptText.ctaHeadline} (${scriptText.ctaSubtext})`,
  );

  if (pd.colors) {
    lines.push("", "## BRAND COLORS");
    for (const [k, v] of Object.entries(pd.colors)) {
      lines.push(`  ${k}: ${v}`);
    }
  }

  if (audio) {
    lines.push("", "## AUDIO");
    lines.push(`URL: ${audio.url}`);
    if (audio.bpm) {
      const fpb = (60 / audio.bpm) * 30;
      lines.push(
        `BPM: ${audio.bpm} (framesPerBeat at 30fps = ${fpb.toFixed(2)})`,
      );
      lines.push(
        `BEAT-SNAP: aim each scene at a multiple of ${Math.round(fpb)} frames; absorb the remainder so totals still hit ${targetFrames}.`,
      );
    }
  }

  if (recordings.length) {
    lines.push("", "## SCREEN RECORDINGS");
    for (const r of recordings) {
      lines.push(
        `  - ${r.featureName}: ${r.videoUrl} (duration ${r.duration}s, trimStart ${r.trimStart}s)`,
      );
    }
    lines.push("Reference recordings via RecordingClip with src=<videoUrl>.");
  }

  return lines.join("\n");
}

const MIN_SCENE_FRAMES = 15;

/**
 * Force sum(scenes[].durationInFrames) === targetFrames.
 * Scales proportionally; the last scene absorbs rounding remainder.
 * Single-scene videos snap directly.
 */
function enforceVideoDuration(json: VideoJson, targetFrames: number): VideoJson {
  if (!json.scenes.length) return json;
  const current = json.scenes.reduce((s, x) => s + x.durationInFrames, 0);
  if (current === targetFrames) return json;

  if (json.scenes.length === 1) {
    json.scenes[0].durationInFrames = Math.max(MIN_SCENE_FRAMES, targetFrames);
    return json;
  }

  if (current === 0) {
    const each = Math.max(
      MIN_SCENE_FRAMES,
      Math.floor(targetFrames / json.scenes.length),
    );
    let allocated = 0;
    for (let i = 0; i < json.scenes.length - 1; i++) {
      json.scenes[i].durationInFrames = each;
      allocated += each;
    }
    json.scenes[json.scenes.length - 1].durationInFrames = Math.max(
      MIN_SCENE_FRAMES,
      targetFrames - allocated,
    );
    return json;
  }

  const scale = targetFrames / current;
  let allocated = 0;
  for (let i = 0; i < json.scenes.length - 1; i++) {
    const scaled = Math.max(
      MIN_SCENE_FRAMES,
      Math.round(json.scenes[i].durationInFrames * scale),
    );
    json.scenes[i].durationInFrames = scaled;
    allocated += scaled;
  }
  const remainder = targetFrames - allocated;
  json.scenes[json.scenes.length - 1].durationInFrames = Math.max(
    MIN_SCENE_FRAMES,
    remainder,
  );

  // Final reconcile in case the floor on the last scene blew the budget
  const final = json.scenes.reduce((s, x) => s + x.durationInFrames, 0);
  if (final !== targetFrames) {
    const delta = targetFrames - final;
    json.scenes[json.scenes.length - 1].durationInFrames = Math.max(
      MIN_SCENE_FRAMES,
      json.scenes[json.scenes.length - 1].durationInFrames + delta,
    );
  }
  return json;
}

function stripJsonFences(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  }
  return s.trim();
}

/**
 * Parse + validate the LLM output. Returns null on any error.
 */
function parseVideoJson(raw: string): {
  ok: true;
  json: VideoJson;
} | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(raw));
  } catch (e) {
    return { ok: false, error: `JSON parse failed: ${(e as Error).message}` };
  }

  const top = VideoJsonSchema.safeParse(parsed);
  if (!top.success) {
    return {
      ok: false,
      error: `Top-level schema invalid: ${top.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    };
  }

  // Per-layer prop validation against registry schemas
  const customNames = new Set(top.data.customComponents.map((c) => c.name));
  for (const [si, scene] of top.data.scenes.entries()) {
    for (const [li, layer] of scene.layers.entries()) {
      const isCustom = customNames.has(layer.component);
      if (isCustom) continue; // custom props are AI's own contract
      const meta = BUILTIN_COMPONENTS[layer.component];
      if (!meta) {
        return {
          ok: false,
          error: `Scene ${si} layer ${li}: unknown component "${layer.component}"`,
        };
      }
      const propsCheck = meta.propsSchema.safeParse(layer.props);
      if (!propsCheck.success) {
        return {
          ok: false,
          error: `Scene ${si} layer ${li} (${layer.component}): ${propsCheck.error.issues
            .slice(0, 3)
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")}`,
        };
      }
      // Apply defaults
      layer.props = propsCheck.data;
    }
  }

  return { ok: true, json: top.data };
}

const MAX_REPAIR_ATTEMPTS = 2;

export async function jsonComposerNode(
  state: VideoGenerationStateType,
): Promise<Partial<VideoGenerationStateType>> {
  console.log("[JsonComposer] Building video JSON...");

  const registryPrompt = buildRegistryPrompt();
  const contextPrompt = buildContextPrompt(state);
  const userPrompt = `${contextPrompt}\n\n${registryPrompt}\n\n${CUSTOM_COMPONENT_GUIDE}\n\nProduce the Video JSON now.`;

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  let lastError: string | null = null;
  let videoJson: VideoJson | null = null;

  for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
    if (attempt > 0 && lastError) {
      messages.push({
        role: "user",
        content: `Your previous output failed validation: ${lastError}\n\nReturn the corrected JSON only.`,
      });
    }

    const resp = await chatWithGeminiPro(messages, CODE_GENERATOR_CONFIG);
    const result = parseVideoJson(resp.content);

    if (result.ok) {
      videoJson = result.json;
      break;
    }

    lastError = result.error;
    console.warn(
      `[JsonComposer] Attempt ${attempt + 1} failed: ${lastError}`,
    );
    messages.push({ role: "assistant", content: resp.content });
  }

  if (!videoJson) {
    return {
      errors: [`JsonComposer failed after retries: ${lastError}`],
      currentStep: "error",
    };
  }

  const targetFrames = resolveTargetFrames(state);
  const llmTotal = videoJson.scenes.reduce((s, x) => s + x.durationInFrames, 0);
  if (llmTotal !== targetFrames) {
    console.warn(
      `[JsonComposer] LLM total ${llmTotal} ≠ target ${targetFrames} — scaling scenes`,
    );
    videoJson = enforceVideoDuration(videoJson, targetFrames);
  }

  const finalTotal = videoJson.scenes.reduce(
    (s, x) => s + x.durationInFrames,
    0,
  );
  if (finalTotal !== targetFrames) {
    console.error(
      `[JsonComposer] Duration enforcement failed: got ${finalTotal}, want ${targetFrames}`,
    );
  }

  // Update upstream script's totalDuration so videoRenderer renders the
  // exact same length the JSON spans (and audio matches).
  if (state.videoScript) {
    (state.videoScript as any).totalDuration = finalTotal;
  }

  const remotionCode = buildRemotionCode(videoJson);
  console.log(
    `[JsonComposer] Built ${videoJson.scenes.length} scenes (${finalTotal} frames / ${(finalTotal / 30).toFixed(1)}s), ${videoJson.customComponents.length} custom components, ${remotionCode.length} chars Remotion code`,
  );

  return {
    remotionCode,
    videoJson,
    videoScript: state.videoScript,
    currentStep: "complete",
  };
}

// Re-export for tests / introspection
export { parseVideoJson, buildContextPrompt };
export type { VideoJson };
