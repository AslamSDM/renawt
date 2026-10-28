/**
 * /webhooks/render            — render completion callback (Lambda/StepFunctions/EventBridge). Auth: HMAC token
 *                                 (?videoId=&token=) from the callbackUrl we generated, or the engine bearer key.
 * /webhooks/publisher/:provider — aggregator status callbacks. Auth: x-webhook-secret = PUBLISHER_WEBHOOK_SECRET (if set).
 */
import { Router } from "express";
import { z } from "zod";
import { env } from "../lib/env.js";
import { verifyToken } from "../lib/hash.js";
import { db } from "../lib/db.js";
import { log } from "../lib/logger.js";
import { resumeRender } from "../mastra/functions.js";
import { bearerOk, handle, parse, HttpError } from "./http.js";

export const webhooks = Router();

const RenderCallback = z.object({
  videoId: z.string().optional(),
  jobId: z.string().optional(),
  status: z.enum(["queued", "rendering", "completed", "failed", "succeeded", "error", "done"]),
  videoUrl: z.string().optional(),
  url: z.string().optional(),
  error: z.string().optional(),
});

webhooks.post("/render", handle(async (req, res) => {
  const body = parse(RenderCallback, req.body);
  const videoId = (req.query.videoId as string | undefined) ?? body.videoId;
  if (!videoId) throw new HttpError(400, "videoId required");
  if (!verifyToken(env.apiKey, videoId, req.query.token as string | undefined) && !bearerOk(req.header("authorization"))) throw new HttpError(401, "bad token");
  const status = body.status === "succeeded" || body.status === "done" ? "completed" : body.status === "error" ? "failed" : body.status;
  if (status !== "completed" && status !== "failed") return { ok: true, ignored: status };
  const v = await db().video.findUnique({ where: { id: videoId }, select: { qc: true } });
  const jobId = ((v?.qc ?? {}) as { render?: { jobId?: string } }).render?.jobId;
  if (body.jobId && jobId && body.jobId !== jobId) return { ok: true, ignored: "stale job" };
  const resumed = await resumeRender(videoId, { status, videoUrl: body.videoUrl ?? body.url, error: body.error }, "webhook");
  res.status(202);
  return { ok: true, resumed };
}));

const PublisherCallback = z.object({
  providerJobId: z.string().optional(),
  jobId: z.string().optional(),
  id: z.string().optional(),
  status: z.string(),
  externalPostId: z.string().optional(),
  externalUrl: z.string().optional(),
  error: z.string().optional(),
}).passthrough();

webhooks.post("/publisher/:provider", handle(async (req) => {
  const secret = process.env.PUBLISHER_WEBHOOK_SECRET;
  if (secret && req.header("x-webhook-secret") !== secret) throw new HttpError(401, "bad secret");
  const body = parse(PublisherCallback, req.body);
  const providerJobId = body.providerJobId ?? body.jobId ?? body.id;
  if (!providerJobId) throw new HttpError(400, "providerJobId required");
  const s = body.status.toLowerCase();
  const status = ["published", "success", "completed", "posted"].includes(s) ? "PUBLISHED" : ["failed", "error"].includes(s) ? "FAILED" : null;
  if (!status) return { ok: true, ignored: s };
  const n = await db().publication.updateMany({
    where: { providerJobId },
    data: { status, externalPostId: body.externalPostId, externalUrl: body.externalUrl, error: body.error ?? null, ...(status === "PUBLISHED" ? { publishedAt: new Date() } : {}) },
  });
  log.info("publisher webhook", { provider: req.params.provider, providerJobId, status, updated: n.count });
  return { ok: true, updated: n.count };
}));
