import { Router } from "express";
import { z } from "zod";
import { StartVideoRequest, RerenderRequest, ScriptSchema, ScenePlanSchema, getFormat, getPlan, VideoSourceSchema, type ProgressEvent } from "@remawt/shared";
import { Prisma } from "@remawt/db";
import { db } from "../lib/db.js";
import { planForUser } from "../lib/billing.js";
import { saveSource } from "../lib/videoSource.js";
import { requestProduce } from "../pipeline/start.js";
import { handle, parse, ownedVideo, userId, HttpError } from "./http.js";

export const videos = Router();

/** Web has already created the Video row and consumed quota; we only update it and enqueue the run. */
videos.post("/start", handle(async (req, res) => {
  const body = parse(StartVideoRequest, req.body);
  const v = await ownedVideo(body.videoId, userId(res));
  if (v.channelId !== body.channelId) throw new HttpError(400, "videoId does not belong to channelId");
  if (["QUEUED", "SCRIPTING", "VOICING", "PLANNING", "COMPOSING", "RENDERING", "QC", "TRANSCRIBING"].includes(v.status)) throw new HttpError(409, `video already running (${v.status})`);
  const source = VideoSourceSchema.parse(body.source ?? { kind: body.ideaId ? "idea" : "prompt" });
  if ((source.kind === "video" || source.kind === "audio") && !source.mediaUrl) throw new HttpError(400, `source.mediaUrl required for kind=${source.kind}`);
  if (source.kind === "prompt" && !source.text && !body.notes) throw new HttpError(400, "source.text required for kind=prompt");
  const data: Prisma.VideoUpdateInput = {};
  if (body.format && getFormat(body.format)) data.format = body.format;
  if (body.targetSec) data.targetSec = Math.round(Math.min(90, Math.max(20, body.targetSec)));
  if (body.ideaId) data.idea = { connect: { id: body.ideaId } };
  if (Object.keys(data).length) await db().video.update({ where: { id: v.id }, data });
  await saveSource(v.id, source);
  const { runId } = await requestProduce({ videoId: v.id, quality: body.quality, notes: body.notes });
  return { videoId: v.id, runId };
}));

/** Script edit → re-voice (full produce; script step reuses the edited script). Scene edit → compose onward only. */
videos.post("/rerender", handle(async (req, res) => {
  const body = parse(RerenderRequest, req.body);
  const v = await ownedVideo(body.videoId, userId(res));
  const plan = getPlan(await planForUser(v.channel.userId));
  if (v.rerenders >= plan.rerendersPerVideo) throw new HttpError(402, `re-render limit reached (${plan.rerendersPerVideo})`);
  const data: Prisma.VideoUpdateInput = { rerenders: { increment: 1 }, masterUrl: null, thumbnailUrl: null, cuts: Prisma.DbNull };
  let kind: "produce" | "rerender" = "rerender";
  if (body.script !== undefined) {
    data.script = ScriptSchema.parse(body.script) as Prisma.InputJsonValue;
    data.composition = Prisma.DbNull;
    kind = "produce"; // voice/plan hashes change → those steps re-run; untouched steps stay cached
  }
  if (body.scenes !== undefined) {
    const plan = ScenePlanSchema.parse(body.scenes);
    data.scenes = { ...((v.scenes ?? {}) as object), plan } as Prisma.InputJsonValue;
  }
  if (body.script === undefined && body.scenes === undefined) throw new HttpError(400, "script or scenes required");
  await db().video.update({ where: { id: v.id }, data });
  const { runId } = await requestProduce({ videoId: v.id, kind });
  return { runId };
}));

videos.get("/:id/progress", handle(async (req, res) => {
  const v = await ownedVideo(String(req.params.id), userId(res));
  return { status: v.status, progress: ((v.progress ?? []) as ProgressEvent[]), error: v.error ?? undefined, masterUrl: v.masterUrl ?? undefined };
}));

export const VideoIdParam = z.object({ id: z.string() });
