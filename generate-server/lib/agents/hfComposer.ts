import { chatWithOllamaCloud } from "./model";
import type { PickedTrack } from "../audio/musicPicker";
import type { SfxPlan } from "../audio/sfxGenerator";
import type { HfAudioPlan } from "../audio/hfMediaEngine";
import type { CrawlContext } from "./urlToJitter";

export interface NarrationResult {
  url: string;
  volume: number;
  startMs?: number;
  estimatedDurationSec?: number;
  durationMs?: number;
}

export interface CaptionChunk {
  text: string;
  startMs: number;
  endMs: number;
}

export function buildCaptionsFromNarration(
  text: string,
  totalDurationMs: number,
  opts: { startMs?: number; maxCharsPerChunk?: number } = {},
): CaptionChunk[] {
  if (!text?.trim() || !Number.isFinite(totalDurationMs) || totalDurationMs <= 0) return [];
  const startMs = opts.startMs ?? 0;
  const maxChars = opts.maxCharsPerChunk ?? 64;
  const sentenceSplit = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/).filter(Boolean);
  const phrases: string[] = [];
  for (const s of sentenceSplit) {
    if (s.length <= maxChars) { phrases.push(s); continue; }
    const sub = s.split(/(?<=[,;:])\s+|\s+(?=and |but |or |so )/i).filter(Boolean);
    let buffer = "";
    for (const piece of sub) {
      if ((buffer + " " + piece).trim().length <= maxChars) {
        buffer = (buffer + " " + piece).trim();
      } else { if (buffer) phrases.push(buffer); buffer = piece; }
    }
    if (buffer) phrases.push(buffer);
  }
  if (!phrases.length) return [];
  const totalChars = phrases.reduce((s, p) => s + p.length, 0);
  const chunks: CaptionChunk[] = [];
  let cursor = startMs;
  for (const p of phrases) {
    const share = (p.length / totalChars) * totalDurationMs;
    const end = cursor + share;
    chunks.push({ text: p, startMs: Math.round(cursor), endMs: Math.round(end) });
    cursor = end;
  }
  return chunks;
}

export interface HfCompositionResult {
  /** Full standalone orchestrator HTML */
  indexHtml: string;
  /** One sub-composition file per scene */
  sceneFiles: Array<{ id: string; fileName: string; html: string }>;
  /** Plain-text storyboard for progress / debugging */
  storyboard: Array<{ start: number; duration: number; description: string }>;
  /** CSS transition names used between scenes */
  transitions: string[];
  /** Registry block/component names the composition expects */
  registryBlocks: string[];
}

function escapeJsonForHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHfSystemPrompt(
  durationMs: number,
  width: number,
  height: number,
  sceneCount: number,
  registryBlocks: string[],
): string {
  const durationSec = (durationMs / 1000).toFixed(1);
  const sceneDuration = (durationMs / sceneCount / 1000).toFixed(1);

  return `You are a professional motion graphics designer and HyperFrames composition author. Generate a MODULAR HyperFrames project: one orchestrator index.html and one sub-composition HTML file per scene.

HYPERFRAMES CONTRACT — DO NOT VIOLATE:
- Standalone root in index.html: <div id="root" data-composition-id="main" data-width="${width}" data-height="${height}" data-duration="${durationSec}">
- Each scene slot in index.html is a direct child div with:
    data-composition-id="<scene-id>"
    data-composition-src="compositions/<scene-file>.html"
    data-start="<seconds>"
    data-duration="<seconds>"
    data-track-index="1"
    data-width="${width}"
    data-height="${height}"
- Scene sub-composition files must be wrapped in <template>. Inside <template> put <style>, the root <div id="root" data-composition-id="<scene-id>" data-width="${width}" data-height="${height}">, and <script>.
- Each sub-composition registers ONE paused GSAP timeline synchronously inside its <script>: window.__timelines["<scene-id>"] = gsap.timeline({ paused: true })
- The host index.html MUST also register a paused GSAP timeline for the root at window.__timelines["main"] = gsap.timeline({ paused: true }). Add each scene timeline to the main timeline at the scene's data-start (do NOT duplicate tween the host element itself). Build this synchronously at page load, never inside DOMContentLoaded, async, or fetch.
- The host index.html must NOT contain a custom loader/fetch orchestrator script. The HyperFrames renderer loads sub-compositions automatically from data-composition-src.
- Use GSAP from CDN: https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js
- CRITICAL RULE: NEVER use fromTo() with opacity. Elements MUST be visible from time 0 (opacity:1 in CSS or via .set({opacity:1})). Use .to() for entrance animations instead of fromTo(). If you must use fromTo(), animate only x, y, scale (not opacity), and set fromTo start time > 0 (e.g. 0.2). The .set({opacity:1}) MUST execute before and not conflict with any fromTo.
- Animate only: opacity, x, y, scale, scaleX, scaleY, rotation, color, backgroundColor, clipPath, letterSpacing
- NO display/visibility animation
- NO <br> in body text — use <div> or <span> with display:block
- All scene CSS must be inline inside the sub-composition <template>; index.html may have a small <style> for slot positioning
- Every sub-composition element id must be prefixed with the scene id to avoid collisions
- For full-screen scene fills, put the background on an absolute child inside the scene root, not on the root itself. The scene root div must have position:absolute, inset:0, width:1920px, height:1080px and NO background directly on it (the producer can drop root backgrounds, producing black frames).
- Audio/video elements, if any, must be direct children of the host root in index.html (never inside sub-composition templates)

OUTPUT STRUCTURE:
Return a single JSON object with this exact shape (no markdown, no code fences):
{
  "indexHtml": "<!doctype html>...",
  "sceneFiles": [
    { "id": "intro", "fileName": "intro.html", "html": "<template>..." },
    { "id": "features", "fileName": "features.html", "html": "<template>..." },
    { "id": "outro", "fileName": "outro.html", "html": "<template>..." }
  ],
  "storyboard": [
    { "start": 0, "duration": 4.0, "description": "..." }
  ],
  "transitions": ["push-slide", "blur-crossfade", "zoom-through"],
  "registryBlocks": ["logo-outro", "grain-overlay"]
}
IMPORTANT: The "transitions" array is REQUIRED and MUST contain 2-4 transition names from the list below. The "storyboard" array is REQUIRED and must have one entry per scene with start and duration in seconds. If you omit these fields the output will be rejected.

SCENE ARCHITECTURE:
- Create exactly ${sceneCount} scenes, each ~${sceneDuration}s long, back-to-back on track-index 1.
- MANDATORY: EVERY scene MUST have a transition animation between scenes. Pick from the transitions list below. The transition IS the exit of the outgoing scene and entrance of the incoming scene. Do NOT add CSS @keyframes transition classes or custom fetch/load orchestration in index.html.
- MANDATORY: EVERY text element in every scene MUST have an entrance animation (e.g. slide up, fade+move, scale in, typewriter effect) using GSAP .to() or .fromTo().
- MANDATORY: EVERY decorative element (logos, icons, images, CTAs) MUST have an entrance animation. Nothing should appear statically.
- Each sub-composition's script timeline MUST start with tl.set("all-key-elements", {opacity:1}) at position 0 so content is never invisible. After the .set(), use .to() or .fromTo() with only x/y/scale (never opacity) and start times > 0.
- Use GSAP-driven transitions between scenes inside the main timeline. Do NOT add CSS @keyframes transition classes or custom fetch/load orchestration in index.html.
- Each scene slot in index.html should have NO inline opacity styles and no global CSS rule that sets opacity:0 on data-composition-id selectors. Scenes are visible by default; the main timeline handles entrances/exits.

TRANSITIONS — REQUIRED: You MUST pick 2-4 different transitions from the list below and include them in the "transitions" array of your JSON output (e.g. "transitions": ["push-slide","blur-crossfade","zoom-through"]). Implement each transition as a GSAP exit animation (outgoing scene) + entrance animation (incoming scene) in the main timeline.
Options: push-slide, vertical-push, blur-crossfade, focus-pull, zoom-through, zoom-out, grid-dissolve, staggered-blocks, circle-iris, light-leak, glitch, chromatic-aberration, gravity-drop, overexposure

REGISTRY BLOCKS available (install via hyperframes add):
- data-chart, us-map, world-map, flowchart, logo-outro, grain-overlay, shimmer-sweep, grid-pixelate-wipe, motion-blur, morph-text, instagram-follow, tiktok-follow, yt-lower-third, news-ticker, spotify-card, app-showcase, ui-3d-reveal, vfx-iphone-device, code-snippet-dark-modern

CAPTIONS / NARRATION:
- If narration is provided, sync scene pacing to the narration and include caption text elements in the relevant scene sub-compositions.
- Caption text should be in a dedicated layer with data-track-index="2" in index.html OR inside the relevant sub-composition.

SFX:
- If a sound-effects plan is provided, add visual accent moments (pops, reveals, impacts) that align with the SFX timestamps.

MUSIC:
- If a music track is provided with BPM, try to align scene transitions to beat boundaries for a polished feel.

TIPS:
- Keep each sub-composition focused; put all scene-specific markup, styles and tweens inside that file.
- Use web-safe fonts or font stacks; no external @import inside sub-compositions.
- Use .to() for entrances (not fromTo). Animate from a starting x/y offset to 0, or scale to reveal.
- Provide the JSON only. No explanation.`;
}

