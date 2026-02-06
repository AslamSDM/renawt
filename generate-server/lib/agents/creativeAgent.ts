/**
 * CREATIVE ANIMATION AGENT
 *
 * Runs multiple LLM loops to generate:
 * 1. Creative text content (headlines, statements, metaphors)
 * 2. Animation effect specifications
 * 3. Visual style variations
 *
 * Each loop builds on the previous to create increasingly complex effects.
 */

import { chatWithKimi } from "./model";

export interface AnimationEffect {
  type:
    | "blur-in"
    | "scale-bounce"
    | "typewriter"
    | "glitch"
    | "wave"
    | "split-reveal"
    | "particle-form"
    | "liquid-morph";
  duration: number;
  easing: string;
  delay: number;
  params: Record<string, number | string | boolean>;
}

export interface CreativeTextBlock {
  id: string;
  content: string;
  style: "hero" | "statement" | "whisper" | "shout" | "poetic" | "tech";
  fontSize: number;
  color: string;
  animation: AnimationEffect;
  position: { x: number; y: number };
}

export interface CreativeScene {
  id: string;
  duration: number;
  background: {
    type: "gradient" | "particles" | "noise" | "aurora" | "mesh";
    colors: string[];
    animation: string;
  };
  textBlocks: CreativeTextBlock[];
  transitions: {
    enter: string;
    exit: string;
  };
}

export interface CreativeVideoScript {
  title: string;
  theme: string;
  mood: string;
  totalDuration: number;
  scenes: CreativeScene[];
  musicPrompt: string;
}

// ============================================================================
// JSON REPAIR UTILITIES
// ============================================================================

/**
 * Try to repair truncated or malformed JSON from LLM
 */
function repairJSON(str: string): string {
  let json = str.trim();

  // Remove markdown code blocks
  json = json.replace(/```json\s*/g, "").replace(/```\s*/g, "");

  // Count brackets to find truncation
  let openBraces = 0;
  let openBrackets = 0;

  for (const char of json) {
    if (char === "{") openBraces++;
    if (char === "}") openBraces--;
    if (char === "[") openBrackets++;
    if (char === "]") openBrackets--;
  }

  // Close unclosed brackets/braces
  while (openBrackets > 0) {
    json += "]";
    openBrackets--;
  }
  while (openBraces > 0) {
    json += "}";
    openBraces--;
  }

  // Fix trailing commas before closing brackets
  json = json.replace(/,\s*]/g, "]");
  json = json.replace(/,\s*}/g, "}");

  return json;
}

/**
 * Safely parse JSON with repair attempt
 */
