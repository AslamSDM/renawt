/** Shared offline steps for scripts/smoke.ts and scripts/eval.ts: estimated voice → plan → align (no DB, no TTS). */
import type { FormatTemplate, IdentityKit, ScenePlan, Script, VoiceTrack } from "@remawt/shared";
import { estimateWordTimings } from "../src/lib/captions.js";
import { alignScenes } from "../src/lib/planning/allocate.js";
import { planScenes, type PlannerOutput } from "../src/mastra/agents/planner.js";

export function estimatedVoice(script: Script): VoiceTrack {
  const text = script.lines.map((l) => l.text).join(" ");
  const durationMs = Math.round(script.estimatedSec * 1000);
  return { audioUrl: "", durationMs, words: estimateWordTimings(text, durationMs), provider: "estimate", voiceId: "" };
}

/** Mirrors runAlign: deterministic timings from beat shares + word gaps, asset requests kept in data.asset. */
export function alignDraft(draft: PlannerOutput, script: Script, voice: VoiceTrack, format: FormatTemplate): ScenePlan {
  const timed = alignScenes({ scenes: draft.scenes.map((s) => ({ id: s.id, beatId: s.beatId })), lines: script.lines, beats: format.beats, words: voice.words, totalMs: voice.durationMs, beatMs: 60000 / 120 });
  const byId = new Map(timed.map((t) => [t.id, t]));
  return {
    scenes: draft.scenes.map((s) => {
      const t = byId.get(s.id)!;
      const data = { ...(s.data ?? {}), ...(s.asset && s.asset.kind !== "none" ? { asset: s.asset } : {}) };
      return { id: s.id, beatId: s.beatId, startMs: t.startMs, durationMs: t.durationMs, block: s.block, headline: s.headline, body: s.body, data, assetIds: [], transitionIn: s.transitionIn };
    }),
    totalMs: voice.durationMs,
    musicMood: draft.musicMood,
    sfxCues: [],
  };
}

export async function offlinePlan(opts: { script: Script; format: FormatTemplate; kit: IdentityKit }): Promise<{ draft: PlannerOutput; plan: ScenePlan; voice: VoiceTrack }> {
  const voice = estimatedVoice(opts.script);
  const draft = await planScenes({ script: opts.script, voice, format: opts.format, kit: opts.kit }, "standard");
  return { draft, voice, plan: alignDraft(draft, opts.script, voice, opts.format) };
}
