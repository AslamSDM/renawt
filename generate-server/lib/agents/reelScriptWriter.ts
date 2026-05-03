/**
 * Reel Script Writer Agent
 *
 * Takes a text script (narration / story) and breaks it into fast-paced scenes,
 * each with a visual prompt for Veo 3 video generation and a narration segment
 * for ElevenLabs TTS.
 *
 * Scenes are capped at 2 seconds max to maintain a fast, punchy reel feel.
 */

import { chatWithGeminiFlash, SCRIPT_WRITER_CONFIG } from "./model";
import { v4 as uuidv4 } from "uuid";

export interface ReelScene {
  /** Unique scene ID */
  id: string;
  /** Scene order index */
  order: number;
  /** Narration text spoken during this scene */
  narrationText: string;
  /** Visual prompt for Veo 3 video generation */
  visualPrompt: string;
  /** Description of the start frame / key visual */
  startFrameDescription: string;
  /** Duration in seconds (1-2s, never exceeds 2s) */
  durationSec: number;
  /** Transition to next scene */
  transition: "cut" | "crossfade" | "whip-pan" | "zoom" | "match-cut";
  /** Visual mood/style keywords */
  mood: string;
}

export interface ReelScript {
  /** Video title */
  title: string;
  /** Total duration in seconds */
  totalDurationSec: number;
  /** All scenes */
  scenes: ReelScene[];
  /** Suggested background music mood */
  musicMood: string;
  /** Narration voice style hint */
  voiceStyle: string;
}

const REEL_SCRIPT_SYSTEM_PROMPT = `You are a fast-paced video reel director. You take a script/story and break it into rapid-fire scenes for a TikTok/Reels/Shorts style video.

## RULES
1. **Each scene is MAX 2 seconds.** Most scenes should be 1-1.5 seconds. Only dramatic pauses can be 2s.
2. Split narration into short fragments — 3-8 words per scene. One idea per scene.
3. For each scene, write a detailed visual prompt that will be used to generate a 2-5 second AI video clip.
4. Visual prompts should be cinematic, specific, and vivid — describe camera angle, lighting, movement, and subject.
5. Each scene needs a "startFrameDescription" — a single-frame snapshot of what the viewer sees first.
6. Keep the overall energy HIGH. Use varied transitions (cuts, whip-pans, zooms, match-cuts).
7. Alternate between close-ups, wide shots, and medium shots for visual variety.
8. Total video should be 15-60 seconds depending on the script length.

## VISUAL PROMPT GUIDELINES
Write prompts like a cinematographer:
- "Close-up of hands typing on a mechanical keyboard, warm desk lamp lighting, shallow depth of field, 4K"
- "Aerial drone shot of a city skyline at golden hour, camera slowly pushing forward, cinematic"
- "Extreme close-up of an eye reflecting a computer screen, blue light, dramatic lighting"
- "Wide shot of an empty modern office, morning sunlight streaming through floor-to-ceiling windows, minimal"

## TRANSITION GUIDE
- **cut**: Sharp instant transition (most common, keeps energy high)
- **whip-pan**: Fast horizontal blur transition (great between related scenes)
- **zoom**: Quick zoom in/out transition (for emphasis moments)
- **crossfade**: Smooth blend (use sparingly, for mood shifts)
- **match-cut**: Visual match between scenes (advanced, use for clever connections)

## OUTPUT FORMAT
Return ONLY valid JSON:
{
  "title": "Reel title",
  "totalDurationSec": number,
  "scenes": [
    {
      "id": "unique-id",
      "order": 0,
      "narrationText": "Short narration fragment",
      "visualPrompt": "Detailed cinematic visual prompt for video generation",
      "startFrameDescription": "What the first frame looks like",
      "durationSec": 1.5,
      "transition": "cut",
      "mood": "energetic, dramatic"
    }
  ],
  "musicMood": "energetic electronic" | "dramatic orchestral" | "chill lo-fi" | etc,
  "voiceStyle": "confident and fast-paced" | "calm narrator" | "excited" | etc
}

Return ONLY valid JSON. No markdown, no explanation.`;

