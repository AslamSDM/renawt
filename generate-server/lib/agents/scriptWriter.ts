import {
  chatWithGeminiFlash,
  SCRIPT_WRITER_CONFIG,
} from "./model";
import type { VideoScript } from "../types";
import type { VideoGenerationStateType } from "./state";
import { v4 as uuidv4 } from "uuid";
import { generateBeatMap } from "../audio/beatSync";

const SCRIPT_WRITER_SYSTEM_PROMPT = `You are a PREMIUM video scriptwriter specializing in polished product demo videos.
Create visually impressive 30-60 second videos (30fps = 900-1800 frames) with DISCRETE SCENES using smooth entry/exit animations.

## CRITICAL: MATCH THE BRAND STYLE
Choose the visual style that best fits the product's brand colors and tone. DO NOT default to purple/pink.

### STYLE A -- Dark Cinematic (for tech, SaaS, dev tools):
- Background: near-black with slow-moving bokeh circles (blurred divs, opacity 0.15-0.4, drifting)
- Headline: oversized (140-200px), tight letter-spacing (-4px), white or brand color
- Accent lines: thin 1-2px horizontal rules that sweep in from left
- Card elements: dark glass (rgba(255,255,255,0.04)) with subtle border (rgba(255,255,255,0.08))

### STYLE B -- Vibrant Brand (for consumer apps, e-commerce, lifestyle):
- Background: rich brand color fills, NOT black -- use product's actual primary color
- Big bold text that FILLS the frame -- poster typography
- Shapes: geometric rectangles, diagonal slices, full-bleed color blocks
- Text: high contrast, complementary colors

### STYLE C -- Editorial Clean (for health, finance, B2B):
- Background: warm off-white (#FAFAF7) or slate (#F1F5F8)
- Typography: tight columns, large numerics for stats, small caps for labels
- Thin lines and data-viz style graphics
- Minimal palette: 2 colors max + background

### STYLE D -- Neon Glow (for gaming, crypto, energy):
- Background: deep navy/black
- Glowing text via textShadow and boxShadow
- Scanline overlay: thin horizontal lines (1px, opacity 0.04, repeating-linear-gradient)
- Neon palette: one dominant glow color, others as accents

Use the brand colors provided in the prompt -- never invent new colors or default to generic schemes.

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
5. **Recording Scenes**: Screen recording playback with feature label overlay (if recordings provided)
6. **Feature Scenes** (2s): White glass cards with feature content
7. **CTA Scene** (3s): ALWAYS the last scene — call-to-action with blur reveal + gradient text on dark aurora

## SCREEN RECORDINGS
If screen recordings are provided, create "recording" type scenes for each:
- Use type: "recording"
- Set content.recordingId to the recording's id
- Set content.recordingVideoUrl to the recording's videoUrl
- Set content.featureName to the recording's featureName
- Set content.headline to the recording's featureName
- Set content.subtext to the recording's description
- Duration = recording's actual duration in seconds × 30 frames
- Place recording scenes in the middle of the video (after tagline, before CTA)
- Recording scenes should showcase the product in action

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
      "icon": null,
      "stats": [{"value": number, "label": string, "suffix": string}] | null,
      "features": [{"title": string, "description": string}] | null,
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

## TEXT FORMATTING RULES
- Headlines: Use Title Case (capitalize first letter of major words, lowercase minor words like "a", "the", "of", "in")
- Subtext: Use sentence case (capitalize only the first word and proper nouns)
- Do NOT use ALL CAPS or all lowercase for any text
- Keep headlines short and punchy (3-8 words)

## STYLE REQUIREMENTS
- Use the BRAND COLORS from the prompt -- never default to purple/pink
- Gradient backgrounds that use brand colors (NOT solid colors)
- Word-by-word blur text reveals (NOT typing effects)
- Gradient accent text for emphasis words using brand palette
- Scene progress dots at bottom
- Font loaded from @remotion/google-fonts (weights 400-800)
- Normal case text (NOT uppercase)
- 3D perspective card entries for feature scenes

Return ONLY valid JSON. No markdown, no explanation.`;

async function callModel(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  console.log("[ScriptWriter] Calling Gemini Flash...");
  const response = await chatWithGeminiFlash(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    SCRIPT_WRITER_CONFIG,
  );
  return response.content;
}

