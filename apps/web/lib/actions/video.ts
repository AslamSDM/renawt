"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FORMAT_IDS, SceneSchema, TranscriptSchema, type ProgressEvent, type VideoSource } from "@remawt/shared";
import type { Prisma } from "@remawt/db";
import { prisma } from "@/lib/db/prisma";
import { canRerender, consumeVideo, getEntitlements, refundVideo } from "@/lib/billing";
import { engine } from "@/lib/engine";
import { getViewerOrNull } from "@/lib/queries/viewer";
import { QUALITY_ORDER } from "@/lib/queries/billing";
import { parseProgress, parseScenePlan } from "@/lib/queries/shapes";
import { BYPASS_READONLY, NOT_SIGNED_IN, fail, ok, zodFieldErrors, type ActionResult } from "./result";

const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

const StartVideoInput = z
  .object({
    channelId: z.string().min(1),
    kind: z.enum(["idea", "prompt", "video", "audio"]),
    ideaId: z.string().optional(),
    text: z.string().trim().max(4000).optional(),
    format: z.string().optional(),
    targetSec: z.number().int().min(20).max(90).default(45),
    quality: z.enum(QUALITY_ORDER).default("standard"),
    mediaUrl: z.string().url().optional(),
    mediaDurationMs: z.number().nonnegative().optional(),
    mediaAspect: z.enum(["9:16", "16:9", "1:1", "4:5"]).optional(),
    keepOriginalAudio: z.boolean().default(true),
    insertDensity: z.enum(["light", "medium", "heavy"]).default("medium"),
    notes: z.string().trim().max(2000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "idea" && !v.ideaId) ctx.addIssue({ code: "custom", path: ["ideaId"], message: "Pick an idea from your queue." });
    if (v.kind === "prompt" && (!v.text || v.text.length < 8))
      ctx.addIssue({ code: "custom", path: ["text"], message: "Describe the video in a sentence or two (8+ characters)." });
    if ((v.kind === "video" || v.kind === "audio") && !v.mediaUrl)
      ctx.addIssue({ code: "custom", path: ["mediaUrl"], message: "Upload a file first." });
    if (v.format && !FORMAT_IDS.includes(v.format)) ctx.addIssue({ code: "custom", path: ["format"], message: "Unknown format." });
  });

export async function startVideo(input: z.input<typeof StartVideoInput>): Promise<ActionResult<{ videoId: string }>> {
  const viewer = await getViewerOrNull();
  if (!viewer) return fail(NOT_SIGNED_IN);
  if (viewer.bypass) return fail(BYPASS_READONLY);

  const parsed = StartVideoInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form.", zodFieldErrors(parsed.error));
  const v = parsed.data;

  const channel = await prisma.channel.findFirst({ where: { id: v.channelId, userId: viewer.userId } });
  if (!channel) return fail("Channel not found.");
  if (channel.status === "PAUSED") return fail("This channel is paused. Resume it in channel settings first.");

  const ent = await getEntitlements(viewer.userId);
  if (ent.videosRemaining <= 0) return fail(`You’ve used all ${ent.allowance + ent.rollover} videos this period. Upgrade or wait for the reset.`);

  const idea = v.ideaId ? await prisma.idea.findFirst({ where: { id: v.ideaId, channelId: channel.id } }) : null;
  if (v.kind === "idea" && !idea) return fail("That idea no longer exists.");

  // Clamp to plan.
  const maxQ = QUALITY_ORDER.indexOf(ent.plan.quality);
  const quality = QUALITY_ORDER[Math.min(QUALITY_ORDER.indexOf(v.quality), maxQ)];
  const targetSec = Math.min(v.targetSec, ent.plan.maxDurationSec);

  const source: VideoSource = {
    kind: v.kind,
    text: v.text || undefined,
    mediaUrl: v.mediaUrl,
    mediaDurationMs: v.mediaDurationMs,
    mediaAspect: v.mediaAspect,
    keepOriginalAudio: v.keepOriginalAudio,
    insertDensity: v.insertDensity,
  };

  const title =
    idea?.title ??
    (v.text ? v.text.split(/\s+/).slice(0, 10).join(" ").slice(0, 90) : v.kind === "video" ? "Edited upload" : "Voiceover video");
  const format = v.format ?? idea?.format ?? "auto";
  const now = new Date().toISOString();
  const initial: ProgressEvent[] = [{ step: "queued", status: "done", at: now, message: "Waiting for the engine" }];

  const video = await prisma.video.create({
    data: {
      channelId: channel.id,
      ideaId: idea?.id ?? null,
      title,
      format,
      targetSec,
      status: "QUEUED",
      sourceKind: v.kind,
      sourceUrl: v.mediaUrl ?? null,
      source: json(source),
      progress: json(initial),
      kitSnapshot: channel.kit ?? undefined,
    },
  });

  const consumed = await consumeVideo(viewer.userId, video.id);
  if (!consumed.ok) {
    await prisma.video.delete({ where: { id: video.id } });
    return fail(consumed.reason === "QUOTA_EXCEEDED" ? "You’re out of videos for this period." : "Account not found.");
  }

  const res = await engine.startVideo(viewer.userId, {
    videoId: video.id,
    channelId: channel.id,
    ideaId: idea?.id,
    format: v.format ?? idea?.format,
    targetSec,
    notes: v.notes || undefined,
    quality,
    source,
  });

  if (!res.ok) {
    await refundVideo(viewer.userId, video.id, "engine unavailable");
    await prisma.video.update({
      where: { id: video.id },
      data: {
        status: "FAILED",
        error: res.reason,
        progress: json([...initial, { step: "start", status: "failed", at: new Date().toISOString(), message: res.reason }]),
      },
    });
    revalidatePath("/app", "layout");
    return fail(`${res.reason} Your video credit was returned.`);
  }

  await prisma.video.update({ where: { id: video.id }, data: { runId: res.data.runId } });
  if (idea) await prisma.idea.update({ where: { id: idea.id }, data: { status: "QUEUED" } });
  revalidatePath("/app", "layout");
  return ok({ videoId: video.id });
}

