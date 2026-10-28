import { Router } from "express";
import { z } from "zod";
import { KitPreviewRequest, GenerateIdeasRequest, RefreshRadarRequest, SchedulePublicationRequest, LAUNCH_NICHES, NICHES } from "@remawt/shared";
import { Prisma, type Platform } from "@remawt/db";
import { db } from "../lib/db.js";
import { hashOf } from "../lib/hash.js";
import { existingObject, putObject } from "../lib/r2.js";
import { elevenlabs, kokoro } from "../lib/tts/index.js";
import { KOKORO_VOICES } from "../lib/tts/kokoro.js";
import { getPublisher } from "../lib/publisher.js";
import { weekKey } from "@remawt/radar";
import { kitPreviews } from "../mastra/workflows/kitPreviews.js";
import { generateIdeas } from "../mastra/workflows/generateIdeas.js";
import { tickSeries } from "../mastra/workflows/seriesTick.js";
import { inngest, EVENTS } from "../mastra/inngest.js";
import { activeNiches } from "../mastra/workflows/radarRefresh.js";
import { handle, parse, ownedChannel, ownedVideo, userId, HttpError } from "./http.js";

export const kit = Router();
export const voices = Router();
export const radarRoutes = Router();
export const ideas = Router();
export const publications = Router();
export const social = Router();
export const series = Router();

// ───── kit ─────
kit.post("/previews", handle(async (req, res) => {
  const body = parse(KitPreviewRequest, req.body);
  await ownedChannel(body.channelId, userId(res));
  const run = await kitPreviews.createRun();
  const r = await run.start({ inputData: body });
  if (r.status !== "success") throw new HttpError(502, `preview render failed: ${r.status === "failed" ? r.error?.message ?? "" : r.status}`);
  return r.result;
}));

const VoiceSample = z.object({ voiceId: z.string(), provider: z.enum(["elevenlabs", "kokoro", "inworld"]).default("elevenlabs"), text: z.string().min(1).max(400) });
kit.post("/voice-sample", handle(async (req) => {
  const body = parse(VoiceSample, req.body);
  const key = `voice-samples/${body.provider}-${hashOf(body.voiceId, body.text)}.mp3`;
  const hit = await existingObject(key);
  if (hit) return { audioUrl: hit.url };
  const provider = body.provider === "kokoro" ? kokoro : elevenlabs;
  if (!provider.isConfigured()) throw new HttpError(503, `${body.provider} not configured`);
  const { audio, contentType } = await provider.sample!({ text: body.text, voiceId: body.voiceId });
  return { audioUrl: await putObject(key, audio, contentType) };
}));

// ───── voices ─────
voices.get("/", handle(async () => {
  const el = await elevenlabs.listVoices();
  const ko = kokoro.isConfigured() ? KOKORO_VOICES.map((v) => ({ voiceId: v, name: v.replace(/^[a-z]+_/, "").replace(/^./, (c) => c.toUpperCase()), provider: "kokoro", tags: [v.startsWith("a") ? "american" : "british", v[1] === "f" ? "female" : "male", "free"] })) : [];
  return [...el, ...ko];
}));

// ───── radar ─────
radarRoutes.post("/refresh", handle(async (req) => {
  const body = parse(RefreshRadarRequest, req.body);
  const niches = body.niches?.length ? body.niches.filter((n) => NICHES.some((x) => x.slug === n)) : await activeNiches().catch(() => LAUNCH_NICHES);
  await inngest.send({ name: EVENTS.radarRefresh, data: { niches, force: body.force } });
  return { queued: niches };
}));

radarRoutes.get("/:niche", handle(async (req) => {
  const week = typeof req.query.week === "string" ? req.query.week : weekKey();
  const cards = await db().trendCard.findMany({ where: { niche: String(req.params.niche), weekKey: week }, orderBy: { score: "desc" }, take: 50 });
  return { cards };
}));

