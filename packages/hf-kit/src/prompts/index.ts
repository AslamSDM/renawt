import type { FormatTemplate, IdentityKit, Script, VoiceTrack } from "@remawt/shared";
import { BLOCK_DOCS, BLOCK_NAMES, BLOCK_SAMPLES, OVERLAY_DOCS, OVERLAY_NAMES, OVERLAY_SAMPLES, STRICT_BLOCK_SCHEMAS, STRICT_OVERLAY_SCHEMAS } from "../blocks/schema";
import { shapeOf } from "../blocks/coerce";
import { textBudgetNote } from "../textfit";
import { allocateScenes } from "../compose";
import { SAFE } from "../skin/index";

const catalogueCache = new Map<boolean, string>();
/**
 * Block catalogue: purpose + data shape (generated from the strict zod schema) + an example whose data is
 * guaranteed valid (a test asserts every example parses strictly with zero coercions). Static → cacheable.
 */
export function blockCatalogue(opts: { footage?: boolean } = {}): string {
  const footage = opts.footage ?? true;
  const hit = catalogueCache.get(footage);
  if (hit) return hit;
  const blocks = BLOCK_NAMES.filter((b) => footage || b !== "video-segment").map((b) => {
    const ex = BLOCK_SAMPLES[b];
    const budget = textBudgetNote(b);
    return `### ${b}\n${BLOCK_DOCS[b]}${budget ? `\n${budget}` : ""}\ndata shape: ${shapeOf(STRICT_BLOCK_SCHEMAS[b])}\nexample: ${JSON.stringify({ block: b, headline: ex.headline, body: ex.body, data: ex.data, assetIds: ex.assetIds })}`;
  });
  const overlays = (footage ? OVERLAY_NAMES : []).map((b) => `### ${b} (overlay)\n${OVERLAY_DOCS[b]}\ndata shape: ${shapeOf(STRICT_OVERLAY_SCHEMAS[b])}\nexample: ${JSON.stringify({ block: b, data: OVERLAY_SAMPLES[b] })}`);
  const out = [...blocks, ...overlays, THREE_USAGE].join("\n\n");
  catalogueCache.set(footage, out);
  return out;
}

/** The data-shape rule shared by the planner prompt and the repair prompt. */
export const DATA_SHAPE_RULE = `"data" must match the block's example shape exactly: the same keys and nesting; an object wherever the shape shows { … } (never a bare string in its place); arrays of objects stay arrays of objects; numbers are JSON numbers (4000, not "$4,000" — put "$"/"%" in prefix/suffix/unit); stay within the max lengths and item counts shown; omit optional keys you don't need; no extra keys.`;

const PLAN_OUTPUT = (durationMs: number) => `OUTPUT — a single JSON object, no prose, no code fences:
{"scenes":[{"id":"hook","beatId":"hook","startMs":0,"durationMs":3200,"block":"kinetic-headline","headline":"…","body":"…","data":{…},"assetIds":[],"transitionIn":"push"}],"totalMs":${durationMs},"musicMood":"tense|uplifting|calm|playful|epic|…","sfxCues":[{"atMs":0,"cue":"whoosh|pop|impact|click|riser"}]}`;

const DRAFT_OUTPUT = `OUTPUT — a single JSON object, no prose, no code fences. Timings are computed by the renderer from the narration, so scenes carry no startMs/durationMs:
{"scenes":[{"id":"s1","beatId":"hook","block":"kinetic-headline","headline":"…","body":"…","data":{…},"asset":{"kind":"none"},"transitionIn":"push","sfx":"whoosh"}],"musicMood":"curious"}`;

/**
 * Cacheable system prompt for the engine's scene-plan composer. The model only fills a
 * ScenePlan (block choice + text + data); hf-kit renders contract-valid HyperFrames HTML.
 * Everything here depends only on the kit, format and canvas, so it caches per channel+format.
 */