function buildHfUserPrompt(
  brandReport: Record<string, unknown>,
  url: string,
  durationMs: number,
  width: number,
  height: number,
  extraNotes?: string,
  imageUrls?: string[],
  music?: PickedTrack | null,
  narration?: NarrationResult | null,
  audioPlan?: HfAudioPlan | null,
  captions?: {
    enabled?: boolean;
    style?: "bottom" | "centered" | "minimal";
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    background?: string;
  } | null,
  captionChunks?: Array<{ text: string; startMs: number; endMs: number }> | null,
  sfxPlan?: SfxPlan | null,
  registryBlocks?: string[],
  sceneCount = 4,
  crawlData?: CrawlContext | null,
): string {
  const brandInfo = JSON.stringify(brandReport, null, 2);
  const durationSec = (durationMs / 1000).toFixed(1);
  const imagesBlock = imageUrls?.length
    ? `\nAvailable images (use absolute URLs via <img crossorigin="anonymous"> in sub-compositions):\n${imageUrls.map((u, i) => `  [${i + 1}] ${u}`).join("\n")}\n`
    : "";

  const musicBlock = music
    ? `\nBackground music: "${music.title}" at ${music.bpm} BPM (beat every ${Math.round(music.beatMs)}ms). Align scene transitions to beat boundaries.\n`
    : "";

  const narrationBlock = narration
    ? `\nNarration audio (~${narration.estimatedDurationSec ?? "?"}s). Pace scenes to fit the voiceover.\n`
    : "";

  const captionsBlock = captionChunks?.length
    ? `\nCaption chunks (sync on-screen captions to these timestamps):\n${JSON.stringify(captionChunks, null, 2)}\n`
    : "";

  const sfxBlock = sfxPlan?.requests.length
    ? `\nSound effects plan (align visual accents to these cues):\n${sfxPlan.description}\n`
    : "";

  const audioBlock = audioPlan?.voices.length
    ? `\nGenerated voice lines:\n${audioPlan.voices.map((v) => `  ${v.id}: "${v.text}" (${v.durationS.toFixed(1)}s)`).join("\n")}\n`
    : "";

  const registryBlock = registryBlocks?.length
    ? `\nPreferred registry blocks to use:\n${registryBlocks.join(", ")}\n`
    : "";

  const crawlBlock = crawlData?.pages?.length
    ? `\nCrawled website content (${crawlData.pages.length} pages):\n${crawlData.pages.map((p, i) =>
        `[Page ${i + 1}] ${p.title} (${p.url})\nHeadings: ${p.headings.slice(0, 10).join(" | ")}\nKey text: ${p.text.slice(0, 2000)}`
      ).join("\n\n")}\n${crawlData.logoUrl ? `\nLogo URL: ${crawlData.logoUrl}` : ""}${crawlData.brandImages.length ? `\nBrand images:\n${crawlData.brandImages.map((u, i) => `  [${i + 1}] ${u}`).join("\n")}` : ""}\n`
    : "";

  return `Brand analysis:\n${brandInfo}\n\nSource URL: ${url}\n\nDuration: ${durationMs}ms (${durationSec}s)\nResolution: ${width}x${height}\nScenes: ${sceneCount}\n${extraNotes ? `Notes: ${extraNotes}\n` : ""}${imagesBlock}${crawlBlock}${musicBlock}${narrationBlock}${audioBlock}${captionsBlock}${sfxBlock}${registryBlock}\n\nCreate the HyperFrames composition as the exact JSON structure described in the system prompt. Make it visually dynamic, use at least 3 different transitions, show the brand name prominently in the first scene, and end with a strong CTA scene.`;
}