// ───── ideas ─────
ideas.post("/generate", handle(async (req, res) => {
  const body = parse(GenerateIdeasRequest, req.body);
  await ownedChannel(body.channelId, userId(res));
  return { ideaIds: await generateIdeas(body.channelId, { count: body.count, weekKey: body.weekKey }) };
}));

// ───── publications ─────
publications.post("/schedule", handle(async (req, res) => {
  const body = parse(SchedulePublicationRequest, req.body);
  const v = await ownedVideo(body.videoId, userId(res));
  if (v.status !== "READY" && v.status !== "PUBLISHED") throw new HttpError(409, `video not ready (${v.status})`);
  const ids: string[] = [];
  for (const t of body.targets) {
    const acct = await db().socialAccount.findUnique({ where: { id: t.socialAccountId } });
    if (!acct || acct.channelId !== v.channelId) throw new HttpError(400, `social account ${t.socialAccountId} not connected to this channel`);
    const scheduledAt = new Date(t.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) throw new HttpError(400, `invalid scheduledAt ${t.scheduledAt}`);
    const p = await db().publication.create({ data: { videoId: v.id, socialAccountId: acct.id, platform: acct.platform, scheduledAt, status: "SCHEDULED", meta: (t.meta ?? {}) as Prisma.InputJsonValue } });
    ids.push(p.id);
  }
  if (ids.length) await inngest.send(ids.map((publicationId) => ({ name: EVENTS.publishScheduled, data: { publicationId } })));
  return { publicationIds: ids };
}));

publications.post("/:id/cancel", handle(async (req, res) => {
  const p = await db().publication.findUnique({ where: { id: String(req.params.id) }, include: { video: { include: { channel: true } } } });
  if (!p || p.video.channel.userId !== userId(res)) throw new HttpError(404, "publication not found");
  if (p.status === "PUBLISHED") throw new HttpError(409, "already published");
  await db().publication.update({ where: { id: p.id }, data: { status: "CANCELLED" } });
  const pub = getPublisher();
  if (p.providerJobId && pub.cancel) await pub.cancel(p.providerJobId).catch(() => undefined);
  return { ok: true };
}));

// ───── social ─────
const ConnectBody = z.object({ channelId: z.string(), platform: z.string(), returnUrl: z.string().url() });
social.post("/connect", handle(async (req, res) => {
  const body = parse(ConnectBody, req.body);
  const channel = await ownedChannel(body.channelId, userId(res));
  const r = await getPublisher().connect({ channelId: channel.id, userId: userId(res), platform: body.platform.toUpperCase() as never, returnUrl: body.returnUrl, providerProfileId: channel.publisherProfileId ?? undefined });
  if (r.providerProfileId && r.providerProfileId !== channel.publisherProfileId) await db().channel.update({ where: { id: channel.id }, data: { publisherProfileId: r.providerProfileId } });
  return { url: r.url, providerProfileId: r.providerProfileId };
}));

const SyncBody = z.object({ channelId: z.string() });
social.post("/sync", handle(async (req, res) => {
  const body = parse(SyncBody, req.body);
  const channel = await ownedChannel(body.channelId, userId(res));
  if (!channel.publisherProfileId) throw new HttpError(409, "channel has no connected publisher profile; call /v1/social/connect first");
  const pub = getPublisher();
  const accounts = await pub.listConnectedAccounts(channel.publisherProfileId);
  const rows = [];
  for (const a of accounts) {
    const status = a.status ?? "connected";
    rows.push(await db().socialAccount.upsert({
      where: { channelId_platform_externalId: { channelId: channel.id, platform: a.platform as Platform, externalId: a.providerAccountId } },
      create: { channelId: channel.id, platform: a.platform as Platform, provider: pub.id, externalId: a.providerAccountId, handle: a.handle ?? null, avatarUrl: a.avatarUrl ?? null, status },
      update: { handle: a.handle ?? null, avatarUrl: a.avatarUrl ?? null, status, provider: pub.id },
    }));
  }
  return { accounts: rows };
}));

// ───── series (internal cron trigger) ─────
series.post("/tick", handle(async () => ({ results: await tickSeries() })));
