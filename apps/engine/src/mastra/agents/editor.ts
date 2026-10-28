/**
 * Agents for user-supplied media and free-text prompts:
 *  - pickFormat:          prompt → best FORMATS id (Haiku), when the user didn't choose one.
 *  - beatifyTranscript:   audio upload → Script whose line texts are the speaker's exact words (never rewritten);
 *                         the model only assigns beats and writes onScreen / visualNote.
 *  - planVideoEdit:       video upload → EDIT PLAN: segments to keep, motion-graphic cut-ins, overlays.
 */
import { z } from "zod";
import { FORMATS, type FormatTemplate, type IdentityKit, type Script, type Transcript } from "@remawt/shared";
import { generateStructured, type AgentSpec } from "../llm.js";
import type { Quality } from "../models.js";
import { SFX_CUES } from "../../lib/audio/sfx.js";

// ───────────── format picker ─────────────

const formatPickerSpec: AgentSpec = { id: "format-picker", name: "Format picker", role: "classify", instructions: "Pick the single best short-form video format for the user's topic. JSON only." };

export function heuristicFormat(niche: string, prefs: string[] = []): FormatTemplate {
  const pref = prefs.map((p) => FORMATS.find((f) => f.id === p)).find(Boolean);
  if (pref) return pref;
  return FORMATS.find((f) => f.niches.includes(niche.split("-")[0]) || f.niches.includes(niche)) ?? FORMATS[0];
}

export async function pickFormat(text: string, niche: string, prefs: string[] = []): Promise<FormatTemplate> {
  const options = FORMATS.filter((f) => f.niches.includes("*") || f.niches.some((n) => niche.includes(n)));
  const out = await generateStructured({
    spec: formatPickerSpec, label: "format.pick", maxOutputTokens: 300,
    schema: z.object({ format: z.string() }),
    prompt: `TOPIC: ${text.slice(0, 1500)}\nNICHE: ${niche}\nCHANNEL PREFERS: ${prefs.join(", ") || "none"}\nOPTIONS:\n${options.map((f) => `- ${f.id}: ${f.tagline}`).join("\n")}\nReturn {"format": "<id>"}.`,
  });
  return FORMATS.find((f) => f.id === out.format) ?? heuristicFormat(niche, prefs);
}

// ───────────── transcript → script (audio kind) ─────────────

const BeatifySchema = z.object({
  title: z.string(), hook: z.string(), cta: z.string(),
  hashtags: z.array(z.string()).default([]), description: z.string().default(""),
  sources: z.array(z.object({ title: z.string(), url: z.string() })).default([]),
  lines: z.array(z.object({ segmentIds: z.array(z.string()).min(1), beatId: z.string(), onScreen: z.string().optional(), visualNote: z.string().optional() })),
});

const beatifySpec: AgentSpec = {
  id: "transcript-beats", name: "Transcript beat mapper", role: "script",
  instructions: `You map a speaker's transcript onto a short-form format's beats. NEVER rewrite, paraphrase or add spoken words: lines reference transcript segment ids in order, and every speech segment must be used exactly once.
For each line add "onScreen" (≤6 words of on-screen text) and "visualNote" (what to show). "hook"/"cta" quote the speaker's own words. Sources only for claims the speaker actually made, and only if you are confident the source exists. JSON only.`,
};

export function segmentPrompt(t: Transcript, onlySpeech = true): string {
  return t.segments.filter((s) => !onlySpeech || s.kind === "speech").map((s) => `${s.id} [${(s.startMs / 1000).toFixed(1)}–${(s.endMs / 1000).toFixed(1)}s] ${s.text}`).join("\n");
}

export async function beatifyTranscript(t: Transcript, format: FormatTemplate, kit: IdentityKit, quality: Quality): Promise<Script> {
  const out = await generateStructured({
    spec: beatifySpec, quality, label: "script.transcript", schema: BeatifySchema, maxOutputTokens: 8000,
    prompt: `FORMAT ${format.name} beats: ${format.beats.map((b) => `${b.id} (${b.label}: ${b.note})`).join("; ")}\nAUDIENCE: ${kit.audience}\nSEGMENTS:\n${segmentPrompt(t)}\nReturn {title, hook, cta, hashtags, description, sources, lines:[{segmentIds, beatId, onScreen, visualNote}]}.`,
  });
  return scriptFromSegmentLines(t, out, format);
}

