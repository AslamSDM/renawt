import type { FormatTemplate, IdentityKit, Script, VoiceTrack } from "@remawt/shared";
import { z } from "zod";
import { BLOCK_DOCS, BLOCK_NAMES, BLOCK_SAMPLES, BLOCK_SCHEMAS, OVERLAY_DOCS, OVERLAY_NAMES, OVERLAY_SAMPLES, OVERLAY_SCHEMAS } from "../blocks/schema";
import { allocateScenes } from "../compose";
import { SAFE } from "../skin/index";

/** Compact JSON Schema for a block's data (drops noise keys to keep the cached prompt small). */
function schemaOf(s: z.ZodType): string {
  let js: unknown;
  try { js = z.toJSONSchema(s, { unrepresentable: "any", io: "input" }); } catch { js = {}; }
  return JSON.stringify(js, (k, v) => (k === "$schema" || k === "additionalProperties" ? undefined : v));
}

let catalogueCache: string | null = null;
/** Block catalogue: purpose + data JSON schema + example, for every block. Static → cache-friendly. */
export function blockCatalogue(): string {
  if (catalogueCache) return catalogueCache;
  const blocks = BLOCK_NAMES.map((b) => {
    const ex = BLOCK_SAMPLES[b];
    return `### ${b}\n${BLOCK_DOCS[b]}\ndata schema: ${schemaOf(BLOCK_SCHEMAS[b])}\nexample: ${JSON.stringify({ block: b, headline: ex.headline, body: ex.body, data: ex.data, assetIds: ex.assetIds })}`;
  });
  const overlays = OVERLAY_NAMES.map((b) => `### ${b} (overlay)\n${OVERLAY_DOCS[b]}\ndata schema: ${schemaOf(OVERLAY_SCHEMAS[b])}\nexample: ${JSON.stringify({ block: b, data: OVERLAY_SAMPLES[b] })}`);
  catalogueCache = [...blocks, ...overlays].join("\n\n");
  return catalogueCache;
}

/**
 * Cacheable system prompt for the engine's scene-plan composer. The model only fills a
 * ScenePlan (block choice + text + data); hf-kit renders contract-valid HyperFrames HTML.
 * Everything here depends only on the kit, format and canvas, so it caches per channel+format.
 */
export function buildSystemPrompt(opts: { kit: IdentityKit; format: FormatTemplate; width: number; height: number; durationMs: number }): string {
  const { kit, format, width, height } = opts;
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

OUTPUT — a single JSON object, no prose, no code fences:
{"scenes":[{"id":"hook","beatId":"hook","startMs":0,"durationMs":3200,"block":"kinetic-headline","headline":"…","body":"…","data":{…},"assetIds":[],"transitionIn":"push"}],"totalMs":${opts.durationMs},"musicMood":"tense|uplifting|calm|playful|epic|…","sfxCues":[{"atMs":0,"cue":"whoosh|pop|impact|click|riser"}]}

RULES
1. One idea per scene. A beat may span several scenes (e.g. one split-stat round or one numbered tip per scene). Scenes are back to back: startMs of scene n+1 = startMs + durationMs of scene n; durations sum to totalMs (~${sec}s). Scene boundaries fall between spoken words (use the timing given in the user message).
2. A scene lasts 1.5–7 s; the hook scene ≤ 2.5 s and its headline is on screen from frame 0.
3. Headlines ≤ 12 words (kinetic-headline) or ≤ 8 words (titles on other blocks). Body ≤ 1 short line. Plain text: no markdown, no emoji unless the persona uses them.
4. Numbers are exact and match the narration (spoken may be rounded, shown is exact). Charts use real series values; set data.source whenever data comes from somewhere.
5. Use only the block names below and data that validates against each block's schema. Omit optional fields you don't need. Never invent asset ids; use assetIds only from the asset list in the user message.
6. Text lives inside the safe area (${SAFE.top}px top / ${SAFE.bottom}px bottom are covered by app UI); the renderer handles placement — keep copy short so it fits.
7. Vary blocks: never the same block 3 times in a row unless the format demands it (rounds/tips).
8. transitionIn is optional (push | dissolve | scale | blur | cut); default comes from the skin.
9. Overlay blocks (overlay-*) are drawn over footage and do not take a slot in the sequence; their startMs/durationMs are absolute video time. Use them only when the plan contains video-segment scenes.
10. video-segment scenes play the user's footage range [data.inMs, data.outMs]; their duration is outMs − inMs.

BLOCK CATALOGUE
${blockCatalogue()}`;
}

function fmtMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Per-request prompt: script, narration timing, beat slots from `allocateScenes`. */
export function buildScenePlanPrompt(opts: { script: Script; voice: VoiceTrack; format: FormatTemplate; kit: IdentityKit; assets?: Array<{ id: string; kind: string; prompt?: string }> }): string {
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
Write the ScenePlan JSON for this video. totalMs = ${Math.round(total)}.`;
}