export async function generateHfComposition(params: {
  brandReport: Record<string, unknown>;
  url: string;
  durationMs: number;
  width?: number;
  height?: number;
  extraNotes?: string;
  imageUrls?: string[];
  music?: PickedTrack | null;
  narration?: NarrationResult | null;
  captions?: {
    enabled?: boolean;
    style?: "bottom" | "centered" | "minimal";
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    background?: string;
  } | null;
  captionChunks?: Array<{ text: string; startMs: number; endMs: number }> | null;
  sfxPlan?: SfxPlan | null;
  audioPlan?: HfAudioPlan | null;
  sceneCount?: number;
  registryBlocks?: string[];
  crawlData?: CrawlContext | null;
}): Promise<HfCompositionResult> {
  const width = params.width ?? 1920;
  const height = params.height ?? 1080;
  const sceneCount = params.sceneCount ?? 4;

  const system = buildHfSystemPrompt(params.durationMs, width, height, sceneCount, params.registryBlocks || []);
  const user = buildHfUserPrompt(
    params.brandReport,
    params.url,
    params.durationMs,
    width,
    height,
    params.extraNotes,
    params.imageUrls,
    params.music,
    params.narration,
    params.audioPlan,
    params.captions,
    params.captionChunks,
    params.sfxPlan,
    params.registryBlocks,
    sceneCount,
    params.crawlData,
  );

  const response = await chatWithOllamaCloud(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    {
      temperature: 1.1,
      maxTokens: 16000,
      model: process.env.JITTER_COMPOSER_MODEL || "deepseek-v4-flash",
    },
  );

  let raw = response.content || "";
  raw = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();

  let parsed: Partial<HfCompositionResult>;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.warn("[hfComposer] Failed to parse JSON composition, falling back to single-file HTML", e);
    parsed = { indexHtml: raw, sceneFiles: [] };
  }

  const indexHtml = injectAudioIntoIndexHtml(parsed.indexHtml || raw, params.audioPlan, params.music, params.durationMs);
  const sceneFiles = parsed.sceneFiles || [];
  const storyboard = parsed.storyboard || [{ start: 0, duration: params.durationMs / 1000, description: "Full composition" }];
  const transitions = ["blur-crossfade"];
  const registryBlocks = parsed.registryBlocks || params.registryBlocks || [];

  // Inject transition overlays between scenes in the main timeline
  const indexHtmlWithTransitions = injectSceneTransitions(indexHtml, params.durationMs);

  return {
    indexHtml: indexHtmlWithTransitions,
    sceneFiles,
    storyboard,
    transitions,
    registryBlocks,
  };
}

function sanitizeInlineScript(script: string): string {
  // LLM-generated minified scripts sometimes omit semicolons before comments,
  // producing invalid JS like "transitiontl.to(..." or "durationconst ...".
  // Insert semicolons/newlines at known collision patterns so the script parses.
  return script
    .replace(/transitiontl\./g, "transition;\ntl.")
    .replace(/durationconst\b/g, "duration;\nconst")
    .replace(/overlap transitiontl\./g, "overlap transition;\ntl.")
    .replace(/\)\)\)\/\//g, "});\n//");
}

function injectSceneTransitions(html: string, durationMs: number): string {
  if (!html.includes("window.__timelines")) return html;

  const transitionDuration = 0.2;
  const durationS = durationMs / 1000;

  // Extract scene IDs and start times from existing HTML
  const scenePattern = /data-composition-id="([^"]+)"[^>]*data-start="([^"]+)"/g;
  const scenes: { id: string; start: number }[] = [];
  let m;
  while ((m = scenePattern.exec(html)) !== null) {
    const id = m[1];
    if (id === "main") continue;
    scenes.push({ id, start: parseFloat(m[2]) });
  }

  if (scenes.length < 2) return html;

  scenes.sort((a, b) => a.start - b.start);

  // Build main timeline script that adds scene timelines + transition overlays
  let script = `window.__timelines=window.__timelines||{};window.__timelines["main"]=gsap.timeline({paused:true});var main=window.__timelines["main"];var overlay=document.getElementById("transition-overlay");`;
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    script += `if(window.__timelines["${s.id}"])main.add(window.__timelines["${s.id}"],${s.start});`;
    if (i < scenes.length - 1) {
      const nextStart = scenes[i + 1].start;
      const fadeOutTime = Math.max(s.start, nextStart - transitionDuration);
      const fadeOutStart = Math.min(fadeOutTime, nextStart - 0.05);
      const fadeInEnd = nextStart + transitionDuration;
      script += `main.to(overlay,{opacity:1,duration:${transitionDuration},ease:"power2.inOut"},${fadeOutStart});`;
      script += `main.to(overlay,{opacity:0,duration:${transitionDuration},ease:"power2.inOut"},${nextStart});`;
    }
  }

  // Replace existing main timeline script
  const scriptRegex = /<script>window\.__timelines\s*=\s*\{\}[\s\S]*?<\/script>/;
  if (!scriptRegex.test(html)) return html;
  html = html.replace(scriptRegex, `<script>${script}</script>`);

  // Add transition overlay div before closing #root
  const overlayHtml = `<div id="transition-overlay" style="position:absolute;inset:0;width:1920px;height:1080px;background:#000;pointer-events:none;opacity:0;z-index:999"></div>`;
  const rootClose = html.lastIndexOf("</div>");
  if (rootClose > 0) {
    html = html.slice(0, rootClose) + "\n" + overlayHtml + "\n" + html.slice(rootClose);
  }

  return html;
}

