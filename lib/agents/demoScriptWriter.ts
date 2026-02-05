import {
  chatWithKimi,
  SCRIPT_WRITER_CONFIG,
} from "./model";
import type { VideoScript } from "../types";
import type { VideoGenerationStateType } from "./state";
import { v4 as uuidv4 } from "uuid";
import { generateBeatMap } from "../audio/beatSync";

const DEMO_SCRIPT_WRITER_SYSTEM_PROMPT = `You are an expert product demo video scriptwriter creating CONTINUOUS MOTION demos.
Create polished 30-45 second videos (900-1350 frames at 30fps) with FLOWING, SEAMLESS motion - NO HARD CUTS.

## CRITICAL: CONTINUOUS MOTION DEMO STYLE
The demo should feel like ONE CONTINUOUS CAMERA MOVE through the product:
- Camera orbits/pans around UI elements
- UI components float in and out naturally
- Smooth zooms into features, then pull back
- Background continuously shifts and breathes
- Subtle warping and distortion synced to music

## DEMO VIDEO STRUCTURE (All ONE CONTINUOUS SHOT)
1. **Logo Reveal (0-3s)**: Logo warps into existence, camera begins slow push
2. **Problem (3-8s)**: Notification floats in from side, camera continues moving
3. **Product Intro (8-15s)**: Camera zooms into dashboard, UI elements animate in
4. **Feature Flow (15-30s)**: Camera pans across features, cards drift in/out
   - Each feature card floats into frame
   - Previous content slides away as new content enters
   - Continuous parallax movement
5. **Results (30-38s)**: Stats counter up while background pulses
6. **CTA (38-45s)**: Camera pushes in on final message

## MOTION TECHNIQUES FOR DEMOS
- **Continuous Zoom**: Slow zoom throughout (creates urgency)
- **UI Float**: Cards float with subtle bobbing motion
- **Parallax**: Background moves slower than foreground
- **Reveal Wipes**: Content reveals with sweeping motion
- **Pulse on Beat**: Subtle scale/glow pulses with music

## OUTPUT JSON SCHEMA
{
  "totalDuration": number (frames at 30fps),
  "videoType": "demo",
  "continuousMotion": {
    "cameraMovement": "orbit" | "dolly-in" | "pan-right",
    "cameraSpeed": 0.5-2 (slow for professional feel),
    "parallaxLayers": 3
  },
  "scenes": [{
    "id": "unique-id",
    "startFrame": number,
    "endFrame": number,
    "type": "intro" | "problem" | "product" | "feature" | "results" | "cta",
    "content": {
      "headline": "main text",
      "subtext": "supporting description" | null,
      "notification": { "title": string, "message": string, "actionText": string | null } | null,
      "stats": [{ "title": string, "value": string, "subtitle": string, "trend": "up" | "down" | "neutral" }] | null,
      "progress": { "title": string, "progress": number, "status": string } | null,
      "features": [{ "icon": emoji, "title": string, "description": string }] | null
    },
    "animation": {
      "enter": "float-in-left" | "float-in-right" | "float-in-bottom" | "scale-in" | "reveal-wipe",
      "exit": "float-out-left" | "float-out-right" | "float-out-top" | "scale-out" | "fade-drift",
      "motion": "float" | "drift" | "bob" | "none",
      "staggerDelay": 4-6 (frames)
    },
    "style": {
      "background": "none" (shared continuous background),
      "textColor": "#ffffff" or "#111827",
      "accentColor": "brand accent",
      "cardStyle": "glass-float" | "glow" | "solid",
      "depth": 1-3 (parallax layer depth)
    }
  }],
  "backgroundEffects": {
    "type": "mesh-gradient" | "soft-aurora" | "subtle-particles",
    "colors": ["#hex1", "#hex2"],
    "pulseOnBeat": true,
    "driftSpeed": 0.5
  },
  "beatSync": {
    "glowPulse": 0.1,
    "scalePulse": 0.02,
    "enabled": true
  },
  "music": {
    "tempo": 100-120,
    "mood": "professional" | "calm" | "confident"
  }
}

## DESIGN REQUIREMENTS
- Soft, elegant gradients (not harsh)
- Glassmorphic floating cards
- Continuous subtle motion on everything
- Spring physics for smooth feel
- Professional but dynamic

Return ONLY valid JSON. No markdown, no explanation.`;

async function callModel(systemPrompt: string, userMessage: string): Promise<string> {
  console.log("[DemoScriptWriter] Calling Kimi K2.5...");
  const response = await chatWithKimi(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    SCRIPT_WRITER_CONFIG,
  );
  return response.content;
}

export async function demoScriptWriterNode(
  state: VideoGenerationStateType,
): Promise<Partial<VideoGenerationStateType>> {
  console.log("[DemoScriptWriter] Starting demo script writer node...");

  if (!state.productData) {
    return {
      errors: ["No product data available for demo script generation"],
      currentStep: "error",
    };
  }

  try {
    const productData = state.productData;
    const preferences = state.userPreferences;

    // Demo videos are typically 30-45 seconds
    const targetSeconds = preferences.duration || 40;
    const targetFrames = targetSeconds * 30;
    const bpm = preferences.musicBpm || 110;

    const userMessage = `Create a DEMO video script for this SaaS product:

Product Name: ${productData.name}
Tagline: ${productData.tagline}
Description: ${productData.description}

Key Features (show 2-3 in detail):
${productData.features.slice(0, 3).map((f, i) => `${i + 1}. ${f.title}: ${f.description}`).join("\n")}

${productData.testimonials ? `User Testimonials:
${productData.testimonials.slice(0, 2).map((t) => `"${t.quote}" - ${t.author}`).join("\n")}` : ""}

Brand Colors:
- Primary: ${productData.colors.primary}
- Secondary: ${productData.colors.secondary}
- Accent: ${productData.colors.accent}

Target Duration: ${targetSeconds} seconds (${targetFrames} frames)
Music BPM: ${bpm} (calm, professional)

Create a demo that shows:
1. The problem this product solves (use notification or pain point visualization)
2. The main product interface/dashboard
3. 2-3 key features with realistic UI mockups
4. Results/metrics showing success
5. Clean CTA

Focus on realistic UI components and smooth, professional animations.

Return ONLY valid JSON.`;

    const responseText = await callModel(
      DEMO_SCRIPT_WRITER_SYSTEM_PROMPT,
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

    // Generate beat map
    const finalBpm = videoScript.music?.tempo || bpm;
    const beatMap = generateBeatMap({
      bpm: finalBpm,
      totalDurationFrames: videoScript.totalDuration,
      fps: 30,
      offset: 0,
    });

    console.log(
      `[DemoScriptWriter] Generated demo script with ${videoScript.scenes.length} scenes`,
    );

    return {
      videoScript,
      beatMap,
      currentStep: "generating",
    };
  } catch (error) {
    console.error("[DemoScriptWriter] Error:", error);
    return {
      errors: [
        `Demo script writer error: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
      currentStep: "error",
    };
  }
}