const SceneEdit = SceneSchema.pick({ id: true, headline: true, body: true, data: true, assetIds: true });
const SaveScenesInput = z.object({ videoId: z.string(), order: z.array(z.string()), edits: z.array(SceneEdit) });

/** Saves scene text/data edits and order into Video.scenes without rendering. */
export async function saveScenes(input: z.input<typeof SaveScenesInput>): Promise<ActionResult> {
  const viewer = await getViewerOrNull();
  if (!viewer) return fail(NOT_SIGNED_IN);
  if (viewer.bypass) return fail(BYPASS_READONLY);
  const parsed = SaveScenesInput.safeParse(input);
  if (!parsed.success) return fail("Some scene fields are invalid.", zodFieldErrors(parsed.error));
  const video = await prisma.video.findFirst({ where: { id: parsed.data.videoId, channel: { userId: viewer.userId } } });
  if (!video) return fail("Video not found.");
  const plan = parseScenePlan(video.scenes);
  if (!plan) return fail("This video has no scene plan yet.");
  const edits = new Map(parsed.data.edits.map((e) => [e.id, e]));
  const byId = new Map(plan.scenes.map((s) => [s.id, s]));
  const ordered = parsed.data.order.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  const rest = plan.scenes.filter((s) => !parsed.data.order.includes(s.id));
  let t = 0;
  const scenes = [...ordered, ...rest].map((s) => {
    const e = edits.get(s.id);
    const next = { ...s, ...(e ?? {}), startMs: t };
    t += s.durationMs;
    return next;
  });
  await prisma.video.update({ where: { id: video.id }, data: { scenes: json({ ...plan, scenes, totalMs: t }) } });
  revalidatePath(`/app/videos/${video.id}`);
  return ok(undefined);
}

export async function rerenderVideo(videoId: string): Promise<ActionResult> {
  const viewer = await getViewerOrNull();
  if (!viewer) return fail(NOT_SIGNED_IN);
  if (viewer.bypass) return fail(BYPASS_READONLY);
  const video = await prisma.video.findFirst({ where: { id: videoId, channel: { userId: viewer.userId } } });
  if (!video) return fail("Video not found.");
  const ent = await getEntitlements(viewer.userId);
  if (!canRerender(video, ent.plan)) return fail(`You’ve used the ${ent.plan.rerendersPerVideo} free re-renders for this video.`);
  const res = await engine.rerender(viewer.userId, { videoId, scenes: video.scenes ?? undefined, script: video.script ?? undefined });
  if (!res.ok) return fail(res.reason);
  const progress = parseProgress(video.progress);
  await prisma.video.update({
    where: { id: videoId },
    data: {
      rerenders: { increment: 1 },
      status: "COMPOSING",
      runId: res.data.runId,
      progress: json([...progress, { step: "rerender", status: "started", at: new Date().toISOString(), message: "Re-render requested" }]),
    },
  });
  revalidatePath(`/app/videos/${videoId}`);
  return ok(undefined);
}

const TranscriptKeepInput = z.object({ videoId: z.string(), keep: z.record(z.string(), z.boolean()) });

/** Toggles which transcript segments are kept (Video.transcript). Applied on the next re-render. */
export async function saveTranscriptKeeps(input: z.input<typeof TranscriptKeepInput>): Promise<ActionResult> {
  const viewer = await getViewerOrNull();
  if (!viewer) return fail(NOT_SIGNED_IN);
  if (viewer.bypass) return fail(BYPASS_READONLY);
  const parsed = TranscriptKeepInput.safeParse(input);
  if (!parsed.success) return fail("Invalid segment selection.");
  const video = await prisma.video.findFirst({ where: { id: parsed.data.videoId, channel: { userId: viewer.userId } }, select: { id: true, transcript: true } });
  if (!video) return fail("Video not found.");
  const t = TranscriptSchema.safeParse(video.transcript);
  if (!t.success) return fail("No transcript to edit yet.");
  const next = { ...t.data, segments: t.data.segments.map((s) => ({ ...s, keep: parsed.data.keep[s.id] ?? s.keep })) };
  await prisma.video.update({ where: { id: video.id }, data: { transcript: json(next) } });
  revalidatePath(`/app/videos/${video.id}`);
  return ok(undefined);
}
