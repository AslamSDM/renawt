import type { Asset, Composition, FormatTemplate, IdentityKit, ScenePlan, Script, VisualSkin, VoiceTrack } from "@remawt/shared";
import { z } from "zod";
import { Anim } from "./anim";
import { BLOCKS, BLOCK_SCHEMAS, NEEDS_HEADLINE, OVERLAY_SCHEMAS, isOverlayBlock, resolveBlockName, type BlockName } from "./blocks/index";
import { OVERLAYS_ID, overlaysComposition, type OverlayItem } from "./overlays/index";
import { CAPTIONS_ID, captionsComposition, chunkWords } from "./captions/index";
import { buildAudio, type MusicInput, type SfxInput } from "./audio/index";
import { OVERLAY_ID, overlayComposition } from "./watermark";
import { contentBox, fontLinks, motionPreset, sceneBaseCss, typeScale } from "./skin/index";
import { resolveTransition, transitionIn, transitionOut } from "./transitions/index";
import { esc, r3, safeId } from "./util";

export const GSAP_CDN = "https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js";
export const ROOT_ID = "main";
const RESERVED = new Set([ROOT_ID, CAPTIONS_ID, OVERLAY_ID, OVERLAYS_ID, "root", "remawt-media"]);
/** Marks hosts that sit above the back-to-back scene sequence (captions, overlays, chrome). */
export const LAYER_ATTR = "data-remawt-layer";
export const MEDIA_MANIFEST_ID = "remawt-media";

export interface ComposeInput {
  script: Script;
  voice: VoiceTrack;
  plan: ScenePlan;
  kit: IdentityKit;
  assets: Asset[];
  music?: MusicInput | null;
  sfx?: SfxInput[];
  width?: number;
  height?: number;
  fps?: number;
  watermark?: boolean;
  /** Video/voice-upload flows: user footage + the speech track that replaces voice.audioUrl as narration. */
  media?: { userVideo?: Asset; speechAudioUrl?: string };
}

export class ComposeError extends Error {
  constructor(public path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "ComposeError";
  }
}