export function buildSystemPrompt(opts: {
  kit: IdentityKit; format: FormatTemplate; width: number; height: number; durationMs: number;
  /** "scene-plan" (default): full ScenePlan with timings. "draft": content only (engine planner; timings are aligned later). */
  output?: "scene-plan" | "draft";
  /** Extra rules appended after the built-in ones (e.g. the engine's asset/sfx policy). */
  extraRules?: string[];
}): string {
  const { kit, format, width, height } = opts;
  const draft = opts.output === "draft";
  const sec = Math.round(opts.durationMs / 1000);
  return `You are the visual director for a faceless short-form channel. You turn a narrated script into a ScenePlan: an ordered list of scenes, each rendered by one block from the catalogue below. You never write HTML, CSS or JS; the renderer (hf-kit) turns your plan into a ${width}×${height} HyperFrames video with the channel's skin, captions, music and transitions.

CHANNEL
- Audience: ${kit.audience}
- Promise: ${kit.promise}
- Skin: ${kit.skin.name} (motion: ${kit.skin.motion}, captions: ${kit.skin.captionStyle}, shapes: ${kit.skin.shapes})
- Persona tone: formal ${kit.persona.tone.formal}, energy ${kit.persona.tone.energy}, humor ${kit.persona.tone.humor}
${kit.forbiddenTopics.length ? `- Never show: ${kit.forbiddenTopics.join(", ")}\n` : ""}
FORMAT: ${format.name} — ${format.tagline}
Beats (share of runtime → suggested block):
${format.beats.map((b) => `- ${b.id} "${b.label}" ${Math.round(b.share * 100)}% → ${b.block} — ${b.note}`).join("\n")}
Visual hints: ${format.visualHints.join(", ")}
Script rules: ${format.scriptRules.join("; ")}

${draft ? DRAFT_OUTPUT : PLAN_OUTPUT(opts.durationMs)}

RULES
1. One idea per scene. A beat may span several scenes (e.g. one split-stat round or one numbered tip per scene). ${draft ? `Aim for a new scene every 2–5 s of narration (~${sec}s total).` : `Scenes are back to back: startMs of scene n+1 = startMs + durationMs of scene n; durations sum to totalMs (~${sec}s). Scene boundaries fall between spoken words (use the timing given in the user message).`}
2. A scene lasts 1.5–7 s; the hook scene ≤ 2.5 s and its headline is on screen from frame 0.
3. Headlines ≤ 12 words (kinetic-headline) or ≤ 8 words (titles on other blocks). Body ≤ 1 short line. Plain text: no markdown, no emoji unless the persona uses them.
4. Numbers are exact and match the narration (spoken may be rounded, shown is exact). Charts use real series values; set data.source whenever data comes from somewhere.
5. Use only the block names below (exactly as written). ${DATA_SHAPE_RULE} ${draft ? "Request images/footage through \"asset\", never through data." : "Never invent asset ids; use assetIds only from the asset list in the user message."}
6. Text lives inside the safe area (${SAFE.top}px top / ${SAFE.bottom}px bottom are covered by app UI); the renderer handles placement — keep copy short so it fits.
7. Vary blocks: never the same block 3 times in a row unless the format demands it (rounds/tips).
8. transitionIn is optional (push | dissolve | scale | blur | cut); default comes from the skin.
${draft ? "9. This video has no user footage: never use video-segment or overlay-* blocks.\n10. Use the image block only together with an asset request; the renderer falls back to type when no image is found." : `9. Overlay blocks (overlay-*) are drawn over footage and do not take a slot in the sequence; their startMs/durationMs are absolute video time. Use them only when the plan contains video-segment scenes.
10. video-segment scenes play the user's footage range [data.inMs, data.outMs]; their duration is outMs − inMs.`}
${(opts.extraRules ?? []).map((r, i) => `${11 + i}. ${r}`).join("\n")}

BLOCK CATALOGUE
${blockCatalogue({ footage: !draft })}`;
}

function fmtMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Per-request prompt: script, narration timing, beat slots from `allocateScenes`. */
export function buildScenePlanPrompt(opts: { script: Script; voice: VoiceTrack; format: FormatTemplate; kit: IdentityKit; assets?: Array<{ id: string; kind: string; prompt?: string }>; output?: "scene-plan" | "draft" }): string {
  const { script, voice, format } = opts;
  const total = Math.max(voice.durationMs, script.estimatedSec * 1000);
  const slots = allocateScenes(format, total, voice.words);
  // Map each script line to its spoken window by walking the word timings.
  let wi = 0;
  const lines = script.lines.map((l) => {
    const n = l.text.split(/\s+/).filter(Boolean).length;
    const ws = voice.words.slice(wi, wi + n);
    wi += n;
    const span = ws.length ? `${fmtMs(ws[0].s)}–${fmtMs(ws[ws.length - 1].e)}` : "?";
    return `- [${l.beatId}] (${span}) "${l.text}"${l.onScreen ? ` | on screen: ${l.onScreen}` : ""}${l.visualNote ? ` | visual: ${l.visualNote}` : ""}`;
  });
  const gaps = voice.words.slice(0, -1).map((w, i) => ({ at: Math.round((w.e + voice.words[i + 1].s) / 2), size: voice.words[i + 1].s - w.e, after: w.w })).filter((g) => g.size >= 120 || /[.!?,;:]$/.test(g.after));
  return `TITLE: ${script.title}
HOOK: ${script.hook}
CTA: ${script.cta}
${script.sources.length ? `SOURCES:\n${script.sources.map((s) => `- ${s.title} — ${s.url}`).join("\n")}\n` : ""}
NARRATION (${fmtMs(voice.durationMs)} total):
${lines.join("\n")}

SUGGESTED BEAT SLOTS (ms, already snapped to word gaps):
${slots.map((s) => `- ${s.beatId}: start ${s.startMs}, duration ${s.durationMs}, block ${s.block}`).join("\n")}

NATURAL CUT POINTS (ms, pauses/punctuation): ${gaps.map((g) => g.at).join(", ") || "none"}
${opts.assets?.length ? `\nASSETS (use ids in assetIds):\n${opts.assets.map((a) => `- ${a.id} (${a.kind})${a.prompt ? `: ${a.prompt}` : ""}`).join("\n")}\n` : ""}
${opts.output === "draft" ? "Write the scene list JSON for this video (no timings; use the slots only to pace scenes per beat). Every scene's data must match its block's example shape exactly." : `Write the ScenePlan JSON for this video. totalMs = ${Math.round(total)}.`}`;
}

/**
 * When the 3D blocks earn their slot (appended to the catalogue). They are the most striking blocks in the kit,
 * so the planner needs both a nudge to use them where depth or place matters and a cap so they stay special.
 */
export const THREE_USAGE = `### 3D blocks (chart-3d, globe-3d, stat-3d, scene-3d) — when to use
Pick a 3D block when depth, place or physical motion IS the point of the beat: a ranking/comparison reveal (chart-3d), a location or route (globe-3d), the single hero number or word (stat-3d), a mechanism with moving parts (scene-3d). Use at most 2 per video, never back to back, each 3–8 s long, and never for the hook (the hook must read at frame 0). Keep the flat block when the data is a time series (chart), several countries (map) or a process of labelled steps (diagram).`;
