import {
  chatWithKimi,
  SCRIPT_WRITER_CONFIG,
} from "./model";
import type { VideoScript } from "../types";
import type { VideoGenerationStateType } from "./state";
import { v4 as uuidv4 } from "uuid";
import { generateBeatMap } from "../audio/beatSync";

const SCRIPT_WRITER_SYSTEM_PROMPT = `You are a PREMIUM video scriptwriter specializing in polished product demo videos with the "Premium Demo" style.
Create visually impressive 30-60 second videos (30fps = 900-1800 frames) with DISCRETE SCENES using smooth entry/exit animations.

## CRITICAL: PREMIUM DEMO STYLE
This video uses discrete scenes with smooth transitions:
- Each scene has its own aurora gradient background (alternating dark/light)
- Text appears with word-by-word blur reveal animations
- Feature content uses white glass morphism cards with 3D perspective entry
- Accent text uses purple-to-pink gradient
- Scene progress dots track position at the bottom
- Montserrat font only, normal case (NOT uppercase)

## SCENE TIMING - VARIABLE PACING
- **Intro scene (first)**: ~3 seconds (90 frames) — slow, dramatic brand reveal
- **Middle scenes**: ~1.5 seconds (45 frames) — fast, punchy, energetic
- **Feature card scenes**: ~2 seconds (60 frames) — slightly longer for readability
- **Screenshot scenes**: ~2.5 seconds (75 frames) — enough to see the product
- **CTA scene (last)**: ~3 seconds (90 frames) — slow, dramatic close

## BEAT MATCHING
Snap scene boundaries to the nearest beat. Given BPM, one beat = (60/BPM)*30 frames.
Example at 120 BPM: one beat = 15 frames. Scenes should start/end on beat boundaries.
Round scene durations to the nearest beat: 45 frames → 3 beats, 90 frames → 6 beats.

## SCENE FLOW (10-15 scenes)
1. **Logo Scene** (3s): Brand name with glow effect on dark aurora
2. **Tagline Scene** (1.5s): Word-by-word blur reveal on light aurora
3. **Value Prop Scenes** (1.5s each): Key messages with gradient accent words
4. **Screenshot Scenes** (2.5s): Product UI screenshots in white glass cards (if available)
5. **Feature Scenes** (2s): White glass cards with feature content
6. **CTA Scene** (3s): ALWAYS the last scene — call-to-action with blur reveal + gradient text on dark aurora

IMPORTANT: The LAST scene MUST always be type "cta" with a strong call-to-action.

## SCREENSHOTS
If product screenshots are provided, include 1-2 "screenshot" type scenes:
- Place them in the middle of the video (after tagline, before CTA)
- Set scene.content.image to the screenshot URL
- Use "screenshot" as the scene type
- These show the actual product UI in a white glass card frame

## BACKGROUND ALTERNATION
- **Dark aurora**: Logo, CTA, and card-based scenes
- **Light aurora**: Text reveals, taglines, screenshots
- Alternate between dark and light for visual rhythm

## OUTPUT JSON SCHEMA
{
  "totalDuration": number (frames at 30fps),
  "scenes": [{
    "id": "unique-id",
    "startFrame": number,
    "endFrame": number,
    "type": "intro" | "feature" | "screenshot" | "testimonial" | "cta" | "stats" | "tagline" | "value-prop",
    "content": {
      "headline": "short punchy text (3-8 words)",
      "subtext": "supporting text" | null,
      "image": "screenshot URL or product image URL" | null,
      "icon": "emoji for features" | null,
      "stats": [{"value": number, "label": string, "suffix": string}] | null,
      "features": [{"icon": emoji, "title": string, "description": string}] | null,
      "gradientWords": [indices of words to highlight with gradient] | null
    },
    "animation": {
      "enter": "blur-reveal" | "perspective-card" | "slide-up" | "scale-in" | "glow-in",
      "staggerDelay": 5 (frames between words/items)
    },
    "style": {
      "auroraVariant": "dark" | "light",
      "textColor": "#ffffff" (dark bg) or "#0a0a0f" (light bg),
      "fontSize": "large" | "medium" | "small",
      "layout": "centered" | "card",
      "cardStyle": "white-glass" | "none"
    }
  }],
  "music": {
    "tempo": BPM number,
    "mood": "energetic" | "hypnotic" | "dramatic" | "chill"
  }
}

## STYLE REQUIREMENTS
- Purple/pink color scheme: #a855f7 (purple), #ec4899 (pink)
- Aurora gradient backgrounds (NOT solid colors)
- White opaque glass cards (rgba(255,255,255,0.95))
- Word-by-word blur text reveals (NOT typing effects)
- Gradient accent text for emphasis words
- Scene progress dots at bottom
- Montserrat font only (weights 400-800)
- Normal case text (NOT uppercase)
- 3D perspective card entries

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

    // =========================================================================
    // DURATION ENFORCEMENT: Ensure video meets target duration
    // =========================================================================
    const actualTotal = videoScript.totalDuration;
    if (actualTotal < targetFrames * 0.8) {
      console.log(
        `[ScriptWriter] Duration too short: ${actualTotal} frames vs target ${targetFrames}. Enforcing...`,
      );

      // Step 1: Generate extra scenes if scene count < 6 and target >= 30s
      if (videoScript.scenes.length < 6 && targetSeconds >= 30) {
        const extraScenes: typeof videoScript.scenes = [];

        // Find the CTA index — new scenes go before CTA
        const ctaIndex = videoScript.scenes.findIndex((s) => s.type === "cta");
        const usedHeadlines = new Set(
          videoScript.scenes.map((s) => s.content.headline?.toLowerCase()),
        );

        // Source 1: Unused features
        const usedFeatureTitles = new Set(
          videoScript.scenes
            .flatMap((s) =>
              (s.content.features || []).map((f) => f.title.toLowerCase()),
            )
            .concat(
              videoScript.scenes
                .filter((s) => s.type === "feature")
                .map((s) => (s.content.headline || "").toLowerCase()),
            ),
        );

        for (const feature of productData.features) {
          if (
            usedFeatureTitles.has(feature.title.toLowerCase()) ||
            usedHeadlines.has(feature.title.toLowerCase())
          )
            continue;
          extraScenes.push({
            id: uuidv4(),
            startFrame: 0,
            endFrame: 60,
            type: "feature",
            content: {
              headline: feature.title,
              subtext: feature.description,
              icon: feature.icon || "✨",
            },
            animation: {
              enter: extraScenes.length % 2 === 0 ? "blur-in" : "slide-up",
              exit: "fade",
              staggerDelay: 5,
            },
            style: {
              background: extraScenes.length % 2 === 0 ? "dark" : "light",
              textColor:
                extraScenes.length % 2 === 0 ? "#ffffff" : "#0a0a0f",
              fontSize: "medium",
              layout: extraScenes.length % 2 === 0 ? "centered" : "card",
              cardStyle:
                extraScenes.length % 2 === 0 ? "none" : "glass",
            },
          } as any);
        }

        // Source 2: Testimonials
        if (
          productData.testimonials &&
          productData.testimonials.length > 0
        ) {
          const usedTestimonials = videoScript.scenes.some(
            (s) => s.type === "testimonial",
          );
          if (!usedTestimonials) {
            const t = productData.testimonials[0];
            extraScenes.push({
              id: uuidv4(),
              startFrame: 0,
              endFrame: 60,
              type: "testimonial",
              content: {
                headline: `"${t.quote}"`,
                subtext: `— ${t.author}, ${t.role}`,
              },
              animation: { enter: "blur-in", exit: "fade", staggerDelay: 5 },
              style: {
                background: "dark",
                textColor: "#ffffff",
                fontSize: "medium",
                layout: "centered",
                cardStyle: "glass",
              },
            } as any);
          }
        }

        // Source 3: Value-prop scenes from description
        if (extraScenes.length < 3 && productData.description) {
          const sentences = productData.description
            .split(/[.!?]+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 10 && s.length < 80);
          for (const sentence of sentences.slice(0, 2)) {
            if (usedHeadlines.has(sentence.toLowerCase())) continue;
            extraScenes.push({
              id: uuidv4(),
              startFrame: 0,
              endFrame: 60,
              type: "feature" as any,
              content: {
                headline: sentence,
              },
              animation: { enter: "blur-in", exit: "fade", staggerDelay: 5 },
              style: {
                background:
                  extraScenes.length % 2 === 0 ? "light" : "dark",
                textColor:
                  extraScenes.length % 2 === 0 ? "#0a0a0f" : "#ffffff",
                fontSize: "medium",
                layout: "centered",
                cardStyle: "none",
              },
            } as any);
          }
        }

        // Source 4: Pricing highlights
        if (extraScenes.length < 3 && productData.pricing && productData.pricing.length > 0) {
          const p = productData.pricing[0];
          extraScenes.push({
            id: uuidv4(),
            startFrame: 0,
            endFrame: 60,
            type: "feature" as any,
            content: {
              headline: `Starting at ${p.price}`,
              subtext: `${p.tier} plan`,
            },
            animation: { enter: "slide-up", exit: "fade", staggerDelay: 5 },
            style: {
              background: "dark",
              textColor: "#ffffff",
              fontSize: "large",
              layout: "centered",
              cardStyle: "none",
            },
          } as any);
        }

        // Insert extra scenes before CTA
        if (extraScenes.length > 0) {
          const insertAt = ctaIndex >= 0 ? ctaIndex : videoScript.scenes.length;
          videoScript.scenes.splice(insertAt, 0, ...extraScenes);
          console.log(
            `[ScriptWriter] Added ${extraScenes.length} extra scenes to fill duration`,
          );
        }
      }

      // Step 2: Scale all scene durations proportionally
      const currentTotal = videoScript.scenes.reduce(
        (sum, s) => sum + (s.endFrame - s.startFrame),
        0,
      );
      if (currentTotal > 0 && currentTotal < targetFrames * 0.9) {
        const scaleFactor = targetFrames / currentTotal;
        for (const scene of videoScript.scenes) {
          const duration = scene.endFrame - scene.startFrame;
          const scaled = Math.round(duration * scaleFactor);
          // Keep scene duration between 30 frames (1s) and 300 frames (10s)
          scene.endFrame =
            scene.startFrame + Math.max(30, Math.min(300, scaled));
        }
      }

      // Step 3: Recalculate sequential startFrame/endFrame
      let frame = 0;
      for (const scene of videoScript.scenes) {
        const duration = scene.endFrame - scene.startFrame;
        scene.startFrame = frame;
        scene.endFrame = frame + duration;
        frame += duration;
      }

      // Step 4: Update totalDuration
      videoScript.totalDuration = frame;
      console.log(
        `[ScriptWriter] Adjusted duration: ${videoScript.totalDuration} frames (${(videoScript.totalDuration / 30).toFixed(1)}s) with ${videoScript.scenes.length} scenes`,
      );
    }

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
