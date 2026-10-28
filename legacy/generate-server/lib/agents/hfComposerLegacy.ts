import { chatWithOllamaCloud } from "./model";
import type { PickedTrack } from "../audio/musicPicker";
import type { SfxPlan } from "../audio/sfxGenerator";

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

export interface LegacyHfCompositionResult {
  compositionHtml: string;
  storyboard: Array<{ start: number; duration: number; description: string }>;
}

const GSAP_TRANSITION_PATTERNS = `
=== GSAP TRANSITION PATTERNS ===

Use these GSAP patterns for dynamic scene transitions:

1. FADE TRANSITION:
   tl.fromTo("#elem", { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.out" }, startTime);
   tl.to("#elem", { opacity: 0, duration: 0.3, ease: "power2.in" }, endTime);

2. SLIDE TRANSITION (direction up/down/left/right):
   tl.fromTo("#elem", { y: 80, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, startTime);
   tl.to("#elem", { y: -60, opacity: 0, duration: 0.4, ease: "power2.in" }, endTime);

3. SCALE TRANSITION:
   tl.fromTo("#elem", { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.7)" }, startTime);
   tl.to("#elem", { scale: 0.9, opacity: 0, duration: 0.3, ease: "power2.in" }, endTime);

4. STAGGER TEXT (words animate in one by one):
   tl.from(".word", { opacity: 0, y: 30, rotationX: -10, duration: 0.4, stagger: 0.08, ease: "power2.out" }, startTime);

5. STAGGER CHILDREN (items animate in sequence):
   tl.from(".item", { opacity: 0, x: -40, duration: 0.35, stagger: 0.1, ease: "power2.out" }, startTime);

6. BOUNCE IN:
   tl.from("#elem", { scale: 0, opacity: 0, duration: 0.6, ease: "back.out(2)" }, startTime);
   tl.to("#elem", { scale: 1.05, duration: 0.15, ease: "power1.out" }, "+=0.6");
   tl.to("#elem", { scale: 1, duration: 0.1, ease: "none" });

7. CLIP REVEAL:
   tl.set("#elem", { clipPath: "inset(0 100% 0 0)" });
   tl.to("#elem", { clipPath: "inset(0 0% 0 0)", duration: 0.6, ease: "power4.inOut" }, startTime);

8. ROTATE IN:
   tl.fromTo("#elem", { rotation: -15, opacity: 0 }, { rotation: 0, opacity: 1, duration: 0.5, ease: "power2.out" }, startTime);

9. SCENE TRANSITION (wipe effect between scenes):
   tl.to("#old-scene", { opacity: 0, scale: 1.05, duration: 0.3 }, transitionStart);
   tl.fromTo("#new-scene", { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.4 }, "+=0.1");

10. PULSE/ATTENTION:
    tl.to("#elem", { scale: 1.08, duration: 0.2, ease: "sine.inOut" }, startTime);
    tl.to("#elem", { scale: 1, duration: 0.2, ease: "sine.inOut" });

11. MARQUEE/LOGO SCROLL:
    tl.to("#marquee", { x: "-50%", duration: totalDuration, ease: "none" }, 0);

12. FLASH TRANSITION (white flash between scenes):
    tl.set("#flash", { opacity: 1, backgroundColor: "#ffffff" });
    tl.to("#flash", { opacity: 0, duration: 0.15, ease: "none" }, transitionStart);

13. TEXT REVEAL (character by character using CSS letter-spacing):
    tl.fromTo("#text", { letterSpacing: "20px", opacity: 0 }, { letterSpacing: "0px", opacity: 1, duration: 0.5, ease: "power3.out" }, startTime);

14. PARALLAX (two layers moving at different speeds):
    tl.to("#bg-layer", { y: -20, duration: 5, ease: "none" }, 0);
    tl.to("#fg-layer", { y: -60, duration: 5, ease: "none" }, 0);

Use GSAP ease functions: "power1.out", "power2.out", "power3.out", "power4.out", "back.out(1.7)", "elastic.out(1, 0.3)", "bounce.out", "expo.out", "sine.inOut", "none" (for linear).
`;