/** Build a Script from segment-id lines, repairing omissions/duplicates so every speech segment appears once, in order. */
export function scriptFromSegmentLines(t: Transcript, out: z.infer<typeof BeatifySchema>, format: FormatTemplate): Script {
  const speech = t.segments.filter((s) => s.kind === "speech");
  const owner = new Map<string, number>();
  out.lines.forEach((l, i) => l.segmentIds.forEach((id) => { if (!owner.has(id)) owner.set(id, i); }));
  const beatIds = new Set(format.beats.map((b) => b.id));
  const groups: Array<{ beatId: string; segs: typeof speech; onScreen?: string; visualNote?: string }> = [];
  let lastLine = -1;
  for (const s of speech) {
    const li = owner.get(s.id) ?? lastLine;
    if (li >= 0 && li === lastLine && groups.length) groups[groups.length - 1].segs.push(s);
    else {
      const l = out.lines[li] ?? out.lines[0];
      groups.push({ beatId: l && beatIds.has(l.beatId) ? l.beatId : format.beats[Math.min(groups.length, format.beats.length - 1)].id, segs: [s], onScreen: l?.onScreen, visualNote: l?.visualNote });
    }
    lastLine = li;
  }
  const lines = groups.map((g) => ({ beatId: g.beatId, text: g.segs.map((s) => s.text).join(" "), onScreen: g.onScreen, visualNote: g.visualNote, targetSec: Math.round((g.segs[g.segs.length - 1].endMs - g.segs[0].startMs) / 100) / 10 }));
  return { title: out.title, hook: out.hook, cta: out.cta, sources: out.sources, hashtags: out.hashtags, description: out.description, lines, estimatedSec: Math.round(t.durationMs / 100) / 10 };
}

// ───────────── video edit plan (video kind) ─────────────

export const EditPlanSchema = z.object({
  title: z.string(), hook: z.string(), cta: z.string(),
  hashtags: z.array(z.string()).default([]), description: z.string().default(""),
  sources: z.array(z.object({ title: z.string(), url: z.string() })).default([]),
  keep: z.array(z.string()),
  beats: z.array(z.object({ segmentId: z.string(), beatId: z.string() })).default([]),
  cutIns: z.array(z.object({
    segmentId: z.string(), block: z.string(), headline: z.string().optional(), body: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    asset: z.object({ kind: z.enum(["none", "image", "stock", "stock-video", "icon"]), prompt: z.string().optional(), query: z.string().optional() }).optional(),
    sfx: z.string().optional(),
  })).default([]),
  overlays: z.array(z.object({ segmentId: z.string(), block: z.string(), headline: z.string().optional(), body: z.string().optional() })).default([]),
  musicMood: z.string().default("calm"),
});
export type EditPlan = z.infer<typeof EditPlanSchema>;

const editorSpec: AgentSpec = {
  id: "video-editor", name: "Video editor", role: "script",
  instructions: `You are a short-form video editor cutting a creator's own footage into a tight vertical video with motion-graphic inserts.
- keep: ids of speech segments to keep, in order. Drop retakes, false starts, off-topic tangents and dead air. Never reorder.
- cutIns: full-screen motion-graphic scenes that REPLACE the picture (speech continues) during one kept segment, visualising the claim just spoken: stat counter, chart (put series + data.source in data), numbered list, kinetic headline, comparison. Use registry block families: kinetic-headline, counter, chart-bar, chart-line, numbered-card, split-stat, diagram, source-card, icon-grid. Never on the first kept segment (the speaker's face sells the hook).
- overlays: graphics drawn OVER the footage: "overlay-lower-third" on the first kept segment (name/title), "overlay-keyword" pops for key terms, "overlay-broll" for a picture-in-picture image.
- beats: assign each kept segment a beat id from the format.
- headline ≤ 6 words; body ≤ 12 words. sfx (optional) from: ${Object.keys(SFX_CUES).join(", ")}.
- title/hook/cta use the speaker's words where possible. JSON only.`,
};

export async function planVideoEdit(t: Transcript, opts: { format: FormatTemplate; kit: IdentityKit; cutIns: number; notes?: string }, quality: Quality): Promise<EditPlan> {
  const out = await generateStructured({
    spec: editorSpec, quality, label: "script.edit", schema: EditPlanSchema, maxOutputTokens: 12000,
    prompt: [
      `FORMAT ${opts.format.name} beats: ${opts.format.beats.map((b) => `${b.id} (${b.label})`).join(", ")}`,
      `AUDIENCE: ${opts.kit.audience}. SKIN: ${opts.kit.skin.name}.`,
      `TARGET CUT-INS: about ${opts.cutIns}.`,
      opts.notes ? `CREATOR NOTES: ${opts.notes.slice(0, 1500)}` : "",
      `SEGMENTS (speech only; silences/fillers already removed):\n${segmentPrompt(t)}`,
      `Return {title, hook, cta, hashtags, description, sources, keep, beats, cutIns, overlays, musicMood}.`,
    ].filter(Boolean).join("\n\n"),
  });
  const speechIds = new Set(t.segments.filter((s) => s.kind === "speech").map((s) => s.id));
  out.keep = out.keep.filter((id) => speechIds.has(id));
  if (!out.keep.length) out.keep = [...speechIds];
  const kept = new Set(out.keep);
  out.cutIns = out.cutIns.filter((c) => kept.has(c.segmentId) && c.segmentId !== out.keep[0]).slice(0, Math.max(1, Math.ceil(opts.cutIns * 1.25)));
  out.overlays = out.overlays.filter((o) => kept.has(o.segmentId));
  return out;
}
