/**
 * Pipeline step implementations. Each step reads what it needs from the Video row and persists its
 * output back to it, so workflow payloads stay tiny (Inngest step outputs are size-limited) and every
 * step is idempotent: a re-run with unchanged inputs returns the persisted result without paying again.
 *
 * Workflows (src/mastra/workflows/*) wrap these; scripts/smoke.ts calls them directly.
 */
import {
  IdentityKitSchema, ScriptSchema, VoiceTrackSchema, ScenePlanSchema, CompositionSchema, AssetSchema,
  FORMATS, getFormat, type IdentityKit, type Script, type VoiceTrack, type ScenePlan, type Composition, type Asset, type FormatTemplate,
  type VideoSource, type Transcript,
} from "@remawt/shared";
import { Prisma } from "@remawt/db";
import { writeFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "../lib/db.js";
import { has } from "../lib/env.js";
import { log, errMsg } from "../lib/logger.js";
import { hashOf } from "../lib/hash.js";
import { withCallContext } from "../lib/context.js";
import { addCost, appendProgress, loadVideo, setStatus, trackStep, type VideoWithChannel } from "../lib/video.js";
import { refundVideo } from "../lib/billing.js";
import { ttsFor } from "../lib/tts/index.js";
import { estimateWordTimings, type Word } from "../lib/captions.js";
import { alignScenes } from "../lib/planning/allocate.js";
import { pickTrack } from "../lib/audio/musicPicker.js";
import { resolveSfxCues } from "../lib/audio/sfx.js";
import { resolveAsset, type AssetRequest } from "../lib/assets/index.js";
import { hfkit, type LintReport } from "../lib/hfkit.js";
import { renderLocal, isLocalRender, submitRemote } from "../lib/render/index.js";
import { extractThumbnail, probeDurationMs } from "../lib/render/ffmpeg.js";
import { putObject } from "../lib/r2.js";
import { estimateRenderUsd } from "../lib/pricing.js";
import { originality } from "../lib/qc/originality.js";
import { policyLint, aiLabels } from "../lib/qc/policy.js";
import { writeScript } from "../mastra/agents/scriptwriter.js";
import { planScenes, PlannerOutputSchema, type PlannerOutput } from "../mastra/agents/planner.js";
import { refineComposition } from "../mastra/agents/composer.js";
import { critique } from "../mastra/agents/critic.js";
import { writeMetadata, fallbackMetadata } from "../mastra/agents/metadata.js";
import type { Quality } from "../mastra/models.js";
import { pickFormat, heuristicFormat, beatifyTranscript, planVideoEdit, type EditPlan } from "../mastra/agents/editor.js";
import { sourceOf, transcriptOf, saveTranscript } from "../lib/videoSource.js";
import { probe, chooseFit, normalizeVideo, extractSpeechAudio, toNarrationMp3, trimConcatAudio, type FitMode } from "../lib/media/ingest.js";
import { transcribe } from "../lib/stt/index.js";
import { editTimeline, remapWords, timelineDuration, cutInTarget, isFiller, type Segment, type TimelinePiece } from "../lib/edit/segments.js";
import { fetchBuffer } from "../lib/r2.js";

export interface PipelineCtx { videoId: string; quality: Quality; watermark: boolean }

const json = (v: unknown) => v as Prisma.InputJsonValue;

export function kitOf(v: VideoWithChannel): IdentityKit {
  return IdentityKitSchema.parse(v.kitSnapshot ?? v.channel.kit);
}
export function formatOf(v: VideoWithChannel): FormatTemplate {
  return getFormat(v.format) ?? FORMATS[0];
}

/** Context for cost attribution of every paid call inside a step. */
export function stepContext<T>(v: { id: string; channelId: string; channel: { userId: string } }, step: string, fn: () => Promise<T>): Promise<T> {
  return withCallContext({ videoId: v.id, channelId: v.channelId, userId: v.channel.userId, step }, fn);
}

// ───────────────────────── script ─────────────────────────

// ───────────────────────── ingest (video/audio uploads) ─────────────────────────

interface StoredMedia { userVideo?: { assetId: string; url: string; width: number; height: number; fit: FitMode; srcHash: string }; speechUrl?: string; durationMs?: number; srcHash?: string }
const mediaOf = (v: VideoWithChannel): StoredMedia => (((v.qc ?? {}) as { _media?: StoredMedia })._media ?? {});
async function saveMedia(videoId: string, media: StoredMedia) {
  const cur = await db().video.findUnique({ where: { id: videoId }, select: { qc: true } });
  await db().video.update({ where: { id: videoId }, data: { qc: json({ ...((cur?.qc ?? {}) as object), _media: media }) } });
}

/** video: normalise to 1080x1920@30 (crop/blur-pad) → R2 user-video asset + mono speech mp3. audio: transcode → narration mp3. */
export async function runIngest(ctx: PipelineCtx): Promise<void> {
  const v = await loadVideo(ctx.videoId);
  const src = sourceOf(v);
  if (src.kind !== "video" && src.kind !== "audio") return;
  if (!src.mediaUrl) throw new Error(`source.kind=${src.kind} requires source.mediaUrl`);
  const srcHash = hashOf(src.mediaUrl, src.mediaAspect);
  const prev = mediaOf(v);
  if (prev.srcHash === srcHash && prev.speechUrl) {
    await appendProgress(v.id, { step: "ingest", status: "skipped", message: "media already ingested" });
    return;
  }
  await trackStep(v.id, "ingest", async () => {
    const p = await probe(src.mediaUrl!);
    if (src.kind === "audio") {
      const mp3 = await toNarrationMp3(src.mediaUrl!);
      const speechUrl = await putObject(`narration/${v.id}.mp3`, mp3, "audio/mpeg", { source: "user-audio", hash: srcHash });
      await saveMedia(v.id, { speechUrl, durationMs: p.durationMs, srcHash });
      return { durationMs: p.durationMs };
    }
    if (!p.hasAudio && src.keepOriginalAudio) throw new Error("uploaded video has no audio track");
    const fit = chooseFit(p, src.mediaAspect);
    const normalized = await normalizeVideo(src.mediaUrl!, fit);
    const url = await putObject(`assets/${v.id}/source-1080x1920-${srcHash}.mp4`, normalized, "video/mp4", { source: "user-video", fit });
    const speech = await extractSpeechAudio(url);
    const speechUrl = await putObject(`assets/${v.id}/source-speech-${srcHash}.mp3`, speech, "audio/mpeg", { source: "user-video" });
    await saveMedia(v.id, { userVideo: { assetId: `${v.id}-src`, url, width: 1080, height: 1920, fit, srcHash }, speechUrl, durationMs: p.durationMs, srcHash });
    return { durationMs: p.durationMs, fit, input: `${p.width}x${p.height}` };
  }, { output: (r) => r });
}

// ───────────────────────── transcribe ─────────────────────────

export async function runTranscribe(ctx: PipelineCtx): Promise<Transcript | null> {
  const v = await loadVideo(ctx.videoId);
  const src = sourceOf(v);
  if (src.kind !== "video" && src.kind !== "audio") return null;
  const media = mediaOf(v);
  const existing = transcriptOf(v);
  if (existing && (existing as Transcript & { srcHash?: string }).srcHash === media.srcHash) {
    await appendProgress(v.id, { step: "transcribe", status: "skipped", message: "transcript cached" });
    return existing;
  }
  return trackStep(v.id, "transcribe", async () => {
    if (!media.speechUrl) throw new Error("ingest produced no speech audio");
    const audio = await fetchBuffer(media.speechUrl);
    const { transcript, usd, provider } = await transcribe(audio, { fileName: "speech.mp3", durationMs: media.durationMs });
    if (!transcript.words.length) throw new Error("transcription returned no words");
    await addCost(v.id, "sttUsd", usd);
    await saveTranscript(v.id, { ...transcript, srcHash: media.srcHash });
    return { ...transcript, provider } as Transcript;
  }, { output: (t) => ({ words: t.words.length, segments: t.segments.length, durationMs: t.durationMs }) });
}

// ───────────────────────── script ─────────────────────────

/** Resolve the format: explicit Video.format, else auto-pick from the prompt (Haiku) or kit prefs. */
async function resolveFormat(v: VideoWithChannel, text?: string): Promise<FormatTemplate> {
  const explicit = getFormat(v.format);
  if (explicit) return explicit;
  const kit = kitOf(v);
  const f = text && has.anthropic() ? await pickFormat(text, v.channel.niche, kit.formatPrefs).catch(() => heuristicFormat(v.channel.niche, kit.formatPrefs)) : heuristicFormat(v.channel.niche, kit.formatPrefs);
  await db().video.update({ where: { id: v.id }, data: { format: f.id } });
  return f;
}

export async function runScript(ctx: PipelineCtx, opts: { notes?: string } = {}): Promise<Script> {
  const v = await loadVideo(ctx.videoId);
  if (v.script) {
    const existing = ScriptSchema.safeParse(v.script);
    if (existing.success) {
      await appendProgress(v.id, { step: "script", status: "skipped", message: "script already present" });
      return existing.data;
    }
  }
  const src = sourceOf(v);
  if (src.kind === "audio" || src.kind === "video") return runMediaScript(ctx, v, src, opts.notes);
  return trackStep(v.id, "script", () => stepContext(v, "script", async () => {
    const kit = kitOf(v);
    const format = await resolveFormat(v, src.kind === "prompt" ? src.text ?? opts.notes : undefined);
    const idea = v.ideaId ? await db().idea.findUnique({ where: { id: v.ideaId } }) : null;
    const recent = await db().video.findMany({ where: { channelId: v.channelId, id: { not: v.id }, status: { in: ["READY", "PUBLISHED"] } }, orderBy: { createdAt: "desc" }, take: 30, select: { title: true } });
    const script = await writeScript({
      kit, format, niche: v.channel.niche, targetSec: v.targetSec,
      idea: idea
        ? { hook: idea.hook, title: idea.title, angle: idea.angle, beats: idea.beats, evidence: idea.evidence }
        : src.kind === "prompt" && src.text ? { angle: `USER TOPIC (make the video about exactly this): ${src.text}` } : null,
      notes: opts.notes, previousTitles: recent.map((r) => r.title),
    }, ctx.quality);
    await db().video.update({ where: { id: v.id }, data: { script: json(script), title: script.title.slice(0, 200), kitSnapshot: json(kit) } });
    return script;
  }), { output: (s) => ({ title: s.title, lines: s.lines.length, estimatedSec: s.estimatedSec }) });
}

/** audio → Script over the speaker's exact words; video → EDIT PLAN (+ derived Script for metadata/QC). */
async function runMediaScript(ctx: PipelineCtx, v: VideoWithChannel, src: VideoSource, notes?: string): Promise<Script> {
  return trackStep(v.id, "script", () => stepContext(v, "script", async () => {
    const t = transcriptOf(await loadVideo(v.id));
    if (!t) throw new Error("transcript missing");
    const kit = kitOf(v);
    const format = await resolveFormat(v, t.text.slice(0, 1500));
    let script: Script;
    const stored = (v.scenes ?? {}) as StoredScenes;
    if (src.kind === "audio") {
      script = await beatifyTranscript(t, format, kit, ctx.quality);
    } else {
      const speech = t.segments.filter((s) => s.kind === "speech");
      const roughMs = speech.reduce((a, s) => a + (s.endMs - s.startMs), 0);
      const edit = await planVideoEdit(t, { format, kit, cutIns: cutInTarget(roughMs, src.insertDensity), notes: [src.text, notes].filter(Boolean).join("\n") }, ctx.quality);
      const keep = new Set(edit.keep);
      const beatOf = new Map(edit.beats.map((b) => [b.segmentId, b.beatId]));
      const cutOf = new Map(edit.cutIns.map((c) => [c.segmentId, c]));
      let lastBeat = format.beats[0].id;
      script = ScriptSchema.parse({
        title: edit.title, hook: edit.hook, cta: edit.cta, hashtags: edit.hashtags, description: edit.description, sources: edit.sources,
        lines: speech.filter((s) => keep.has(s.id)).map((s) => {
          lastBeat = beatOf.get(s.id) ?? lastBeat;
          return { beatId: lastBeat, text: s.text, onScreen: cutOf.get(s.id)?.headline, visualNote: cutOf.get(s.id)?.block, targetSec: Math.round((s.endMs - s.startMs) / 100) / 10 };
        }),
        estimatedSec: Math.round(speech.filter((s) => keep.has(s.id)).reduce((a, s) => a + s.endMs - s.startMs, 0) / 100) / 10,
      });
      await db().video.update({ where: { id: v.id }, data: { scenes: json({ ...stored, edit }) } });
    }
    await db().video.update({ where: { id: v.id }, data: { script: json(script), title: script.title.slice(0, 200), kitSnapshot: json(kit) } });
    return script;
  }), { output: (s) => ({ title: s.title, lines: s.lines.length, estimatedSec: s.estimatedSec, kind: src.kind }) });
}

/** video kind: edited timeline from the edit plan (kept segments, padded, in source order). */
function editTimelineOf(v: VideoWithChannel) {
  const t = transcriptOf(v);
  const edit = ((v.scenes ?? {}) as StoredScenes).edit;
  if (!t || !edit) throw new Error("edit plan/transcript missing");
  const pieces = editTimeline(t.segments as Segment[], new Set(edit.keep));
  return { t, edit, pieces, totalMs: timelineDuration(pieces) };
}

export function narrationText(script: Script): string {
  return script.lines.map((l) => l.text.trim()).filter(Boolean).join(" ");
}

// ───────────────────────── voice ─────────────────────────

export async function runVoice(ctx: PipelineCtx): Promise<VoiceTrack> {
  const v = await loadVideo(ctx.videoId);
  const src = sourceOf(v);
  if (src.kind === "audio" || src.kind === "video") return runMediaVoice(v, src);
  const script = ScriptSchema.parse(v.script);
  const kit = kitOf(v);
  const text = narrationText(script);
  const hash = hashOf(text, kit.voice.provider, kit.voice.voiceId, kit.voice.speed);
  const prev = v.voice as (VoiceTrack & { hash?: string }) | null;
  if (prev?.hash === hash && prev.audioUrl) {
    await appendProgress(v.id, { step: "voice", status: "skipped", message: "narration cached" });
    return VoiceTrackSchema.parse(prev);
  }
  return trackStep(v.id, "voice", () => stepContext(v, "voice", async () => {
    const tts = ttsFor(kit.voice.provider, { free: ctx.watermark });
    const r = await tts.synthesize({ text, voiceId: kit.voice.voiceId, speed: kit.voice.speed, stability: kit.voice.stability, quality: ctx.quality, storageKey: `narration/${v.id}` });
    if (r.usd) await addCost(v.id, "ttsUsd", r.usd);
    const track: VoiceTrack = { audioUrl: r.audioUrl, durationMs: r.durationMs, words: r.words, provider: r.provider, voiceId: r.voiceId };
    await db().video.update({ where: { id: v.id }, data: { voice: json({ ...track, hash, model: r.model }) } });
    return track;
  }), { output: (t) => ({ durationMs: t.durationMs, words: t.words.length }) });
}

/** Uploaded audio is the narration (no TTS); uploaded video → trimmed speech of kept segments, words remapped. */
async function runMediaVoice(v: VideoWithChannel, src: VideoSource): Promise<VoiceTrack> {
  const media = mediaOf(v);
  const t = transcriptOf(v);
  if (!t || !media.speechUrl) throw new Error("ingest/transcribe must run before voice");
  if (src.kind === "audio") {
    const hash = hashOf("user-audio", media.srcHash);
    const prev = v.voice as (VoiceTrack & { hash?: string }) | null;
    if (prev?.hash === hash) { await appendProgress(v.id, { step: "voice", status: "skipped", message: "using uploaded audio" }); return VoiceTrackSchema.parse(prev); }
    return trackStep(v.id, "voice", async () => {
      const track: VoiceTrack = { audioUrl: media.speechUrl!, durationMs: t.durationMs, words: t.words.filter((w) => !isFiller(w.w)), provider: "user-audio", voiceId: "user" };
      await db().video.update({ where: { id: v.id }, data: { voice: json({ ...track, hash }) } });
      return track;
    }, { output: (tr) => ({ durationMs: tr.durationMs, words: tr.words.length, provider: "user-audio" }) });
  }
  const { pieces, totalMs } = editTimelineOf(v);
  const hash = hashOf("user-video", media.srcHash, pieces);
  const prev = v.voice as (VoiceTrack & { hash?: string }) | null;
  if (prev?.hash === hash) { await appendProgress(v.id, { step: "voice", status: "skipped", message: "trimmed speech cached" }); return VoiceTrackSchema.parse(prev); }
  return trackStep(v.id, "voice", async () => {
    // Cut from the normalised source video's full-quality audio (speech mp3 is 16 kHz for STT only).
    const srcUrl = media.userVideo?.url ?? media.speechUrl!;
    const audio = await trimConcatAudio(srcUrl, pieces.map((p) => ({ startMs: p.srcStartMs, endMs: p.srcEndMs })));
    const audioUrl = await putObject(`narration/${v.id}.mp3`, audio, "audio/mpeg", { source: "user-video-trim", hash });
    const track: VoiceTrack = { audioUrl, durationMs: totalMs, words: remapWords(t.words, pieces), provider: "user-video", voiceId: "user" };
    await db().video.update({ where: { id: v.id }, data: { voice: json({ ...track, hash }) } });
    return track;
  }, { output: (tr) => ({ durationMs: tr.durationMs, words: tr.words.length, provider: "user-video" }) });
}

// ───────────────────────── plan (LLM content; runs parallel with voice) ─────────────────────────

interface StoredScenes { draft?: PlannerOutput; draftHash?: string; plan?: ScenePlan; music?: { id: string; url: string; bpm: number; durationMs: number } | null; sfx?: Array<{ atMs: number; url: string }>; edit?: EditPlan }

export async function runPlan(ctx: PipelineCtx): Promise<PlannerOutput> {
  const v = await loadVideo(ctx.videoId);
  if (sourceOf(v).kind === "video") {
    // The edit plan (script step) already holds cut-in/overlay content; align builds the ScenePlan deterministically.
    await appendProgress(v.id, { step: "plan", status: "skipped", message: "using edit plan" });
    return { scenes: [], musicMood: ((v.scenes ?? {}) as StoredScenes).edit?.musicMood ?? "calm" };
  }
  const script = ScriptSchema.parse(v.script);
  const draftHash = hashOf(script, v.format);
  const stored = (v.scenes ?? {}) as StoredScenes;
  if (stored.draft && stored.draftHash === draftHash) {
    await appendProgress(v.id, { step: "plan", status: "skipped", message: "plan cached" });
    return PlannerOutputSchema.parse(stored.draft);
  }
  return trackStep(v.id, "plan", () => stepContext(v, "plan", async () => {
    const text = narrationText(script);
    const estimated: VoiceTrack = { audioUrl: "", durationMs: Math.round(script.estimatedSec * 1000), words: estimateWordTimings(text, Math.round(script.estimatedSec * 1000)), provider: "estimate", voiceId: "" };
    const draft = await planScenes({ script, voice: estimated, format: formatOf(v), kit: kitOf(v) }, ctx.quality);
    // Re-read: voice may have written concurrently; merge only our keys.
    const cur = ((await db().video.findUnique({ where: { id: v.id }, select: { scenes: true } }))?.scenes ?? {}) as StoredScenes;
    await db().video.update({ where: { id: v.id }, data: { scenes: json({ ...cur, draft, draftHash }) } });
    return draft;
  }), { output: (d) => ({ scenes: d.scenes.length, musicMood: d.musicMood }) });
}

// ───────────────────────── align (deterministic: timings + music) ─────────────────────────

/**
 * video kind: interleave `video-segment` scenes (user footage [inMs,outMs]) with full-screen HF cut-ins that
 * replace the picture during a kept segment, plus `overlay-*` scenes layered over footage (data.layer="overlay").
 */
export function buildVideoEditPlan(input: { pieces: TimelinePiece[]; edit: EditPlan; userVideo: { assetId: string; fit: string }; totalMs: number; formatBeats: string[] }): ScenePlan {
  const { pieces, edit, userVideo } = input;
  const cut = new Map(edit.cutIns.map((c) => [c.segmentId, c]));
  const beatOf = new Map(edit.beats.map((b) => [b.segmentId, b.beatId]));
  const scenes: ScenePlan["scenes"] = [];
  const sfxCues: ScenePlan["sfxCues"] = [];
  let lastBeat = input.formatBeats[0] ?? "hook";
  pieces.forEach((p, i) => {
    lastBeat = beatOf.get(p.segmentId) ?? lastBeat;
    const c = cut.get(p.segmentId);
    if (c) {
      const data = { ...(c.data ?? {}), ...(c.asset && c.asset.kind !== "none" ? { asset: c.asset } : {}), cutIn: true, segmentId: p.segmentId };
      scenes.push({ id: `c${i + 1}`, beatId: lastBeat, startMs: p.editStartMs, durationMs: p.durationMs, block: c.block, headline: c.headline, body: c.body, data, assetIds: [], transitionIn: "cut" });
      if (c.sfx) sfxCues.push({ atMs: Math.max(0, p.editStartMs - 80), cue: c.sfx });
    } else {
      scenes.push({ id: `v${i + 1}`, beatId: lastBeat, startMs: p.editStartMs, durationMs: p.durationMs, block: "video-segment", data: { assetId: userVideo.assetId, inMs: p.srcStartMs, outMs: p.srcEndMs, crop: userVideo.fit, segmentId: p.segmentId }, assetIds: [userVideo.assetId], transitionIn: i === 0 ? undefined : "cut" });
    }
  });
  edit.overlays.forEach((o, k) => {
    const p = pieces.find((x) => x.segmentId === o.segmentId);
    if (!p || cut.has(o.segmentId)) return;
    const dur = Math.min(p.durationMs, o.block === "overlay-lower-third" ? 3500 : 1800);
    scenes.push({ id: `o${k + 1}`, beatId: beatOf.get(o.segmentId) ?? lastBeat, startMs: p.editStartMs + (o.block === "overlay-lower-third" ? 300 : 0), durationMs: dur, block: o.block.startsWith("overlay-") ? o.block : `overlay-${o.block}`, headline: o.headline, body: o.body, data: { layer: "overlay", over: `v${pieces.indexOf(p) + 1}` }, assetIds: [] });
  });
  scenes.sort((a, b) => a.startMs - b.startMs || (a.block.startsWith("overlay-") ? 1 : 0) - (b.block.startsWith("overlay-") ? 1 : 0));
  return ScenePlanSchema.parse({ scenes, totalMs: input.totalMs, musicMood: edit.musicMood, sfxCues });
}

export async function runAlign(ctx: PipelineCtx): Promise<ScenePlan> {
  const v = await loadVideo(ctx.videoId);
  if (sourceOf(v).kind === "video") {
    return trackStep(v.id, "align", async () => {
      const { edit, pieces, totalMs } = editTimelineOf(v);
      const media = mediaOf(v);
      if (!media.userVideo) throw new Error("user video asset missing");
      const plan = buildVideoEditPlan({ pieces, edit, userVideo: media.userVideo, totalMs, formatBeats: formatOf(v).beats.map((b) => b.id) });
      const music = await pickTrack({ mood: edit.musicMood, minDurationMs: totalMs, seed: v.channelId }).catch(() => null);
      const stored = (v.scenes ?? {}) as StoredScenes;
      await db().video.update({ where: { id: v.id }, data: { scenes: json({ ...stored, plan, music: music ? { id: music.id, url: music.url, bpm: music.bpm, durationMs: music.durationMs } : null }) } });
      return plan;
    }, { output: (p) => ({ scenes: p.scenes.length, totalMs: p.totalMs, cutIns: p.scenes.filter((s) => (s.data as { cutIn?: boolean } | undefined)?.cutIn).length }) });
  }
  return trackStep(v.id, "align", async () => {
    const script = ScriptSchema.parse(v.script);
    const voice = VoiceTrackSchema.parse(v.voice);
    const stored = (v.scenes ?? {}) as StoredScenes;
    const draft = PlannerOutputSchema.parse(stored.draft);
    const format = formatOf(v);
    const music = await pickTrack({ mood: draft.musicMood, minDurationMs: voice.durationMs, seed: v.channelId }).catch((e) => { log.warn("music pick failed", { err: errMsg(e) }); return null; });
    const timed = alignScenes({
      scenes: draft.scenes.map((s) => ({ id: s.id, beatId: s.beatId })),
      lines: script.lines.map((l) => ({ beatId: l.beatId, text: l.text })),
      beats: format.beats.map((b) => ({ id: b.id, share: b.share })),
      words: voice.words as Word[],
      totalMs: voice.durationMs,
      beatMs: music ? music.beatMs : undefined,
    });
    const byId = new Map(timed.map((t) => [t.id, t]));
    const plan: ScenePlan = ScenePlanSchema.parse({
      scenes: draft.scenes.map((s) => {
        const t = byId.get(s.id)!;
        const data = { ...(s.data ?? {}), ...(s.asset && s.asset.kind !== "none" ? { asset: s.asset } : {}) };
        return { id: s.id, beatId: s.beatId, startMs: t.startMs, durationMs: t.durationMs, block: s.block, headline: s.headline, body: s.body, data, assetIds: [], transitionIn: s.transitionIn };
      }),
      totalMs: voice.durationMs,
      musicMood: draft.musicMood,
      sfxCues: draft.scenes.filter((s) => s.sfx).map((s) => ({ atMs: Math.max(0, (byId.get(s.id)?.startMs ?? 0) - 120), cue: s.sfx! })),
    });
    await db().video.update({ where: { id: v.id }, data: { scenes: json({ ...stored, plan, music: music ? { id: music.id, url: music.url, bpm: music.bpm, durationMs: music.durationMs } : null }) } });
    return plan;
  }, { output: (p) => ({ scenes: p.scenes.length, totalMs: p.totalMs }) });
}

export function storedPlan(v: VideoWithChannel): { plan: ScenePlan; music: StoredScenes["music"]; sfx: NonNullable<StoredScenes["sfx"]> } {
  const s = (v.scenes ?? {}) as StoredScenes;
  // Rerender may send a plain ScenePlan in Video.scenes.
  const plan = ScenePlanSchema.parse(s.plan ?? s);
  return { plan, music: s.music ?? null, sfx: s.sfx ?? [] };
}

// ───────────────────────── assets ─────────────────────────

export async function runAssets(ctx: PipelineCtx): Promise<Asset[]> {
  const v = await loadVideo(ctx.videoId);
  return trackStep(v.id, "assets", () => stepContext(v, "assets", async () => {
    const stored = (v.scenes ?? {}) as StoredScenes;
    const { plan } = storedPlan(v);
    const requests: AssetRequest[] = plan.scenes.flatMap((s) => {
      const a = (s.data as { asset?: { kind: AssetRequest["kind"]; prompt?: string; query?: string } } | undefined)?.asset;
      return a ? [{ kind: a.kind, prompt: a.prompt, query: a.query, videoId: v.id, sceneId: s.id, style: kitOf(v).skin.name }] : [];
    }).slice(0, 6);
    const assets: Asset[] = [];
    const queue = [...requests];
    const workers = Array.from({ length: 3 }, async () => {
      for (let r = queue.shift(); r; r = queue.shift()) {
        const res = await resolveAsset(r, { stockOnly: ctx.quality === "draft" });
        if (!res) continue;
        if (res.usd) await addCost(v.id, "imagesUsd", res.usd);
        assets.push(AssetSchema.parse({ id: res.id, kind: res.kind, url: res.url, source: res.source, license: res.license, prompt: res.prompt, width: res.width, height: res.height }));
      }
    });
    await Promise.all(workers);
    const ids = new Set(assets.map((a) => a.id));
    plan.scenes = plan.scenes.map((s) => ({ ...s, assetIds: [...new Set([...s.assetIds, ...[`${s.id}-img`, `${s.id}-vid`, `${s.id}-icon`].filter((id) => ids.has(id))])] }));
    const uv = mediaOf(v).userVideo;
    if (uv) assets.unshift(AssetSchema.parse({ id: uv.assetId, kind: "user-video", url: uv.url, source: "user", license: "user-owned", width: uv.width, height: uv.height }));
    const { sfx, usd } = await resolveSfxCues(plan.sfxCues);
    if (usd) await addCost(v.id, "sfxUsd", usd);
    await db().video.update({ where: { id: v.id }, data: { assets: json(assets), scenes: json({ ...stored, plan, sfx }) } });
    return assets;
  }), { output: (a) => ({ assets: a.length }) });
}

// ───────────────────────── compose + review loop ─────────────────────────

export interface ComposeState { ok: boolean; attempts: number; lint?: LintReport }

function composeInputs(v: VideoWithChannel) {
  const script = ScriptSchema.parse(v.script);
  const voice = VoiceTrackSchema.parse(v.voice);
  const { plan, music, sfx } = storedPlan(v);
  const assets = ((v.assets ?? []) as unknown[]).map((a) => AssetSchema.parse(a));
  const src = sourceOf(v);
  const uv = mediaOf(v).userVideo;
  const media = src.kind === "video" || src.kind === "audio"
    ? { userVideo: uv ? AssetSchema.parse({ id: uv.assetId, kind: "user-video", url: uv.url, source: "user", license: "user-owned", width: uv.width, height: uv.height }) : undefined, speechAudioUrl: src.keepOriginalAudio || src.kind === "audio" ? voice.audioUrl : undefined }
    : undefined;
  return { script, voice, plan, music, sfx, assets, media, kit: kitOf(v), format: formatOf(v) };
}

export async function runCompose(ctx: PipelineCtx): Promise<ComposeState> {
  const v = await loadVideo(ctx.videoId);
  return trackStep(v.id, "compose", () => stepContext(v, "compose", async () => {
    const i = composeInputs(v);
    const baseline = CompositionSchema.parse(hfkit.composeVideo({
      script: i.script, voice: i.voice, plan: i.plan, kit: i.kit, assets: i.assets,
      music: i.music ? { url: i.music.url, bpm: i.music.bpm, durationMs: i.music.durationMs } : null,
      sfx: i.sfx, width: 1080, height: 1920, fps: 30, watermark: ctx.watermark, media: i.media,
    }));
    let comp = baseline;
    let lint = hfkit.lintComposition(baseline);
    if (ctx.quality !== "draft" && has.anthropic()) {
      try {
        const refined = await refineComposition({ script: i.script, plan: i.plan, kit: i.kit, format: i.format, assets: i.assets, words: i.voice.words as Word[], baseline }, ctx.quality);
        const rl = hfkit.lintComposition(refined);
        if (rl.errors.length <= lint.errors.length) { comp = refined; lint = rl; }
      } catch (e) {
        log.warn("composer refine failed; using baseline", { videoId: v.id, err: errMsg(e) });
      }
    }
    await db().video.update({ where: { id: v.id }, data: { composition: json(comp) } });
    return { ok: lint.ok, attempts: 0, lint };
  }), { output: (s) => ({ lintOk: s.ok, errors: s.lint?.errors.length ?? 0 }) });
}

/** One lint/critic iteration. Loop condition: ok || attempts >= 2. */
export async function runReview(ctx: PipelineCtx, state: ComposeState): Promise<ComposeState> {
  const v = await loadVideo(ctx.videoId);
  return trackStep(v.id, "lint", () => stepContext(v, "lint", async () => {
    const comp = CompositionSchema.parse(v.composition);
    const lint = hfkit.lintComposition(comp);
    const wantCritic = !lint.ok || (ctx.quality === "premium" && state.attempts === 0);
    if (!wantCritic || !has.anthropic()) return { ok: lint.ok, attempts: state.attempts + 1, lint };
    const crit = await critique({ comp, lint }, ctx.quality);
    const fixes = [...lint.errors.map((e) => `Lint error: ${e}`), ...crit.fixes.filter((f) => f.severity !== "minor").map((f) => `${f.sceneId ? `[${f.sceneId}] ` : ""}${f.issue} → ${f.fix}`)];
    await db().video.update({ where: { id: v.id }, data: { qc: json({ ...((v.qc ?? {}) as object), criticNotes: crit.notes ?? null, criticFixes: crit.fixes }) } });
    if (!fixes.length) return { ok: lint.ok, attempts: state.attempts + 1, lint };
    const i = composeInputs(v);
    try {
      const revised = await refineComposition({ script: i.script, plan: i.plan, kit: i.kit, format: i.format, assets: i.assets, words: i.voice.words as Word[], baseline: comp, fixes }, ctx.quality === "draft" ? "standard" : ctx.quality);
      const rl = hfkit.lintComposition(revised);
      if (rl.errors.length <= lint.errors.length) {
        await db().video.update({ where: { id: v.id }, data: { composition: json(revised) } });
        return { ok: rl.ok, attempts: state.attempts + 1, lint: rl };
      }
    } catch (e) {
      log.warn("composer revise failed", { videoId: v.id, err: errMsg(e) });
    }
    return { ok: lint.ok, attempts: state.attempts + 1, lint };
  }), { output: (s) => ({ ok: s.ok, attempt: s.attempts, errors: s.lint?.errors.slice(0, 5) }) });
}

// ───────────────────────── render ─────────────────────────

export interface RenderMeta { jobId?: string; hash: string; workflowId?: string; submittedAt: string; provider: "lambda" | "local" }

export function compositionHash(v: VideoWithChannel): string {
  return hashOf(v.composition);
}

/** Local render (synchronous). Returns master URL. */
export async function runRenderLocal(ctx: PipelineCtx): Promise<string> {
  const v = await loadVideo(ctx.videoId);
  const hash = compositionHash(v);
  const meta = ((v.qc ?? {}) as { render?: RenderMeta }).render;
  if (v.masterUrl && meta?.hash === hash) {
    await appendProgress(v.id, { step: "render", status: "skipped", message: "already rendered" });
    return v.masterUrl;
  }
  return trackStep(v.id, "render", async () => {
    const comp = CompositionSchema.parse(v.composition);
    const { music, sfx } = storedPlan(v);
    const voice = VoiceTrackSchema.parse(v.voice);
    const { masterUrl } = await renderLocal({ videoId: v.id, composition: comp, narrationUrl: voice.audioUrl || undefined, music, sfx, quality: ctx.quality });
    const render: RenderMeta = { hash, submittedAt: new Date().toISOString(), provider: "local" };
    await db().video.update({ where: { id: v.id }, data: { masterUrl, qc: json({ ...((v.qc ?? {}) as object), render }) } });
    return masterUrl;
  }, { output: (u) => ({ masterUrl: u }) });
}

/** Submit to the Lambda renderer; idempotent per composition hash. Returns the jobId to suspend on. */
export async function submitRender(ctx: PipelineCtx, opts: { callbackUrl: string; workflowId: string }): Promise<{ jobId: string; reused: boolean }> {
  const v = await loadVideo(ctx.videoId);
  const hash = compositionHash(v);
  const meta = ((v.qc ?? {}) as { render?: RenderMeta }).render;
  if (meta?.jobId && meta.hash === hash) return { jobId: meta.jobId, reused: true };
  await setStatus(v.id, "RENDERING");
  await appendProgress(v.id, { step: "render", status: "started", message: "submitted to renderer" });
  const comp = CompositionSchema.parse(v.composition);
  const voice = VoiceTrackSchema.parse(v.voice);
  const { music } = storedPlan(v);
  const uv = mediaOf(v).userVideo;
  const { jobId } = await submitRemote(comp, { videoId: v.id, audioUrls: [voice.audioUrl, music?.url].filter((u): u is string => !!u), videoUrls: uv ? [uv.url] : undefined, callbackUrl: opts.callbackUrl, quality: ctx.quality === "premium" ? "high" : ctx.quality });
  const render: RenderMeta = { jobId, hash, workflowId: opts.workflowId, submittedAt: new Date().toISOString(), provider: "lambda" };
  await db().video.update({ where: { id: v.id }, data: { qc: json({ ...((v.qc ?? {}) as object), render }) } });
  await addCost(v.id, "renderUsd", estimateRenderUsd(comp.durationMs, comp.fps));
  return { jobId, reused: false };
}

export async function completeRender(ctx: PipelineCtx, result: { status: string; videoUrl?: string; error?: string }): Promise<string> {
  if (result.status !== "completed" || !result.videoUrl) {
    await appendProgress(ctx.videoId, { step: "render", status: "failed", message: result.error ?? `render ${result.status}` });
    throw new Error(`render failed: ${result.error ?? result.status}`);
  }
  await db().video.update({ where: { id: ctx.videoId }, data: { masterUrl: result.videoUrl } });
  await appendProgress(ctx.videoId, { step: "render", status: "done", output: { masterUrl: result.videoUrl } });
  return result.videoUrl;
}

// ───────────────────────── qc ─────────────────────────

export async function runQc(ctx: PipelineCtx): Promise<{ score: number; flags: string[] }> {
  const v = await loadVideo(ctx.videoId);
  return trackStep(v.id, "qc", async () => {
    const script = ScriptSchema.parse(v.script);
    const { plan } = storedPlan(v);
    const assets = ((v.assets ?? []) as unknown[]).map((a) => AssetSchema.parse(a));
    const prev = await db().video.findMany({
      where: { channelId: v.channelId, id: { not: v.id }, status: { in: ["READY", "PUBLISHED"] } },
      orderBy: { createdAt: "desc" }, take: 30, select: { id: true, script: true, scenes: true },
    });
    const fp = (s: unknown, sc: unknown) => {
      const sp = ScriptSchema.safeParse(s);
      const scenes = ((sc as StoredScenes | null)?.plan ?? sc) as { scenes?: Array<{ block: string }> } | null;
      return { text: sp.success ? [sp.data.hook, ...sp.data.lines.map((l) => l.text)].join(" ") : "", blocks: scenes?.scenes?.map((x) => x.block) ?? [] };
    };
    const orig = originality(fp(script, { plan }), prev.map((p) => ({ id: p.id, ...fp(p.script, p.scenes) })));
    const policy = policyLint(script, { niche: v.channel.niche, format: v.format });
    const labels = aiLabels(assets);
    const comp = CompositionSchema.safeParse(v.composition);
    const lint = comp.success ? hfkit.lintComposition(comp.data) : { ok: false, errors: ["composition missing"], warnings: [] };
    const flags = [...orig.flags, ...policy.flags];
    await db().video.update({
      where: { id: v.id },
      data: {
        originality: json({ score: orig.score, flags: orig.flags, comparedTo: orig.comparedTo, maxSimilarity: orig.maxSimilarity, mostSimilarId: orig.mostSimilarId ?? null }),
        qc: json({ ...((v.qc ?? {}) as object), lintPassed: lint.ok, lintWarnings: lint.warnings.slice(0, 20), policy, labels, needsReview: policy.blocking || orig.flags.includes("near_duplicate") }),
      },
    });
    return { score: orig.score, flags };
  }, { output: (r) => r });
}

// ───────────────────────── cuts + READY ─────────────────────────

export async function runCuts(ctx: PipelineCtx): Promise<{ masterUrl: string; thumbnailUrl: string | null }> {
  const v = await loadVideo(ctx.videoId);
  return trackStep(v.id, "cuts", () => stepContext(v, "cuts", async () => {
    if (!v.masterUrl) throw new Error("no master video");
    const script = ScriptSchema.parse(v.script);
    const sec = Math.round(((await probeDurationMs(v.masterUrl)) ?? VoiceTrackSchema.parse(v.voice).durationMs) / 100) / 10;
    let thumbnailUrl: string | null = v.thumbnailUrl;
    if (!thumbnailUrl && has.r2()) {
      const dir = mkdtempSync(join(tmpdir(), "remawt-thumb-"));
      try {
        const out = join(dir, "thumb.jpg");
        await extractThumbnail(v.masterUrl, out, Math.min(1.2, sec / 3));
        thumbnailUrl = await putObject(`videos/${v.id}/thumb.jpg`, readFileSync(out), "image/jpeg");
      } catch (e) {
        log.warn("thumbnail failed", { videoId: v.id, err: errMsg(e) });
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
    let meta;
    try { meta = has.anthropic() || has.deepseek() ? await writeMetadata(script, v.channel.niche) : fallbackMetadata(script); }
    catch (e) { log.warn("metadata failed", { err: errMsg(e) }); meta = fallbackMetadata(script); }
    const cuts = {
      youtube: { url: v.masterUrl, sec, meta: meta.youtube },
      tiktok: { url: v.masterUrl, sec, meta: meta.tiktok, needsLongCut: sec < 60 },
      instagram: { url: v.masterUrl, sec, meta: meta.instagram },
    };
    await db().video.update({ where: { id: v.id }, data: { cuts: json(cuts), thumbnailUrl, status: "READY", error: null } });
    if (v.ideaId) await db().idea.update({ where: { id: v.ideaId }, data: { status: "PRODUCED" } }).catch(() => undefined);
    await appendProgress(v.id, { step: "ready", status: "done", output: { masterUrl: v.masterUrl } });
    return { masterUrl: v.masterUrl, thumbnailUrl };
  }), { output: (r) => r });
}

// ───────────────────────── failure ─────────────────────────

export async function failVideo(videoId: string, error: string): Promise<void> {
  log.error("video failed", { videoId, error });
  try {
    await db().video.update({ where: { id: videoId }, data: { status: "FAILED", error: error.slice(0, 2000) } });
    await appendProgress(videoId, { step: "pipeline", status: "failed", message: error.slice(0, 500) });
    await refundVideo(videoId, error);
  } catch (e) {
    log.error("failVideo bookkeeping failed", { videoId, err: errMsg(e) });
  }
}

/** For smoke tests: write a composition to disk for inspection. */
export function dumpComposition(comp: Composition, path: string): void {
  writeFileSync(path, JSON.stringify(comp, null, 2));
}
