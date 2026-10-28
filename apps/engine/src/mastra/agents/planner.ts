/**
 * Visual planner: script + (estimated or real) word timings + format → scene list.
 * The LLM decides content per scene (block, headline, data, asset need, sfx cue); timings are computed
 * deterministically afterwards (lib/planning/allocate.ts) from beat shares + real word boundaries.
 */
import { z } from "zod";
import type { Script, VoiceTrack, FormatTemplate, IdentityKit } from "@remawt/shared";
import { generateStructured, type AgentSpec } from "../llm.js";
import type { Quality } from "../models.js";
import { hfkit } from "../../lib/hfkit.js";
import { SFX_CUES } from "../../lib/audio/sfx.js";

export const PlannedSceneSchema = z.object({
  id: z.string(),
  beatId: z.string(),
  block: z.string(),
  headline: z.string().optional(),
  body: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  asset: z.object({ kind: z.enum(["none", "image", "stock", "stock-video", "icon"]), prompt: z.string().optional(), query: z.string().optional() }).optional(),
  transitionIn: z.string().optional(),
  sfx: z.string().optional(),
});
export const PlannerOutputSchema = z.object({
  scenes: z.array(PlannedSceneSchema).min(1),
  musicMood: z.string(),
});
export type PlannerOutput = z.infer<typeof PlannerOutputSchema>;

export const plannerSpec: AgentSpec = {
  id: "planner",
  name: "Visual planner",
  role: "plan",
  instructions: `You plan the visuals of a vertical 1080x1920 faceless explainer built from HyperFrames registry blocks.
- Produce scenes in narration order. Every scene has a beatId from the format, and uses the beat's suggested block family unless a different family clearly serves the line better.
- One idea per scene; 1–3 scenes per beat; a new scene roughly every 2–5 seconds of narration.
- headline ≤ 7 words; body ≤ 14 words. Put structured data in "data" (e.g. chart series {labels:[], values:[], unit, source}, stats {left:{label,value}, right:{...}}, list items, map points, source {title,url}).
- Charts and evidence scenes MUST include the source name in data.source.
- asset: choose "none" when typography/diagram/chart is enough (preferred); "icon" for a simple pictogram (prompt); "image" for an illustrative AI image (prompt, no text, no real people); "stock"/"stock-video" for real-world footage (short search query). At most one asset per scene, and at most 4 non-"none" assets per video.
- sfx: optional cue name for a scene's entrance, only on 20–40% of scenes. Allowed cues: ${Object.keys(SFX_CUES).join(", ")}.
- musicMood: one of upbeat, calm, dramatic, curious, serious, playful.
- Scene ids: "s1", "s2", ... Return JSON only.`,
};

export function buildPlanPrompt(opts: { script: Script; voice: VoiceTrack; format: FormatTemplate; kit: IdentityKit }): string {
  // Prefer hf-kit's prompt builder (it knows the block registry); fall back to a local one.
  try {
    return hfkit.buildScenePlanPrompt(opts);
  } catch { /* fall back to the local prompt below */ }
  const { script, format, kit } = opts;
  return [
    `FORMAT: ${format.name}. Beats: ${format.beats.map((b) => `${b.id}→${b.block}`).join(", ")}. Visual hints: ${format.visualHints.join(", ")}.`,
    `SKIN: ${kit.skin.name} (motion ${kit.skin.motion}, shapes ${kit.skin.shapes}, captions ${kit.skin.captionStyle}).`,
    `NARRATION DURATION: ${Math.round(opts.voice.durationMs / 100) / 10}s`,
    `SCRIPT LINES:\n${script.lines.map((l, i) => `${i + 1}. [${l.beatId}] "${l.text}"${l.onScreen ? ` | on-screen: ${l.onScreen}` : ""}${l.visualNote ? ` | visual: ${l.visualNote}` : ""}`).join("\n")}`,
    script.sources.length ? `SOURCES: ${script.sources.map((s) => `${s.title} (${s.url})`).join("; ")}` : "",
    `Return {scenes:[{id, beatId, block, headline, body, data, asset:{kind,prompt,query}, transitionIn, sfx}], musicMood}.`,
  ].filter(Boolean).join("\n\n");
}

export async function planScenes(opts: { script: Script; voice: VoiceTrack; format: FormatTemplate; kit: IdentityKit }, quality: Quality): Promise<PlannerOutput> {
  const out = await generateStructured({ spec: plannerSpec, quality, label: "plan", schema: PlannerOutputSchema, prompt: buildPlanPrompt(opts), maxOutputTokens: 12000 });
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
