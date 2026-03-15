/**
 * CREATIVE DIRECTOR AGENT
 *
 * Runs between ScriptWriter and RemotionTranslator.
 * Takes a VideoScript and enriches it with specific creative decisions:
 * - Unexpected transitions for each scene
 * - Typography pairings and size variations
 * - Camera angle suggestions per scene
 * - Beat-synced animation timing (intra-scene)
 * - Color accent placement and gradient directions
 *
 * Uses Gemini Flash for speed (~2-4s). Fails gracefully — if it errors,
 * the original script passes through unmodified.
 */

import { chatWithGeminiFlash } from "./model";
import type { VideoScript } from "../types";
import type { VideoGenerationStateType } from "./state";

export interface CreativeEnhancements {
  sceneDirections: Array<{
    sceneId: string;
    cameraMovement: "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "drift" | "parallax";
    transitionIn: "fade" | "slide-up" | "slide-left" | "wipe" | "scale" | "blur-reveal" | "glitch-in";
    animationStyle: "word-by-word" | "line-sweep" | "scale-pop" | "blur-fade" | "typewriter" | "split-reveal";
    beatSyncIntensity: "subtle" | "moderate" | "strong"; // How much elements pulse to beat
    colorAccentPlacement: string; // e.g., "gradient on last 2 words", "glow behind headline"
    typographyNote: string; // e.g., "condensed weight 900 for impact", "italic serif for elegance"
  }>;
  globalNotes: string; // Overall creative direction for the code generator
  fontPairing: {
    primary: string; // e.g., "Montserrat"
    accent: string; // e.g., "Playfair Display" for contrast
  };
  colorStrategy: string; // e.g., "Use primary for headlines, secondary for accents, dark-to-light aurora progression"
}

const CREATIVE_DIRECTOR_PROMPT = `You are a creative director for short-form product videos. Your job is to take a video script and add specific creative direction for each scene.

For each scene, specify:
1. **cameraMovement**: One of: zoom-in, zoom-out, pan-left, pan-right, drift, parallax
   - Alternate between zoom-in and zoom-out across consecutive scenes
   - Use pan for feature scenes, parallax for hero/CTA scenes
2. **transitionIn**: One of: fade, slide-up, slide-left, wipe, scale, blur-reveal, glitch-in
   - Vary transitions — don't use the same one twice in a row
   - Use blur-reveal for text-heavy scenes, scale for impact moments
3. **animationStyle**: How text enters: word-by-word, line-sweep, scale-pop, blur-fade, typewriter, split-reveal
   - word-by-word for taglines, scale-pop for CTAs, line-sweep for features
4. **beatSyncIntensity**: How much elements pulse to music beat: subtle, moderate, strong
   - subtle for professional, strong for energetic, moderate for default
5. **colorAccentPlacement**: Specific instruction for where brand color accents go
6. **typographyNote**: Specific font weight/style for this scene

Also provide:
- **fontPairing**: Primary font (for headlines) + accent font (for contrast)
- **colorStrategy**: Overall approach to using brand colors across scenes
- **globalNotes**: 1-2 sentences of creative direction for the code generator

Return ONLY valid JSON matching this schema:
{
  "sceneDirections": [{"sceneId": "...", "cameraMovement": "...", "transitionIn": "...", "animationStyle": "...", "beatSyncIntensity": "...", "colorAccentPlacement": "...", "typographyNote": "..."}],
  "globalNotes": "...",
  "fontPairing": {"primary": "...", "accent": "..."},
  "colorStrategy": "..."
}`;

export async function creativeDirectorNode(
  state: VideoGenerationStateType,
): Promise<Partial<VideoGenerationStateType>> {
  console.log("[CreativeDirector] Enriching video script with creative direction...");

  const script = state.videoScript;
  if (!script || !script.scenes || script.scenes.length === 0) {
    console.warn("[CreativeDirector] No script to enhance, passing through");
    return {};
  }

  const bpm = state.userPreferences?.audio?.bpm || script.music?.tempo || 120;
  const framesPerBeat = (60 / bpm) * 30;
  const style = state.userPreferences?.style || "professional";
  const tone = state.productData?.tone || style;

  const userPrompt = `Enhance this ${script.scenes.length}-scene video script with creative direction.

Product: ${state.productData?.name || "Product"}
Tone: ${tone}
Style: ${style}
BPM: ${bpm} (${framesPerBeat.toFixed(0)} frames per beat at 30fps)
Brand Colors: ${JSON.stringify(state.productData?.colors || {})}

Scenes:
${script.scenes.map((s, i) => `${i + 1}. [${s.type}] id="${s.id}" — "${s.content?.headline || 'no headline'}" (${s.endFrame - s.startFrame} frames)`).join("\n")}

Make it visually interesting — avoid repetition. Each scene should feel different while maintaining brand consistency.`;

  try {
    const response = await chatWithGeminiFlash(
      [
        { role: "system", content: CREATIVE_DIRECTOR_PROMPT },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.8, maxTokens: 3000 },
    );

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[CreativeDirector] No JSON in response, passing through");
      return {};
    }

    // Repair common LLM JSON issues: trailing commas, truncated arrays/objects
    let jsonStr = jsonMatch[0]
      .replace(/,\s*([}\]])/g, "$1")        // trailing commas
      .replace(/\n/g, " ");                  // collapse newlines

    // If JSON is truncated (unclosed brackets), try to close them
    const opens = (jsonStr.match(/\[/g) || []).length;
    const closes = (jsonStr.match(/\]/g) || []).length;
    const openBraces = (jsonStr.match(/\{/g) || []).length;
    const closeBraces = (jsonStr.match(/\}/g) || []).length;
    jsonStr += "]".repeat(Math.max(0, opens - closes));
    jsonStr += "}".repeat(Math.max(0, openBraces - closeBraces));

    const enhancements = JSON.parse(jsonStr) as CreativeEnhancements;
    console.log(
      `[CreativeDirector] Generated directions for ${enhancements.sceneDirections?.length || 0} scenes, font: ${enhancements.fontPairing?.primary}/${enhancements.fontPairing?.accent}`,
    );

    // Attach creative enhancements to each scene
    const enhancedScript = { ...script };
    if (enhancements.sceneDirections) {
      for (const direction of enhancements.sceneDirections) {
        const scene = enhancedScript.scenes.find(s => s.id === direction.sceneId);
        if (scene) {
          (scene as any).creativeDirection = direction;
        }
      }
    }

    // Attach global creative notes to script metadata
    (enhancedScript as any).creativeNotes = {
      globalNotes: enhancements.globalNotes,
      fontPairing: enhancements.fontPairing,
      colorStrategy: enhancements.colorStrategy,
      framesPerBeat: Math.round(framesPerBeat),
      halfBeat: Math.round(framesPerBeat / 2),
      quarterBeat: Math.round(framesPerBeat / 4),
    };

    return {
      videoScript: enhancedScript,
    };
  } catch (error) {
    console.warn("[CreativeDirector] Enhancement failed (non-fatal), passing through:", error);
    return {};
  }
}