function injectAudioIntoIndexHtml(
  indexHtml: string,
  audioPlan?: HfAudioPlan | null,
  music?: PickedTrack | null,
  durationMs?: number,
): string {
  if (!indexHtml.includes("</div>") || !indexHtml.includes("</body>")) return indexHtml;

  const durationS = (durationMs ?? 15000) / 1000;
  const audioTags: string[] = [];

  if (audioPlan?.bgm?.r2Url) {
    audioTags.push(
      `  <audio id="bgm" src="${escapeJsonForHtml(audioPlan.bgm.r2Url)}" data-start="0" data-duration="${durationS.toFixed(1)}" data-track-index="10" data-volume="0.5"></audio>`,
    );
  } else if (music?.url) {
    audioTags.push(
      `  <audio id="bgm" src="${escapeJsonForHtml(music.url)}" data-start="0" data-duration="${durationS.toFixed(1)}" data-track-index="10" data-volume="0.5"></audio>`,
    );
  }

  for (const v of audioPlan?.voices || []) {
    if (!v.r2Url) continue;
    audioTags.push(
      `  <audio id="voice-${v.id}" src="${escapeJsonForHtml(v.r2Url)}" data-start="0" data-duration="${(v.durationS).toFixed(1)}" data-track-index="11" data-volume="0.95"></audio>`,
    );
  }

  // Add data-start="0" to root if missing, and stable ids to scene slots.
  let html = indexHtml;
  html = html.replace(
    /<div\s+id="root"\s+data-composition-id="main"\s+data-width="([^"]+)"\s+data-height="([^"]+)"\s+data-duration="([^"]+)"/,
    `<div id="root" data-composition-id="main" data-start="0" data-width="$1" data-height="$2" data-duration="$3"`,
  );
  html = html.replace(
    /<div\s+class="scene-slot"\s+data-composition-id="intro"/,
    `<div id="el-intro" class="scene-slot" data-composition-id="intro"`,
  );
  html = html.replace(
    /<div\s+class="scene-slot"\s+data-composition-id="features"/,
    `<div id="el-features" class="scene-slot" data-composition-id="features"`,
  );
  html = html.replace(
    /<div\s+class="scene-slot"\s+data-composition-id="outro"/,
    `<div id="el-outro" class="scene-slot" data-composition-id="outro"`,
  );

  // Replace any custom DOMContentLoaded / fetch orchestrator with a synchronous
  // GSAP main timeline. The HyperFrames renderer loads sub-compositions
  // automatically from data-composition-src, so we only need to register the
  // root timeline and add each scene timeline at its data-start.
  html = html.replace(
    /<script>[\s\S]*?<\/script>/g,
    (match) => {
      const scriptBody = match.slice(8, -9);
      // If this looks like the host orchestrator (references slots, sceneFiles, fetch, async load),
      // swap it for a synchronous timeline composer.
      if (
        /sceneFiles|loadScenes|fetch\s*\(|async\s+function|DOMContentLoaded/.test(scriptBody)
      ) {
        return `<script>window.__timelines=window.__timelines||{};window.__timelines["main"]=gsap.timeline({paused:true});var scenes=document.querySelectorAll('[data-composition-id]');scenes.forEach(function(el){var id=el.getAttribute('data-composition-id');if(id==='main')return;var start=parseFloat(el.getAttribute('data-start'));var tl=window.__timelines[id];if(tl){window.__timelines["main"].add(tl,start);}});</script>`;
      }
      return `<script>${sanitizeInlineScript(scriptBody)}</script>`;
    },
  );

  // Ensure the global scene-slot rule never hides scenes by default. The
  // HyperFrames runtime toggles visibility via the composition timeline; an
  // opacity:0 on [data-composition-id] makes every scene black.
  html = html.replace(
    /\[data-composition-id\]\s*\{[^}]*opacity:\s*0[^}]*\}/g,
    (rule) => rule.replace(/opacity:\s*0\s*;?/g, "").replace(/;\s*\}/g, "}").replace(/\{\s*\}/g, "{}"),
  );

  // Insert audio tags just before the closing </div> of #root.
  if (audioTags.length > 0) {
    const rootClose = html.lastIndexOf("</div>");
    if (rootClose > 0) {
      html = html.slice(0, rootClose) + "\n" + audioTags.join("\n") + "\n" + html.slice(rootClose);
    }
  }
  return html;
}

export * from "./hfComposerLegacy";
