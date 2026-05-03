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

RULES:
- Each scene is a stack of layers rendered in order (first = bottom).
- Always start a scene with a background layer (GradientBg/SolidBg/ImageBg) unless intentional.
- durationInFrames at 30fps: 30 = 1s. Snap to multiples of \`framesPerBeat\` if BPM provided.
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

function buildContextPrompt(state: VideoGenerationStateType): string {
  const scriptText = extractScriptText(state.videoScript);
  const audio = state.userPreferences.audio;
  const recordings = state.recordings || [];

  const lines: string[] = [
    "## VIDEO BRIEF",
    `Product: ${state.productData?.name || "Untitled"}`,
    `Style: ${state.userPreferences.style}`,
    `Video type: ${state.userPreferences.videoType || "creative"}`,
    `Aspect ratio: ${(state.userPreferences as any).aspectRatio || "16:9"}`,
    "",
    "## SCRIPT",
    `Tagline: ${scriptText.tagline}`,
    `Intro subtext: ${scriptText.introSubtext}`,
    `Features:`,
    ...scriptText.features.map(
      (f, i) => `  ${i + 1}. ${f.title} — ${f.description}`,
    ),
    `CTA: ${scriptText.ctaHeadline} (${scriptText.ctaSubtext})`,
  ];

  if (state.productData) {
    const pd: any = state.productData;
    if (pd.colors) {
      lines.push("", "## BRAND COLORS");
      for (const [k, v] of Object.entries(pd.colors)) {
        lines.push(`  ${k}: ${v}`);
      }
    }
  }

  if (audio) {
    lines.push("", "## AUDIO");
    lines.push(`URL: ${audio.url}`);
    if (audio.bpm) lines.push(`BPM: ${audio.bpm} (framesPerBeat at 30fps = ${(60 / audio.bpm) * 30})`);
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

  const remotionCode = buildRemotionCode(videoJson);
  console.log(
    `[JsonComposer] Built ${videoJson.scenes.length} scenes, ${videoJson.customComponents.length} custom components, ${remotionCode.length} chars Remotion code`,
  );

  return {
    remotionCode,
    currentStep: "complete",
  };
}

// Re-export for tests / introspection
export { parseVideoJson, buildContextPrompt };
export type { VideoJson };