function safeParseJSON<T>(content: string, fallback: T): T {
  if (!content || content.trim().length === 0) {
    console.warn("[CreativeAgent] Empty response from LLM, using fallback");
    return fallback;
  }

  try {
    // First try direct parse
    const jsonMatch = content.match(/[\[{][\s\S]*[\]}]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // Try repair
    try {
      const jsonMatch = content.match(/[\[{][\s\S]*[\]}]/);
      if (jsonMatch) {
        const repaired = repairJSON(jsonMatch[0]);
        return JSON.parse(repaired);
      }
    } catch (e2) {
      console.warn("[CreativeAgent] JSON repair failed:", e2);
    }
  }

  return fallback;
}

// ============================================================================
// LOOP 1: Generate creative text content
// ============================================================================

async function generateCreativeText(
  topic: string,
  count: number,
): Promise<string[]> {
  console.log(
    `[CreativeAgent] Loop 1: Generating ${count} creative text pieces for "${topic}"...`,
  );

  const fallbackTexts = [
    `The Future of ${topic}`,
    "Innovation Unleashed",
    "Beyond Imagination",
    "Experience the Difference",
    "Start Your Journey",
    "Powered by Innovation",
    "Built for Tomorrow",
    "Define Your Future",
  ].slice(0, count);

  const prompt = `Generate ${count} SHORT, PUNCHY text pieces for a video about "${topic}".

Mix these styles:
- Hero headlines (3-5 words, bold)
- Poetic whispers (metaphorical)
- Tech statements (futuristic)
- Emotional triggers (relatable)

Return ONLY a JSON array of strings:
["text1", "text2", "text3"]

Be CREATIVE. No clichés.`;

  try {
    const response = await chatWithKimi([{ role: "user", content: prompt }], {
      temperature: 0.9,
      maxTokens: 500,
    });

    const texts = safeParseJSON<string[]>(response.content, fallbackTexts);
    return texts.length > 0 ? texts : fallbackTexts;
  } catch (error) {
    console.error("[CreativeAgent] Text generation error:", error);
    return fallbackTexts;
  }
}

// ============================================================================
// LOOP 2: Generate animation effects for each text
// ============================================================================

const ANIMATION_TYPES: AnimationEffect["type"][] = [
  "blur-in",
  "scale-bounce",
  "typewriter",
  "glitch",
  "wave",
  "split-reveal",
  "particle-form",
  "liquid-morph",
];

function createFallbackAnimations(count: number): AnimationEffect[] {
  return Array.from({ length: count }, (_, i) => ({
    type: ANIMATION_TYPES[i % ANIMATION_TYPES.length],
    duration: 30 + (i % 3) * 15,
    easing: "easeOut",
    delay: i * 3,
    params: { intensity: 1 + (i % 3) },
  }));
}

async function generateAnimationEffects(
  texts: string[],
): Promise<AnimationEffect[]> {
  console.log(
    `[CreativeAgent] Loop 2: Generating animations for ${texts.length} text blocks...`,
  );

  const fallbackAnimations = createFallbackAnimations(texts.length);

  const prompt = `For ${texts.length} text pieces, assign UNIQUE animations.

Types: blur-in, scale-bounce, typewriter, glitch, wave, split-reveal, particle-form, liquid-morph

Return JSON array:
[
  {"type": "blur-in", "duration": 30, "easing": "easeOut", "delay": 0, "params": {"blurAmount": 15}},
  {"type": "scale-bounce", "duration": 25, "easing": "spring", "delay": 5, "params": {"intensity": 2}}
]

Exactly ${texts.length} items.`;

  try {
    const response = await chatWithKimi([{ role: "user", content: prompt }], {
      temperature: 0.8,
      maxTokens: 1500,
    });

    const animations = safeParseJSON<AnimationEffect[]>(
      response.content,
      fallbackAnimations,
    );

    // Validate and fill missing fields
    return animations.map((anim, i) => ({
      type: ANIMATION_TYPES.includes(anim.type)
        ? anim.type
        : ANIMATION_TYPES[i % ANIMATION_TYPES.length],
      duration: anim.duration || 30,
      easing: anim.easing || "easeOut",
      delay: anim.delay ?? i * 3,
      params: anim.params || { intensity: 1 },
    }));
  } catch (error) {
    console.error("[CreativeAgent] Animation generation error:", error);
    return fallbackAnimations;
  }
}

// ============================================================================
// LOOP 3: Generate scene compositions
// ============================================================================

const BACKGROUND_TYPES = ["gradient", "particles", "aurora", "mesh"] as const;
const ENTER_TRANSITIONS = ["fade", "zoom", "slide-up", "glitch-in"] as const;
const EXIT_TRANSITIONS = ["fade", "blur-out", "particle-disperse"] as const;

function createFallbackScenes(
  texts: string[],
  animations: AnimationEffect[],
): CreativeScene[] {
  const colors = [
    ["#1a1a2e", "#3b82f6"],
    ["#0f172a", "#8b5cf6", "#ec4899"],
    ["#1e1b4b", "#4f46e5"],
    ["#0c0a09", "#f97316", "#eab308"],
  ];

  return texts.map((text, i) => ({
    id: `scene-${i}`,
    duration: 90 + (i % 3) * 30,
    background: {
      type: BACKGROUND_TYPES[i % BACKGROUND_TYPES.length],
      colors: colors[i % colors.length],
      animation: "slow-drift",
    },
    textBlocks: [
      {
        id: `text-${i}`,
        content: text,
        style: "hero" as const,
        fontSize: 72,
        color: "#ffffff",
        animation: animations[i] || animations[0],
        position: { x: 50, y: 50 },
      },
    ],
    transitions: {
      enter: ENTER_TRANSITIONS[i % ENTER_TRANSITIONS.length],
      exit: EXIT_TRANSITIONS[i % EXIT_TRANSITIONS.length],
    },
  }));
}

async function generateSceneCompositions(
  texts: string[],
  animations: AnimationEffect[],
  mood: string,
): Promise<CreativeScene[]> {
  console.log(
    `[CreativeAgent] Loop 3: Composing scenes with mood "${mood}"...`,
  );

  const fallbackScenes = createFallbackScenes(texts, animations);

  const prompt = `Create ${Math.min(texts.length, 6)} scenes for a ${mood} video with ${texts.length} text blocks.

For each scene specify:
- duration: 60-150 frames (30fps)
- bgType: gradient | particles | aurora | mesh
- colors: 2 hex colors
- textIndices: which texts (0-indexed)
- enter: fade | zoom | slide-up
- exit: fade | blur-out

Return compact JSON:
{"scenes":[{"duration":90,"bgType":"aurora","colors":["#1a1a2e","#3b82f6"],"textIndices":[0],"enter":"fade","exit":"blur-out"}]}`;

  try {
    const response = await chatWithKimi([{ role: "user", content: prompt }], {
      temperature: 0.7,
      maxTokens: 1500,
    });

    const parsed = safeParseJSON<{ scenes: any[] }>(response.content, {
      scenes: [],
    });

    if (!parsed.scenes || parsed.scenes.length === 0) {
      console.warn("[CreativeAgent] No scenes in response, using fallback");
      return fallbackScenes;
    }

    // Convert to full scene objects
    return parsed.scenes.map((s: any, i: number) => ({
      id: `scene-${i}`,
      duration: s.duration || 120,
      background: {
        type:
          (BACKGROUND_TYPES.includes(s.bgType)
            ? s.bgType
            : s.background?.type) || "gradient",
        colors: s.colors || s.background?.colors || ["#1a1a2e", "#3b82f6"],
        animation: "slow-drift",
      },
      textBlocks: (s.textIndices || [i % texts.length]).map((idx: number) => ({
        id: `text-${i}-${idx}`,
        content: texts[idx] || texts[0],
        style: "hero" as const,
        fontSize: 72,
        color: "#ffffff",
        animation: animations[idx] || animations[0],
        position: { x: 50, y: 50 },
      })),
      transitions: {
        enter: s.enter || "fade",
        exit: s.exit || "fade",
      },
    }));
  } catch (error) {
    console.error("[CreativeAgent] Scene composition error:", error);
    return fallbackScenes;
  }
}

// ============================================================================
// LOOP 4: Generate music prompt for open source search
// ============================================================================

async function generateMusicPrompt(
  mood: string,
  scenes: CreativeScene[],
): Promise<string> {
  console.log(`[CreativeAgent] Loop 4: Generating music search prompt...`);

  const fallbackPrompts: Record<string, string> = {
    energetic: "upbeat electronic driving motivational",
    calm: "ambient peaceful atmospheric piano",
    dramatic: "cinematic epic orchestral tension",
    playful: "fun quirky upbeat positive",
  };

  const fallback = fallbackPrompts[mood] || "modern ambient electronic";

  const bgTypes = scenes.map((s) => s.background.type).join(", ");

  const prompt = `Video mood: "${mood}", scenes: ${bgTypes}

Suggest a music search query (4-5 words) for royalty-free sites.
Return ONLY the search terms, no quotes.`;

  try {
    const response = await chatWithKimi([{ role: "user", content: prompt }], {
      temperature: 0.5,
      maxTokens: 50,
    });

    const result = response.content.trim().replace(/['"]/g, "");
    return result.length > 0 ? result : fallback;
  } catch (error) {
    console.error("[CreativeAgent] Music prompt error:", error);
    return fallback;
  }
}

// ============================================================================
// MAIN: Run all loops and compose final script
// ============================================================================

export async function runCreativeAgentLoops(
  topic: string,
  mood: string = "energetic",
  textCount: number = 8,
): Promise<CreativeVideoScript> {
  console.log(
    `[CreativeAgent] Starting multi-loop generation for "${topic}" with mood "${mood}"...`,
  );

  // LOOP 1: Generate creative texts
  const texts = await generateCreativeText(topic, textCount);
  console.log(`[CreativeAgent] Generated ${texts.length} text pieces`);

  // LOOP 2: Generate animation effects
  const animations = await generateAnimationEffects(texts);
  console.log(
    `[CreativeAgent] Generated ${animations.length} animation effects`,
  );

  // LOOP 3: Compose scenes
  const scenes = await generateSceneCompositions(texts, animations, mood);
  console.log(`[CreativeAgent] Created ${scenes.length} scenes`);

  // LOOP 4: Generate music prompt
  const musicPrompt = await generateMusicPrompt(mood, scenes);
  console.log(`[CreativeAgent] Music search: "${musicPrompt}"`);

  // Calculate total duration
  const totalDuration = scenes.reduce((acc, s) => acc + s.duration, 0);

  return {
    title: topic,
    theme: mood,
    mood,
    totalDuration,
    scenes,
    musicPrompt,
  };
}

// Export individual loops for granular control
export {
  generateCreativeText,
  generateAnimationEffects,
  generateSceneCompositions,
  generateMusicPrompt,
};