function zodPath(base: string, issue: z.core.$ZodIssue): string {
  return [base, ...issue.path.map((p) => (typeof p === "number" ? `[${p}]` : `.${String(p)}`))].join("").replace(/\.\[/g, "[");
}

export interface ResolvedScene {
  sid: string;
  block: BlockName;
  startMs: number;
  durationMs: number;
  headline?: string;
  body?: string;
  data: Record<string, unknown>;
  assets: Asset[];
  transitionIn?: string;
}

/** Validate + normalise the plan: block names, data schemas, ids, back-to-back timing. */
export function resolveScenes(input: Pick<ComposeInput, "plan" | "assets" | "voice" | "music" | "fps" | "media">): ResolvedScene[] {
  return resolvePlan(input).scenes;
}

/** Sequence scenes + overlay items (overlay-* blocks keep their absolute startMs/durationMs). */
export function resolvePlan(input: Pick<ComposeInput, "plan" | "assets" | "voice" | "music" | "fps" | "media">): { scenes: ResolvedScene[]; overlays: OverlayItem[] } {
  const { plan } = input;
  const assets = [...(input.assets ?? []), ...(input.media?.userVideo && !(input.assets ?? []).some((a) => a.id === input.media!.userVideo!.id) ? [input.media.userVideo] : [])];
  if (!plan?.scenes?.length) throw new ComposeError("plan.scenes", "at least one scene is required");
  const fps = input.fps ?? 30;
  const seen = new Set<string>();
  const overlays: OverlayItem[] = [];
  const seq = plan.scenes.map((sc, i) => ({ sc, i })).filter(({ sc, i }) => {
    if (!isOverlayBlock(sc.block)) return true;
    const key = sc.block.trim().toLowerCase() as keyof typeof OVERLAY_SCHEMAS;
    const parsed = OVERLAY_SCHEMAS[key].safeParse(sc.data ?? {});
    if (!parsed.success) { const iss = parsed.error.issues[0]; throw new ComposeError(zodPath(`plan.scenes[${i}].data`, iss), `${iss.message} (block "${key}")`); }
    const atMs = (parsed.data as { atMs?: number }).atMs;
    overlays.push({ block: key, startMs: atMs ?? sc.startMs, durationMs: sc.durationMs > 0 ? sc.durationMs : 1600, data: parsed.data as Record<string, unknown> });
    return false;
  });
  if (!seq.length) throw new ComposeError("plan.scenes", "at least one non-overlay scene is required");
  const out: ResolvedScene[] = seq.map(({ sc, i }) => {
    const p = `plan.scenes[${i}]`;
    const block = resolveBlockName(sc.block);
    if (!block) throw new ComposeError(`${p}.block`, `unknown block "${sc.block}"; known: ${Object.keys(BLOCK_SCHEMAS).join(", ")}`);
    if (NEEDS_HEADLINE[block] && !sc.headline?.trim()) throw new ComposeError(`${p}.headline`, `block "${block}" needs a headline`);
    const parsed = BLOCK_SCHEMAS[block].safeParse(sc.data ?? undefined);
    if (!parsed.success) {
      const iss = parsed.error.issues[0];
      throw new ComposeError(zodPath(`${p}.data`, iss), `${iss.message} (block "${block}")`);
    }
    let sid = safeId(sc.id, `s${i + 1}`);
    if (RESERVED.has(sid) || seen.has(sid)) sid = `${sid}-${i + 1}`;
    seen.add(sid);
    const ids = [...(sc.assetIds ?? []), ...(typeof (parsed.data as { assetId?: string }).assetId === "string" ? [(parsed.data as { assetId: string }).assetId] : [])];
    const sceneAssets = ids.map((id, k) => {
      const a = assets.find((x) => x.id === id);
      if (!a) throw new ComposeError(`${p}.assetIds[${k}]`, `asset "${id}" not found in assets[]`);
      return a;
    });
    let durationMs = sc.durationMs;
    if (block === "video-segment") {
      const v = parsed.data as { inMs: number; outMs: number };
      if (!sceneAssets.length) throw new ComposeError(`${p}.assetIds`, "video-segment needs the user-video asset id");
      durationMs = v.outMs - v.inMs; // the footage range defines the slot
    }
    if (!Number.isFinite(durationMs) || durationMs <= 0) throw new ComposeError(`${p}.durationMs`, "must be > 0");
    return { sid, block, startMs: 0, durationMs, headline: sc.headline, body: sc.body, data: parsed.data as Record<string, unknown>, assets: sceneAssets, transitionIn: sc.transitionIn };
  });

  // Frame-align durations, lay scenes back to back, stretch the last scene to cover the narration.
  const frame = 1000 / fps;
  for (const s of out) s.durationMs = Math.max(Math.round(500 / frame), Math.round(s.durationMs / frame)) * frame;
  // video-segment slots floor to whole frames so the media range is never overrun.
  for (const s of out) if (s.block === "video-segment") s.durationMs = Math.floor(s.durationMs / frame + 1e-6) * frame;
  const hasFootage = out.some((s) => s.block === "video-segment");
  const voiceEnd = (input.voice?.durationMs ?? 0) + 250;
  const sum = out.reduce((a, s) => a + s.durationMs, 0);
  const last = out[out.length - 1];
  if (voiceEnd > sum && !(hasFootage && last.block === "video-segment")) last.durationMs += Math.ceil((voiceEnd - sum) / frame) * frame;
  if (input.music?.bpm && !hasFootage) snapToBeats(out, input.music.bpm, frame);
  let t = 0;
  for (const s of out) { s.startMs = t; t += s.durationMs; }
  const totalMs = t;
  for (const o of overlays) {
    o.startMs = Math.max(0, Math.min(o.startMs, totalMs - 300));
    o.durationMs = Math.max(300, Math.min(o.durationMs, totalMs - o.startMs));
  }
  return { scenes: out, overlays };
}

/** Nudge scene boundaries onto the nearest beat when one is within 120 ms (keeps total constant). */
export function snapToBeats(scenes: Array<{ durationMs: number }>, bpm: number, frameMs = 1000 / 30, toleranceMs = 120): void {
  const beat = 60000 / bpm;
  let t = 0;
  for (let i = 0; i < scenes.length - 1; i++) {
    const end = t + scenes[i].durationMs;
    const snapped = Math.round(Math.round(end / beat) * beat / frameMs) * frameMs;
    const delta = snapped - end;
    if (Math.abs(delta) <= toleranceMs && scenes[i].durationMs + delta >= 500 && scenes[i + 1].durationMs - delta >= 500) {
      scenes[i].durationMs += delta;
      scenes[i + 1].durationMs -= delta;
    }
    t += scenes[i].durationMs;
  }
}

/**
 * Beat grammar → scene slots. Each beat gets `share × totalMs`, with boundaries moved to the
 * nearest gap between words (±1.5 s) so a scene never cuts mid-word. Durations sum to totalMs.
 */
export function allocateScenes(format: FormatTemplate, totalMs: number, words: VoiceTrack["words"] = []): Array<{ beatId: string; block: string; startMs: number; durationMs: number }> {
  const beats = format.beats;
  const shareSum = beats.reduce((a, b) => a + b.share, 0) || 1;
  const gaps = words.slice(0, -1).map((w, i) => ({ at: (w.e + words[i + 1].s) / 2, size: words[i + 1].s - w.e, punct: /[.!?,;:]$/.test(w.w) }));
  const bounds: number[] = [0];
  let acc = 0;
  for (let i = 0; i < beats.length - 1; i++) {
    acc += (beats[i].share / shareSum) * totalMs;
    let best = acc, bestScore = Infinity;
    for (const g of gaps) {
      const dist = Math.abs(g.at - acc);
      if (dist > 1500) continue;
      const score = dist - (g.punct ? 400 : 0) - Math.min(g.size, 400);
      if (score < bestScore) { bestScore = score; best = g.at; }
    }
    const minStart = bounds[bounds.length - 1] + 800;
    const maxEnd = totalMs - (beats.length - 1 - i) * 800;
    bounds.push(Math.round(Math.min(maxEnd, Math.max(minStart, best))));
  }
  bounds.push(totalMs);
  return beats.map((b, i) => ({ beatId: b.id, block: b.block.split("|")[0], startMs: bounds[i], durationMs: bounds[i + 1] - bounds[i] }));
}

function sceneFile(opts: { s: ResolvedScene; index: number; count: number; skin: VisualSkin; kit: IdentityKit; width: number; height: number; fps: number; nextTransition?: string; nextBlock?: BlockName; videoHasAudio?: boolean }): string {
  const { s, skin, width, height, fps } = opts;
  const motion = motionPreset(skin);
  const isFirst = opts.index === 0, isLast = opts.index === opts.count - 1;
  const anim = new Anim(motion, { instant: isFirst });
  const durationS = s.durationMs / 1000;
  const out = BLOCKS[s.block]({
    sid: s.sid, index: opts.index, isFirst, isLast, headline: s.headline, body: s.body, data: s.data, durationS,
    width, height, skin, kit: opts.kit, motion, type: typeScale(width), box: contentBox(width, height), assets: s.assets, anim, fps, videoHasAudio: opts.videoHasAudio,
  });
  const tAnim = new Anim(motion);
  // Footage cuts hard by default (an editor's cut); graphics scenes use the skin transition.
  const inKind = resolveTransition(s.transitionIn ?? (s.block === "video-segment" ? "cut" : undefined), motion);
  const outKind = resolveTransition(opts.nextTransition ?? (s.block === "video-segment" || opts.nextBlock === "video-segment" ? "cut" : undefined), motion);
  if (!isFirst) transitionIn(tAnim, s.sid, inKind, motion);
  if (!isLast) transitionOut(tAnim, s.sid, outKind, motion, durationS, fps);
  return `<template>
  <style>
    ${sceneBaseCss(s.sid, skin, width, height).trim()}
    ${out.css.trim()}
  </style>
  <div id="root" data-composition-id="${s.sid}" data-width="${width}" data-height="${height}">
    <div id="${s.sid}-bg"></div>
    <div id="${s.sid}-stage">
      ${out.html.trim()}
    </div>
  </div>
  <script>
    (function () {
      window.__timelines = window.__timelines || {};
      var tl = gsap.timeline({ paused: true });
      ${out.timeline}
      ${tAnim.out()}
      tl.set({}, {}, ${r3(durationS)});
      window.__timelines["${s.sid}"] = tl;
    })();
  </script>
</template>
`;
}

/**
 * Deterministic, template-driven composition: ScenePlan → HyperFrames project (index.html +
 * one sub-composition per scene + captions + overlay). No LLM; every block emits contract-valid
 * HTML/CSS/GSAP from the skin tokens and the scene data.
 */
export function composeVideo(input: ComposeInput): Composition {
  const width = input.width ?? 1080, height = input.height ?? 1920, fps = input.fps ?? 30;
  const skin = input.kit.skin;
  const { scenes, overlays: overlayItems } = resolvePlan({ ...input, fps });
  const speechUrl = input.media?.speechAudioUrl;
  // Footage keeps its own sound only when no separate speech/narration track exists.
  const videoHasAudio = !speechUrl && !input.voice?.audioUrl;
  const totalMs = scenes.reduce((a, s) => a + s.durationMs, 0);
  const totalS = r3(totalMs / 1000);

  const sceneFiles = scenes.map((s, i) => ({
    id: s.sid,
    fileName: `${s.sid}.html`,
    html: sceneFile({ s, index: i, count: scenes.length, skin, kit: input.kit, width, height, fps, nextTransition: scenes[i + 1]?.transitionIn, nextBlock: scenes[i + 1]?.block, videoHasAudio }),
  }));

  const chunks = chunkWords(input.voice?.words ?? []);
  if (chunks.length) sceneFiles.push({ id: CAPTIONS_ID, fileName: `${CAPTIONS_ID}.html`, html: captionsComposition({ chunks, skin, width, height, totalMs }) });
  const overlaysHtml = overlaysComposition({ items: overlayItems, skin, width, height, totalMs });
  if (overlaysHtml) sceneFiles.push({ id: OVERLAYS_ID, fileName: `${OVERLAYS_ID}.html`, html: overlaysHtml });
  const overlay = overlayComposition({ skin, watermark: !!input.watermark, width, height, totalMs });
  if (overlay) sceneFiles.push({ id: OVERLAY_ID, fileName: `${OVERLAY_ID}.html`, html: overlay });

  const voice = speechUrl ? { ...input.voice, audioUrl: speechUrl } : input.voice;
  const audio = buildAudio({ voice, music: input.music, sfx: input.sfx, totalMs });
  const host = (id: string, startMs: number, durMs: number, track: number, kind: "graphics" | "captions", z: number, layer?: string) =>
    `<div id="${id}" data-composition-id="${id}" data-composition-src="compositions/${id}.html" data-start="${r3(startMs / 1000)}" data-duration="${r3(durMs / 1000)}" data-track-index="${track}" data-track-kind="${kind}" data-width="${width}" data-height="${height}"${layer ? ` ${LAYER_ATTR}="${layer}"` : ""} style="z-index:${z}"></div>`;

  const hosts = scenes.map((s) => host(s.sid, s.startMs, s.durationMs, 1, "graphics", 1));
  if (overlaysHtml) hosts.push(host(OVERLAYS_ID, 0, totalMs, 2, "graphics", 4, "overlays"));
  if (chunks.length) hosts.push(host(CAPTIONS_ID, 0, totalMs, 3, "captions", 5, "captions"));
  if (overlay) hosts.push(host(OVERLAY_ID, 0, totalMs, 4, "graphics", 6, "chrome"));

  // Media manifest: every footage range used, so lint (and the renderer) can verify sources.
  const media = scenes.filter((s) => s.block === "video-segment").map((s) => {
    const d = s.data as { inMs: number; outMs: number };
    return { scene: s.sid, assetId: s.assets[0].id, url: s.assets[0].url, inMs: d.inMs, outMs: d.outMs, slotMs: s.durationMs };
  });
  const manifest = media.length ? `<script type="application/json" id="${MEDIA_MANIFEST_ID}">${JSON.stringify({ videos: media, speechAudioUrl: speechUrl ?? null }).replace(/</g, "\\u003c")}</script>` : "";

  const title = esc(input.script?.title ?? "remawt video");
  const indexHtml = `<!doctype html>
<html lang="${esc(input.kit.persona?.language ?? "en")}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=${width}, height=${height}">
    <title>${title}</title>
    ${fontLinks(skin)}
    <script src="${GSAP_CDN}"></script>
    <style>
      html, body { margin: 0; padding: 0; width: ${width}px; height: ${height}px; overflow: hidden; background: ${skin.palette.bg}; }
      #root { position: relative; width: ${width}px; height: ${height}px; overflow: hidden; }
      #main-bg { position: absolute; inset: 0; background: ${skin.palette.bg}; z-index: 0; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="${ROOT_ID}" data-start="0" data-duration="${totalS}" data-width="${width}" data-height="${height}" data-fps="${fps}">
      <div id="main-bg"></div>
      ${hosts.join("\n      ")}
      ${audio.html}
    </div>
    ${manifest}
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["${ROOT_ID}"] = gsap.timeline({ paused: true });
    </script>
  </body>
</html>
`;

  return { indexHtml, sceneFiles, registryBlocks: [], width, height, fps, durationMs: totalMs };
}

/** Audio URLs for `submitRender` (narration first, then music), as the Lambda muxer expects. */
export function audioUrlsFor(input: Pick<ComposeInput, "voice" | "music" | "media">): string[] {
  return [input.media?.speechAudioUrl ?? input.voice?.audioUrl, input.music?.url].filter((u): u is string => !!u);
}

/** Footage URLs a composition plays (from its media manifest). */
export function videoUrlsOf(comp: Composition): string[] {
  const m = comp.indexHtml.match(new RegExp(`<script type="application/json" id="${MEDIA_MANIFEST_ID}">([\\s\\S]*?)</script>`));
  if (!m) return [];
  try { return [...new Set((JSON.parse(m[1]) as { videos: Array<{ url: string }> }).videos.map((v) => v.url))]; } catch { return []; }
}
