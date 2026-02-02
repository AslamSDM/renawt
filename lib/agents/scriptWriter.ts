import {
  isUsingOpenRouter,
  chatWithOpenRouterMultiTurn,
  getAnthropicModel,
  SCRIPT_WRITER_CONFIG,
} from "./model";
import type { VideoScript } from "../types";
import type { VideoGenerationStateType } from "./state";
import { v4 as uuidv4 } from "uuid";
import { generateBeatMap, getBpmFromMood } from "../audio/beatSync";

const SCRIPT_WRITER_SYSTEM_PROMPT = `You are a PREMIUM video scriptwriter specializing in stunning motion graphics and product marketing videos.
Create visually impressive 30-60 second videos (30fps = 900-1800 frames) that look like they were made by a professional agency.

## CRITICAL DESIGN PRINCIPLES
1. Use the ACTUAL brand colors from the product - NEVER default to black/white
2. Include images from the product when available
3. Use modern layouts: bento grids, split screens, centered hero text
4. Apply glassmorphic card effects for feature showcases
5. Use smooth scroll-based transitions between scenes
6. Vary text animations: blur-in, stagger-words, encrypted-text for tech products

## VIDEO STRUCTURE
- HOOK (0-3s): Bold statement with blur-in-up animation on gradient background
- PROBLEM/SOLUTION (3-12s): Split screen or full-width with stagger-words
- FEATURES (12-40s): Bento grid or feature cards with scroll-vertical transitions
- STATS (40-50s): Animated counters with accent colors (if data available)
- CTA (50-60s): Bold call-to-action with scale animation

## OUTPUT JSON SCHEMA
{
  "totalDuration": number (frames at 30fps),
  "scenes": [{
    "id": "unique-id",
    "startFrame": number,
    "endFrame": number,
    "type": "intro" | "feature" | "testimonial" | "cta" | "stats",
    "content": {
      "headline": "short punchy text",
      "subtext": "supporting text" | null,
      "image": "url from product images" | null,
      "icon": "emoji for features" | null,
      "stats": [{"value": number, "label": string, "suffix": string}] | null,
      "features": [{"icon": emoji, "title": string, "description": string}] | null
    },
    "animation": {
      "enter": "blur-in" | "blur-in-up" | "stagger-words" | "stagger-chars" | "scale" | "slide-up" | "fade" | "encrypted-text" | "gradient-text" | "flip-up",
      "exit": "fade" | "blur-out" | "zoom-out" | "slide-up",
      "staggerDelay": 5 (frames between items)
    },
    "style": {
      "background": "gradient or solid from brand colors" (e.g. "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" or "#1a1a2e"),
      "textColor": "#ffffff" or from brand,
      "accentColor": "brand accent for highlights",
      "fontSize": "large" | "medium" | "small",
      "layout": "centered" | "left" | "split" | "grid" | "bento",
      "cardStyle": "glass" | "spotlight" | "floating" | "none"
    }
  }],
  "transitions": [{
    "afterScene": "scene-id",
    "type": "scroll-vertical" | "scroll-horizontal" | "crossfade" | "zoom-through" | "morph" | "fade",
    "duration": 20-40 frames,
    "direction": "up" | "down" | "left" | "right" (optional)
  }],
  "music": {
    "tempo": BPM number,
    "mood": "energetic" | "calm" | "dramatic" | "playful"
  }
}

## ANIMATION RECOMMENDATIONS BY SCENE TYPE
- intro: "blur-in-up" or "stagger-words" with large text
- feature: "stagger-chars" or "slide-up" with "glass" cardStyle
- stats: "scale" with animated counters
- testimonial: "fade" or "blur-in" with "floating" cardStyle
- cta: "scale" or "flip-up" with bold accent colors

## TRANSITIONS (use varied, flowing transitions)
- Between intro→features: "scroll-vertical" (like page scroll down)
- Between features: "scroll-horizontal" (carousel feel) or "crossfade"
- To CTA: "zoom-through" (dramatic zoom into next scene)

## STYLE REQUIREMENTS
- ALWAYS use gradients for backgrounds (e.g., "linear-gradient(135deg, primaryColor 0%, secondaryColor 100%)")
- Use the product's extracted colors - do NOT use plain black/white
- Add accent colors for emphasis (buttons, highlights)
- Glass cardStyle for feature cards with backdrop blur effect
- Include vignette overlays for depth

Return ONLY valid JSON. No markdown, no explanation.`;

async function callModel(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  if (isUsingOpenRouter()) {
    // Use OpenRouter with reasoning
    return chatWithOpenRouterMultiTurn(
      systemPrompt,
      userMessage,
      SCRIPT_WRITER_CONFIG,
    );
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
  state: VideoGenerationStateType,
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

    const responseText = await callModel(
      SCRIPT_WRITER_SYSTEM_PROMPT,
      userMessage,
    );

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

    // Generate beat map from the music tempo
    const finalBpm = videoScript.music?.tempo || bpm;
    const beatMap = generateBeatMap({
      bpm: finalBpm,
      totalDurationFrames: videoScript.totalDuration,
      fps: 30,
      offset: 0,
    });

    console.log(
      `[ScriptWriter] Generated script with ${videoScript.scenes.length} scenes, ${videoScript.totalDuration} frames`,
    );
    console.log(
      `[ScriptWriter] Generated beat map: ${beatMap.beats.length} beats at ${beatMap.bpm} BPM`,
    );

    return {
      videoScript,
      beatMap,
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
