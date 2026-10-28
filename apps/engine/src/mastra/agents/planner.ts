/**
 * Visual planner: script + (estimated or real) word timings + format → scene list.
 * The LLM decides content per scene (block, headline, data, asset need, sfx cue); timings are computed
 * deterministically afterwards (lib/planning/allocate.ts) from beat shares + real word boundaries.
 * Prompts come from hf-kit (single source): `buildSystemPrompt({output:"draft"})` carries the block catalogue
 * with shapes generated from the zod schemas, sent as a cacheable system block; `buildScenePlanPrompt` is the user turn.
 */
import { z } from "zod";
import type { Script, VoiceTrack, FormatTemplate, IdentityKit } from "@remawt/shared";
import { generateStructured, type AgentSpec } from "../llm.js";
import type { Quality } from "../models.js";
import { hfkit } from "../../lib/hfkit.js";
import { SFX_CUES } from "../../lib/audio/sfx.js";

/** LLMs sometimes send data as a JSON string or a bare array; normalise to an object so validation doesn't burn a retry. */
const PlannedData = z.preprocess((v) => {
  if (typeof v === "string") { try { const p = JSON.parse(v); return p && typeof p === "object" && !Array.isArray(p) ? p : {}; } catch { return {}; } }
  if (Array.isArray(v)) return { items: v };
  return v === null ? undefined : v;
}, z.record(z.string(), z.unknown()).optional());

export const PlannedSceneSchema = z.object({
  id: z.string(),
  beatId: z.string(),
  block: z.string(),
  headline: z.string().optional(),
  body: z.string().optional(),
  data: PlannedData,
  asset: z.object({ kind: z.enum(["none", "image", "stock", "stock-video", "icon"]), prompt: z.string().optional(), query: z.string().optional() }).optional(),
  transitionIn: z.string().optional(),
  sfx: z.string().optional(),
});
export const PlannerOutputSchema = z.object({
  scenes: z.array(PlannedSceneSchema).min(1),
  musicMood: z.string(),
});
export type PlannerOutput = z.infer<typeof PlannerOutputSchema>;

/** Engine-specific rules appended to hf-kit's system prompt (asset + sfx policy). */
export const PLANNER_RULES = [
  `"asset": choose {"kind":"none"} when typography/diagram/chart is enough (preferred); "icon" for a simple pictogram (prompt); "image" for an illustrative AI image (prompt, no text, no real people; use block "image"); "stock"/"stock-video" for real-world footage (short search query). At most one asset per scene and at most 4 non-"none" assets per video.`,
  `"sfx": optional cue name for a scene's entrance, on only 20–40% of scenes. Allowed cues: ${Object.keys(SFX_CUES).join(", ")}.`,
  `"musicMood": one of upbeat, calm, dramatic, curious, serious, playful.`,
  `Scene ids are "s1", "s2", … in order. Every scene's beatId is one of the format's beat ids. headline ≤ 7 words on non-headline blocks; body ≤ 14 words.`,
  `Charts and evidence scenes (chart, source-card, counter with a statistic) must name the source (data.source or the source-card's source).`,
];

export const plannerSpec: AgentSpec = {
  id: "planner",
  name: "Visual planner",
  role: "plan",
  // The block catalogue (generated shapes + valid examples) comes from hf-kit's cached system prompt; see buildPlannerSystem.
  instructions: `You are the visual planner for a vertical 1080x1920 faceless explainer. Follow the system prompt's block catalogue exactly: for every scene, "data" must match that block's example shape exactly. Return JSON only.`,
};

export function buildPlannerSystem(opts: { format: FormatTemplate; kit: IdentityKit; durationMs: number }): string {
  return hfkit.buildSystemPrompt({ kit: opts.kit, format: opts.format, width: 1080, height: 1920, durationMs: opts.durationMs, output: "draft", extraRules: PLANNER_RULES });
}

export function buildPlanPrompt(opts: { script: Script; voice: VoiceTrack; format: FormatTemplate; kit: IdentityKit }): string {
  return hfkit.buildScenePlanPrompt({ ...opts, output: "draft" });
}

export async function planScenes(opts: { script: Script; voice: VoiceTrack; format: FormatTemplate; kit: IdentityKit }, quality: Quality): Promise<PlannerOutput> {
  const out = await generateStructured({
    spec: plannerSpec, quality, label: "plan", schema: PlannerOutputSchema, prompt: buildPlanPrompt(opts),
    cachedSystem: buildPlannerSystem({ format: opts.format, kit: opts.kit, durationMs: opts.voice.durationMs }), maxOutputTokens: 12000,
  });
  // Normalise: unique ids, only known beat ids (unknown → nearest previous beat).
  const beatIds = new Set(opts.format.beats.map((b) => b.id));
  let lastBeat = opts.format.beats[0].id;
  const seen = new Set<string>();
  out.scenes = out.scenes.map((s, i) => {
    const beatId = beatIds.has(s.beatId) ? s.beatId : lastBeat;
    lastBeat = beatId;
    let id = s.id || `s${i + 1}`;
    if (seen.has(id)) id = `s${i + 1}`;
    seen.add(id);
    return { ...s, id, beatId };
  });
  return out;
}