function buildLegacyHfPrompt(
  brandReport: Record<string, unknown>,
  url: string,
  durationMs: number,
  width: number,
  height: number,
  extraNotes?: string,
  imageUrls?: string[],
  music?: PickedTrack | null,
  narration?: NarrationResult | null,
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
): { system: string; user: string } {
  const brandInfo = JSON.stringify(brandReport, null, 2);
  const durationSec = (durationMs / 1000).toFixed(1);
  const fps = 30;
  const totalFrames = Math.round(durationMs / 1000 * fps);

  const system = `You are a professional motion graphics designer and HyperFrames composition author. Generate a dynamic, visually rich HTML file that renders an animated video composition.

RULES:
- Root element: <div data-composition-id="hf-video" data-duration="${durationSec}" data-width="${width}" data-height="${height}">
- Each scene/shot is a <div class="clip" data-start="..." data-duration="..." data-track-index="N">
- Use ONE synchronous GSAP timeline: window.__timelines["hf-video"] = gsap.timeline({ paused: true })
- Include GSAP from CDN: <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
- INCLUDE GSAP before your timeline script
- Animate: opacity, x, y, scale, scaleX, scaleY, rotation, color, backgroundColor, clipPath, letterSpacing
- NO display/visibility animation
- NO <br> in body text — use <div> or <span> with display:block instead
- Use web-safe fonts (Arial, sans-serif, Georgia, serif, monospace, Impact, 'Trebuchet MS', 'Courier New')
- All styles must be inline
- The composition is ${durationSec}s long (${totalFrames} frames at ${fps}fps)
- Output ONLY the raw HTML. No markdown, no code fences, no explanation.
- IMPORTANT: Make the video INTERESTING. Use varied scene transitions, dynamic typography, and layered animations.
- Each scene should have a DIFFERENT animation style — don't repeat the same transition pattern.
- Use the brand's color palette from the brand analysis.
- Show the brand name prominently in the first scene.
- End with a strong CTA scene.`;

  const imagesBlock = imageUrls && imageUrls.length > 0
    ? `\nAvailable images (embed via <img src="..." style="...">):\n${imageUrls.map((u, i) => `  [${i + 1}] ${u}`).join("\n")}\n`
    : "";

  const musicBlock = music
    ? `\nBackground music: "${music.title}" at ${music.bpm} BPM (beat every ${Math.round(music.beatMs)}ms). Try to align scene transitions to beat boundaries for a polished feel.\n`
    : "";

  const narrationBlock = narration
    ? `\nNarration audio is available (~${narration.estimatedDurationSec ?? "?"}s). Pace scenes to accommodate the voiceover.\n`
    : "";

  const captionsBlock = captionChunks && captionChunks.length > 0
    ? `\nCaption chunks (sync visual text to these timestamps):\n${JSON.stringify(captionChunks, null, 2)}\n`
    : "";

  const sfxBlock = sfxPlan && sfxPlan.requests.length > 0
    ? `\nSound effects plan (these will be mixed into the final video):\n${sfxPlan.description}\n`
    : "";

  const user = `Brand analysis:\n${brandInfo}\n\nSource URL: ${url}\n\nDuration: ${durationMs}ms (${durationSec}s)\nResolution: ${width}x${height}\n${extraNotes ? `Notes: ${extraNotes}\n` : ""}${imagesBlock}${musicBlock}${narrationBlock}${captionsBlock}${sfxBlock}

${GSAP_TRANSITION_PATTERNS}

Create the HyperFrames composition HTML. Make it visually dynamic — use at least 3 different transition patterns across the scenes. Each scene should have a distinct visual treatment.`;

  return { system, user };
}

export async function generateLegacyHfComposition(params: {
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
}): Promise<LegacyHfCompositionResult> {
  const width = params.width ?? 1920;
  const height = params.height ?? 1080;

  const { system, user } = buildLegacyHfPrompt(
    params.brandReport,
    params.url,
    params.durationMs,
    width,
    height,
    params.extraNotes,
    params.imageUrls,
    params.music,
    params.narration,
    params.captions,
    params.captionChunks,
    params.sfxPlan,
  );

  const response = await chatWithOllamaCloud(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    {
      temperature: 1.2,
      maxTokens: 65536,
      model: process.env.JITTER_COMPOSER_MODEL || "deepseek-v4-flash",
    },
  );

  let html = response.content || "";
  html = html.replace(/^```(?:html)?\n?/i, "").replace(/\n?```$/i, "").trim();

  const durationSec = (params.durationMs / 1000).toFixed(1);
  if (!html.includes('data-duration="')) {
    html = html.replace(
      /(<div[^>]*data-composition-id="[^"]*")/,
      `$1 data-duration="${durationSec}"`,
    );
  }
  if (!html.includes('data-width="')) {
    html = html.replace(
      /(<div[^>]*data-composition-id="[^"]*")/,
      `$1 data-width="${params.width ?? 1920}" data-height="${params.height ?? 1080}"`,
    );
  }

  console.log(`[hfComposerLegacy] Generated HTML (${html.length} chars)`);

  const storyboard: Array<{ start: number; duration: number; description: string }> = [
    { start: 0, duration: params.durationMs / 1000, description: "Full composition" },
  ];

  return { compositionHtml: html, storyboard };
}