function suggestVideoStyle(tone: string): string {
  const t = (tone || "professional").toLowerCase();
  if (t.includes("playful") || t.includes("fun") || t.includes("bold")) return "STYLE B -- Vibrant Brand";
  if (t.includes("luxury") || t.includes("premium")) return "STYLE B -- Vibrant Brand (gold/premium palette)";
  if (t.includes("health") || t.includes("finance") || t.includes("minimal")) return "STYLE C -- Editorial Clean";
  if (t.includes("gaming") || t.includes("crypto") || t.includes("energy")) return "STYLE D -- Neon Glow";
  if (t.includes("technical") || t.includes("professional")) return "STYLE A -- Dark Cinematic";
  return "STYLE A -- Dark Cinematic";
}

// Mood modifiers that add creative variety orthogonal to the 4 base styles
const MOOD_MODIFIERS: Record<string, string> = {
  retro: "Add retro/vintage feel: use muted warm tones, film grain overlay (subtle noise), rounded fonts, analog-style transitions (wipe, iris). Typography should feel 70s/80s inspired.",
  futuristic: "Add futuristic feel: use holographic gradients, thin geometric lines, monospace accent text, data-visualization elements. Think sci-fi UI.",
  organic: "Add organic feel: use soft curves, flowing shapes, warm earth tones as accents, gentle breathing animations (sine-wave scale). Typography should feel human and approachable.",
  brutalist: "Add brutalist feel: use harsh contrasts, oversized bold type (200px+), raw grid layouts, thick borders, no gradients. Confrontational, attention-grabbing.",
  cinematic: "Add cinematic feel: use wide letterbox format feel, dramatic lighting (dark with single light source), slow camera movements, film-quality color grading.",
};

/**
 * Build a style modifier section based on product characteristics.
 * Picks a primary style + optional mood modifier for creative variety.
 */