/**
 * Break a script into fast-paced reel scenes using LLM.
 */
export async function generateReelScript(
  script: string,
  options?: {
    style?: string;
    maxDurationSec?: number;
    aspectRatio?: "16:9" | "9:16" | "1:1";
  },
): Promise<ReelScript> {
  const { style = "cinematic", maxDurationSec = 60, aspectRatio = "9:16" } = options || {};

  const userMessage = `Break this script into a fast-paced video reel.

SCRIPT:
"""
${script}
"""

STYLE: ${style}
MAX DURATION: ${maxDurationSec} seconds
ASPECT RATIO: ${aspectRatio} (consider framing in visual prompts)
FORMAT: ${aspectRatio === "9:16" ? "Vertical/Portrait (TikTok, Reels, Shorts)" : aspectRatio === "1:1" ? "Square (Instagram)" : "Landscape (YouTube)"}

Remember: Each scene is MAX 2 seconds. Keep it punchy and fast. Split narration into bite-sized fragments.

Return ONLY valid JSON.`;

  console.log(
    `[ReelScriptWriter] Generating reel script from ${script.length} char script...`,
  );

  const response = await chatWithGeminiFlash(
    [
      { role: "system", content: REEL_SCRIPT_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    { ...SCRIPT_WRITER_CONFIG, temperature: 0.8 },
  );

  // Extract JSON from response
  const jsonMatch = response.content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to extract JSON from reel script response");
  }

  const reelScript = JSON.parse(jsonMatch[0]) as ReelScript;

  // Post-process: enforce max 2s per scene and assign IDs
  let totalDuration = 0;
  reelScript.scenes = reelScript.scenes.map((scene, i) => {
    const duration = Math.min(2, Math.max(0.5, scene.durationSec || 1.5));
    totalDuration += duration;
    return {
      ...scene,
      id: scene.id || uuidv4(),
      order: i,
      durationSec: duration,
    };
  });
  reelScript.totalDurationSec = totalDuration;

  console.log(
    `[ReelScriptWriter] Generated ${reelScript.scenes.length} scenes, total ${totalDuration.toFixed(1)}s`,
  );

  return reelScript;
}

/**
 * Generate a reel script directly from a topic/idea (without a pre-written script).
 * The LLM writes both the narration and visual direction.
 */
export async function generateReelFromTopic(
  topic: string,
  options?: {
    style?: string;
    targetDurationSec?: number;
    aspectRatio?: "16:9" | "9:16" | "1:1";
  },
): Promise<ReelScript> {
  const { style = "cinematic", targetDurationSec = 30, aspectRatio = "9:16" } = options || {};

  const userMessage = `Create a fast-paced video reel about this topic:

TOPIC: ${topic}

STYLE: ${style}
TARGET DURATION: ${targetDurationSec} seconds
ASPECT RATIO: ${aspectRatio}

Write both the narration script AND visual direction. Make it engaging, punchy, and fast.
Each scene MAX 2 seconds. Total should be around ${targetDurationSec} seconds.

Return ONLY valid JSON.`;

  console.log(`[ReelScriptWriter] Generating reel from topic: "${topic.substring(0, 80)}..."`);

  const response = await chatWithGeminiFlash(
    [
      { role: "system", content: REEL_SCRIPT_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    { ...SCRIPT_WRITER_CONFIG, temperature: 0.9 },
  );

  const jsonMatch = response.content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to extract JSON from reel topic response");
  }

  const reelScript = JSON.parse(jsonMatch[0]) as ReelScript;

  // Enforce constraints
  let totalDuration = 0;
  reelScript.scenes = reelScript.scenes.map((scene, i) => {
    const duration = Math.min(2, Math.max(0.5, scene.durationSec || 1.5));
    totalDuration += duration;
    return {
      ...scene,
      id: scene.id || uuidv4(),
      order: i,
      durationSec: duration,
    };
  });
  reelScript.totalDurationSec = totalDuration;

  console.log(
    `[ReelScriptWriter] Generated ${reelScript.scenes.length} scenes from topic, total ${totalDuration.toFixed(1)}s`,
  );

  return reelScript;
}
