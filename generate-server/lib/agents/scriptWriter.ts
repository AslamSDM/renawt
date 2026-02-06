import {
  chatWithKimi,
  SCRIPT_WRITER_CONFIG,
} from "./model";
import type { VideoScript } from "../types";
import type { VideoGenerationStateType } from "./state";
import { v4 as uuidv4 } from "uuid";
import { generateBeatMap } from "../audio/beatSync";

const SCRIPT_WRITER_SYSTEM_PROMPT = `You are a PREMIUM video scriptwriter specializing in continuous, flowing motion graphics videos.
Create visually impressive 30-60 second videos (30fps = 900-1800 frames) with CONTINUOUS MOTION - NO HARD SCENE CUTS.

## CRITICAL: CONTINUOUS MOTION PHILOSOPHY
This video must feel like ONE CONTINUOUS SHOT. Elements flow in and out naturally:
- NO hard cuts or scene transitions
- Elements animate IN and OUT of frame smoothly
- Camera movements (pan, zoom, dolly) connect different content
- Background elements shift and morph continuously
- Fast-paced background flickers and pulses synced to music beats
- Text warps, stretches, and transforms with the rhythm

## MOTION TECHNIQUES
1. **Camera Movement**: Continuous zoom, pan, or dolly throughout
2. **Element Flow**: Content slides/fades in from edges, exits opposite side
3. **Layered Animation**: Multiple layers moving at different speeds (parallax)
4. **Beat Sync**: Background flickers, scale pulses, and color shifts on beat
5. **Morphing**: Text and shapes transform into new content
6. **Warping**: Subtle distortion waves traveling across the composition

## VIDEO STRUCTURE (All in ONE continuous composition)
- HOOK (0-3s): Bold text zooms in with background warp effect
- Content flows with camera pan - elements enter/exit naturally
- FEATURES: Cards float in from sides, drift across, exit with momentum
- Stats: Numbers count up while background pulses with energy
- CTA: Final message scales up as camera pushes in

## OUTPUT JSON SCHEMA
{
  "totalDuration": number (frames at 30fps),
  "continuousMotion": {
    "cameraMovement": "zoom-in" | "pan-left" | "pan-right" | "dolly-in" | "orbit",
    "cameraSpeed": number (pixels per frame),
    "parallaxLayers": number (2-5 layers)
  },
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
      "enter": "float-in-left" | "float-in-right" | "scale-in" | "warp-in" | "blur-in" | "glitch-in",
      "exit": "float-out-left" | "float-out-right" | "scale-out" | "warp-out" | "blur-out",
      "motion": "drift-left" | "drift-right" | "float-up" | "pulse" | "wobble",
      "staggerDelay": 3-5 (frames between items)
    },
    "style": {
      "background": "none" (shared background),
      "textColor": "#ffffff" or from brand,
      "accentColor": "brand accent for highlights",
      "fontSize": "large" | "medium" | "small",
      "layout": "centered" | "left" | "right" | "floating",
      "cardStyle": "glass" | "glow" | "floating" | "none",
      "warpIntensity": 0-1 (how much text warps with music)
    }
  }],
  "backgroundEffects": {
    "type": "aurora" | "particles" | "mesh-gradient" | "noise-field",
    "colors": ["#hex1", "#hex2", "#hex3"],
    "flickerOnBeat": true,
    "pulseIntensity": 0.1-0.5,
    "waveSpeed": number
  },
  "beatSync": {
    "flickerIntensity": 0.1-0.3,
    "scalePulse": 0.02-0.1,
    "colorShift": true
  },
  "music": {
    "tempo": BPM number,
    "mood": "energetic" | "hypnotic" | "dramatic" | "chill"
  }
}

## ANIMATION STYLE GUIDE
- Everything moves constantly - nothing is static
- Use momentum and physics-based easing
- Layer multiple animations (position + scale + rotation + warp)
- Background should breathe and pulse with the music
- Text should have subtle continuous motion even when "still"

## STYLE REQUIREMENTS
- Use DYNAMIC moving gradients/mesh backgrounds
- Fast micro-animations (flickers, pulses) on every beat
- Subtle warping/distortion waves
- Glow effects that pulse with music
- Motion blur on fast-moving elements

Return ONLY valid JSON. No markdown, no explanation.`;

async function callModel(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  console.log("[ScriptWriter] Calling Kimi K2.5...");
  const response = await chatWithKimi(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    SCRIPT_WRITER_CONFIG,
  );
  return response.content;
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

    // Use user-specified duration if provided, otherwise calculate based on content
    let targetSeconds: number;
    
    if (preferences.duration && preferences.duration >= 10 && preferences.duration <= 120) {
      // User specified a valid duration (10-120 seconds)
      targetSeconds = preferences.duration;
    } else {
      // Calculate based on content
      // Base: 15s intro + features + 5s CTA = minimum
      // Add 10s for testimonials, 8s for pricing if present
      targetSeconds = 15 + featureCount * 6 + 5;
      if (hasTestimonials) targetSeconds += 10;
      if (hasPricing) targetSeconds += 8;
      
      // Clamp to 30-60 seconds
      targetSeconds = Math.min(60, Math.max(30, targetSeconds));
    }
    
    const targetFrames = targetSeconds * 30;

    const bpm = preferences.musicBpm || 120;

    // Check if we have screenshots for SaaS product videos
    const screenshots = (productData as any).screenshots || [];
    const isSaaSProduct = (productData as any).productType === "saas" || screenshots.length > 0;

    // Build screenshots section if available
    let screenshotsSection = "";
    if (screenshots.length > 0) {
      screenshotsSection = `
WEBSITE SCREENSHOTS (use these for visual scenes - especially for SaaS product demos):
${screenshots.map((s: any) => `- ${s.section}: ${s.url} (${s.description})`).join("\n")}

For SaaS products, incorporate these screenshots into scenes:
- Use hero screenshot for intro/hook scene
- Use features screenshot for feature showcase
- Use UI screenshot for demo/walkthrough scenes
- Screenshots can be shown with browser mockups, device frames, or floating cards
`;
    }

    const userMessage = `Create a video script for this product:

Product Name: ${productData.name}
Tagline: ${productData.tagline}
Description: ${productData.description}
Product Type: ${(productData as any).productType || "unknown"}${isSaaSProduct ? " (SaaS - use screenshots for visual scenes)" : ""}

Features:
${productData.features.map((f, i) => `${i + 1}. ${f.title}: ${f.description}`).join("\n")}

${productData.testimonials ? `Testimonials:\n${productData.testimonials.map((t) => `"${t.quote}" - ${t.author}, ${t.role}`).join("\n")}` : "No testimonials available."}

${productData.pricing ? `Pricing:\n${productData.pricing.map((p) => `${p.tier}: ${p.price}`).join("\n")}` : ""}

Available Images: ${productData.images.length > 0 ? productData.images.join(", ") : "None - use solid color backgrounds"}
${screenshotsSection}
Brand Colors:
- Primary: ${productData.colors.primary}
- Secondary: ${productData.colors.secondary}
- Accent: ${productData.colors.accent}

Brand Tone: ${productData.tone}
Style Preference: ${preferences.style}
Target Duration: ~${targetSeconds} seconds (${targetFrames} frames at 30fps)
Music BPM: ${bpm}

${isSaaSProduct ? `
IMPORTANT FOR SAAS PRODUCTS:
- Include screenshot URLs in scene "image" fields where appropriate
- Show actual product UI in feature scenes
- Use browser/device mockups to frame screenshots
- Create scenes that showcase the actual product interface
` : ""}

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