function buildStyleModifier(tone: string, videoType?: string): string {
  // Pick a mood modifier based on product characteristics
  const t = (tone || "").toLowerCase();
  let mood = "";

  if (t.includes("retro") || t.includes("vintage") || t.includes("classic")) {
    mood = MOOD_MODIFIERS.retro;
  } else if (t.includes("futur") || t.includes("ai") || t.includes("tech")) {
    mood = MOOD_MODIFIERS.futuristic;
  } else if (t.includes("organic") || t.includes("natural") || t.includes("wellness")) {
    mood = MOOD_MODIFIERS.organic;
  } else if (videoType === "fast-paced") {
    mood = MOOD_MODIFIERS.brutalist;
  } else if (videoType === "cinematic") {
    mood = MOOD_MODIFIERS.cinematic;
  }

  return mood ? `\n\n## MOOD MODIFIER\n${mood}` : "";
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

    // Check if images/screenshots should be used (only when explicitly requested)
    const useImages = (preferences as any)?.useImages === true;
    const screenshots = useImages ? ((productData as any).screenshots || []) : [];
    const isSaaSProduct = useImages && ((productData as any).productType === "saas" || screenshots.length > 0);

    // Build screenshots section if available and images are enabled
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

    // Build recordings section if available
    const recordings = state.recordings || [];
    let recordingsSection = "";
    if (recordings.length > 0) {
      recordingsSection = `
SCREEN RECORDINGS (include these as "recording" type scenes):
${recordings.map((r, i) => `- Recording ${i + 1}: id="${r.id}", featureName="${r.featureName}", description="${r.description}", duration=${r.duration}s, videoUrl="${r.videoUrl}"`).join("\n")}

For each recording, create a "recording" scene with:
- type: "recording"
- content.recordingId: the recording id
- content.recordingVideoUrl: the recording videoUrl
- content.featureName: the feature name
- content.headline: the feature name
- content.subtext: the description
- Duration: recording duration × 30 frames
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

Available Images: ${useImages && productData.images.length > 0 ? productData.images.join(", ") : "None - use solid color backgrounds and text-only scenes"}
${screenshotsSection}${recordingsSection}
Brand Colors (use these EXACTLY -- do not invent new colors):
- Primary: ${productData.colors.primary}
- Secondary: ${productData.colors.secondary}
- Accent: ${productData.colors.accent}

Brand Tone: ${productData.tone}
Style Preference: ${preferences.style}
Suggested Visual Style: ${suggestVideoStyle(productData.tone)}
Target Duration: ~${targetSeconds} seconds (${targetFrames} frames at 30fps)
Music BPM: ${bpm}

${isSaaSProduct && useImages ? `
IMPORTANT FOR SAAS PRODUCTS:
- Include screenshot URLs in scene "image" fields where appropriate
- Show actual product UI in feature scenes
- Use browser/device mockups to frame screenshots
- Create scenes that showcase the actual product interface
` : ""}

Consider timing transitions to align with beats (every ${Math.round(1800 / bpm)} frames at ${bpm} BPM).
${buildStyleModifier(productData.tone, preferences.videoType)}
${(preferences as any)?.nanoBanana ? `\nAI IMAGE GENERATION ENABLED: You can include AI-generated images in scenes. Add "aiImagePrompt" field to scene content with a descriptive prompt for image generation.` : ""}
${(preferences as any)?.stockImages ? `\nSTOCK IMAGES ENABLED: You can reference stock photography. Add "stockImageQuery" field to scene content with a search query.` : ""}
${!(preferences as any)?.animatedComponents ? `\nANIMATED COMPONENTS DISABLED: Use simpler, static layouts. Minimize complex animations and stagger effects.` : ""}

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

    // Post-process text formatting: Title Case for headlines, sentence case for subtexts
    const toTitleCase = (str: string): string => {
      const minorWords = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by', 'in', 'of', 'with', 'is']);
      return str
        .split(' ')
        .map((word, i) => {
          if (i === 0 || !minorWords.has(word.toLowerCase())) {
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
          }
          return word.toLowerCase();
        })
        .join(' ');
    };

    const toSentenceCase = (str: string): string => {
      if (!str) return str;
      return str.charAt(0).toUpperCase() + str.slice(1);
    };

    for (const scene of videoScript.scenes) {
      if (scene.content.headline) {
        scene.content.headline = toTitleCase(scene.content.headline);
      }
      if (scene.content.subtext) {
        scene.content.subtext = toSentenceCase(scene.content.subtext);
      }
      if (scene.content.features) {
        for (const feature of scene.content.features) {
          feature.title = toTitleCase(feature.title);
        }
      }
    }

    // Ensure all scenes have unique IDs
    videoScript.scenes = videoScript.scenes.map((scene) => ({
      ...scene,
      id: scene.id || uuidv4(),
    }));

    // =========================================================================
    // RECORDING SCENE INJECTION: Ensure every recording appears as a scene
    // =========================================================================
    if (recordings.length > 0) {
      const existingRecordingIds = new Set(
        videoScript.scenes
          .filter(s => s.type === "recording" || (s.content as any).recordingId)
          .map(s => (s.content as any).recordingId)
      );

      const missingRecordings = recordings.filter(r => !existingRecordingIds.has(r.id));

      if (missingRecordings.length > 0) {
        console.log(`[ScriptWriter] Injecting ${missingRecordings.length} missing recording scene(s)`);
        // Insert before the CTA (last scene)
        const ctaIndex = videoScript.scenes.findIndex(s => s.type === "cta");
        const insertAt = ctaIndex >= 0 ? ctaIndex : videoScript.scenes.length;

        for (const rec of missingRecordings) {
          const durationFrames = Math.round(rec.duration * 30);
          videoScript.scenes.splice(insertAt, 0, {
            id: `recording-${rec.id}`,
            startFrame: 0,
            endFrame: durationFrames,
            type: "recording",
            content: {
              headline: rec.featureName,
              subtext: rec.description,
              recordingId: rec.id,
              recordingVideoUrl: rec.videoUrl,
              featureName: rec.featureName,
              description: rec.description,
              mockupFrame: (rec as any).mockupFrame || "minimal",
            },
            animation: { enter: "fade", exit: "fade" },
            style: {
              background: "#0a0a0f",
              textColor: "#ffffff",
              fontSize: "medium",
            },
          } as any);
        }
      }
    }

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
              icon: null,
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
