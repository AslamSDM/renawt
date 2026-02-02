import {
  isUsingOpenRouter,
  chatWithOpenRouterMultiTurn,
  getAnthropicModel,
  SCRIPT_WRITER_CONFIG,
} from "./model";
import type { VideoScript } from "../types";
import type { VideoGenerationStateType } from "./state";
import { v4 as uuidv4 } from "uuid";

const SCRIPT_WRITER_SYSTEM_PROMPT = `You are a video scriptwriter specializing in product marketing videos.
Given product data, create a compelling 30-60 second video script (at 30fps = 900-1800 frames).

Video Structure (adapt based on content):
- Hook (0-3 seconds / frames 0-90): Grab attention with a bold statement or question
- Problem (3-8 seconds / frames 90-240): Relatable pain point the audience faces
- Solution (8-15 seconds / frames 240-450): Introduce the product as the answer
- Features (15-40 seconds / frames 450-1200): 2-4 key benefits, one scene each
- Social Proof (40-50 seconds / frames 1200-1500): Testimonials or trust signals (if available)
- CTA (50-60 seconds / frames 1500-1800): Clear call to action

Output ONLY valid JSON matching this schema:
{
  "totalDuration": number (in frames at 30fps),
  "scenes": [
    {
      "id": "unique-id",
      "startFrame": number,
      "endFrame": number,
      "type": "intro" | "feature" | "testimonial" | "cta" | "transition",
      "content": {
        "headline": "string (short, punchy)",
        "subtext": "string (supporting text)" | null,
        "image": "url or null"
      },
      "animation": {
        "enter": "fade" | "slide-up" | "scale" | "reveal" | "typewriter",
        "exit": "fade" | "slide-down" | "scale-out"
      },
      "style": {
        "background": "hex color or gradient",
        "textColor": "hex color",
        "fontSize": "large" | "medium" | "small"
      }
    }
  ],
  "transitions": [
    {
      "afterScene": "scene-id",
      "type": "cut" | "fade" | "wipe" | "zoom",
      "duration": number (in frames)
    }
  ],
  "music": {
    "tempo": 120 (BPM),
    "mood": "string describing the mood"
  }
}

Guidelines:
- Keep headlines under 10 words
- Use the product's color palette for styling
- Match the brand's tone (professional, playful, minimal, bold)
- Vary animation types for visual interest
- Use larger fonts for headlines, smaller for supporting text
- Create smooth flow between scenes`;

async function callModel(systemPrompt: string, userMessage: string): Promise<string> {
  if (isUsingOpenRouter()) {
    // Use OpenRouter with reasoning
    return chatWithOpenRouterMultiTurn(systemPrompt, userMessage, SCRIPT_WRITER_CONFIG);
  } else {
    // Use Anthropic Claude directly
    const model = getAnthropicModel(SCRIPT_WRITER_CONFIG);
    const response = await model.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ]);

    const rawContent = response.content;
    return typeof rawContent === "string"
      ? rawContent
      : Array.isArray(rawContent) && rawContent[0]?.type === "text"
        ? (rawContent[0] as { type: "text"; text: string }).text
        : "";
  }
}

export async function scriptWriterNode(
  state: VideoGenerationStateType
): Promise<Partial<VideoGenerationStateType>> {
  console.log("[ScriptWriter] Starting script writer node...");

  if (!state.productData) {
    return {
      errors: ["No product data available for script generation"],
      currentStep: "error",
    };
  }

  try {
    const productData = state.productData;
    const preferences = state.userPreferences;

    // Calculate target duration based on content
    const hasTestimonials =
      productData.testimonials && productData.testimonials.length > 0;
    const hasPricing = productData.pricing && productData.pricing.length > 0;
    const featureCount = Math.min(productData.features.length, 4);

    // Base: 15s intro + features + 5s CTA = minimum
    // Add 10s for testimonials, 8s for pricing if present
    let targetSeconds = 15 + featureCount * 6 + 5;
    if (hasTestimonials) targetSeconds += 10;
    if (hasPricing) targetSeconds += 8;

    // Clamp to 30-60 seconds
    targetSeconds = Math.min(60, Math.max(30, targetSeconds));
    const targetFrames = targetSeconds * 30;

    const bpm = preferences.musicBpm || 120;

    const userMessage = `Create a video script for this product:

Product Name: ${productData.name}
Tagline: ${productData.tagline}
Description: ${productData.description}

Features:
${productData.features.map((f, i) => `${i + 1}. ${f.title}: ${f.description}`).join("\n")}

${productData.testimonials ? `Testimonials:\n${productData.testimonials.map((t) => `"${t.quote}" - ${t.author}, ${t.role}`).join("\n")}` : "No testimonials available."}

${productData.pricing ? `Pricing:\n${productData.pricing.map((p) => `${p.tier}: ${p.price}`).join("\n")}` : ""}

Available Images: ${productData.images.length > 0 ? productData.images.join(", ") : "None - use solid color backgrounds"}

Brand Colors:
- Primary: ${productData.colors.primary}
- Secondary: ${productData.colors.secondary}
- Accent: ${productData.colors.accent}

Brand Tone: ${productData.tone}
Style Preference: ${preferences.style}
Target Duration: ~${targetSeconds} seconds (${targetFrames} frames at 30fps)
Music BPM: ${bpm}

Consider timing transitions to align with beats (every ${Math.round(1800 / bpm)} frames at ${bpm} BPM).

Return ONLY valid JSON.`;

    const responseText = await callModel(SCRIPT_WRITER_SYSTEM_PROMPT, userMessage);

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to extract JSON from response");
    }

    const videoScript = JSON.parse(jsonMatch[0]) as VideoScript;

    // Ensure all scenes have unique IDs
    videoScript.scenes = videoScript.scenes.map((scene) => ({
      ...scene,
      id: scene.id || uuidv4(),
    }));

    console.log(
      `[ScriptWriter] Generated script with ${videoScript.scenes.length} scenes, ${videoScript.totalDuration} frames`
    );

    return {
      videoScript,
      currentStep: "generating",
    };
  } catch (error) {
    console.error("[ScriptWriter] Error:", error);
    return {
      errors: [
        `Script writer error: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
      currentStep: "error",
    };
  }
}
