/**
 * seriesTick — Inngest cron (hourly). For active Series whose next slot is within the production lead time:
 * pick the next APPROVED idea (or generate some), consume quota, create a Video and start produce.
 * When that video is READY (see functions.ts onVideoReady) Publications are created at the slot time;
 * mode APPROVE leaves them SCHEDULED with meta.needsApproval=true.
 */
import { z } from "zod";
import { Prisma, type Platform } from "@remawt/db";
import { createWorkflow, createStep } from "../inngest.js";
import { db } from "../../lib/db.js";
import { log, errMsg } from "../../lib/logger.js";
import { generateIdeas } from "./generateIdeas.js";
import { requestProduce } from "../../pipeline/start.js";

export interface Cadence { perWeek?: number; days?: number[]; hourLocal?: number; formats?: string[] }
export const LEAD_MS = 6 * 3600_000;

/** Offset (ms) of `tz` vs UTC at instant `d`. */
function tzOffsetMs(d: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** Next slot strictly after `after`: a day in cadence.days (1=Mon … 7=Sun) at hourLocal in the channel timezone. */
export function nextSlot(cadence: Cadence, tz: string, after: Date): Date {
  const days = cadence.days?.length ? cadence.days : [1, 3, 5];
  const hour = cadence.hourLocal ?? 17;
  for (let i = 0; i <= 14; i++) {
    const probe = new Date(after.getTime() + i * 86400_000);
    const off = (() => { try { return tzOffsetMs(probe, tz); } catch { return 0; } })();
    const local = new Date(probe.getTime() + off);
    const slotUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hour) - off;
    const dow = local.getUTCDay() === 0 ? 7 : local.getUTCDay();
    if (days.includes(dow) && slotUtc > after.getTime()) return new Date(slotUtc);
  }
  return new Date(after.getTime() + 86400_000);
}

async function consumeQuota(userId: string, videoId: string): Promise<boolean> {
  return db().$transaction(async (tx) => {
    const u = await tx.user.findUnique({ where: { id: userId } });
    if (!u || u.videosUsed >= u.videoAllowance + u.rolloverVideos) return false;
    await tx.user.update({ where: { id: userId }, data: { videosUsed: { increment: 1 } } });
    await tx.usageLedger.create({ data: { userId, videoId, delta: -1, kind: "video", note: "series" } });
    return true;
  });
}

export async function tickSeries(now = new Date()): Promise<Array<{ seriesId: string; videoId?: string; skipped?: string }>> {
  const due = await db().series.findMany({ where: { active: true, OR: [{ nextRunAt: null }, { nextRunAt: { lte: new Date(now.getTime() + LEAD_MS) } }] }, include: { channel: true } });
  const out: Array<{ seriesId: string; videoId?: string; skipped?: string }> = [];
  for (const s of due) {
    const cadence = (s.cadence ?? {}) as Cadence;
    if (!s.nextRunAt) {
      await db().series.update({ where: { id: s.id }, data: { nextRunAt: nextSlot(cadence, s.channel.timezone, now) } });
      out.push({ seriesId: s.id, skipped: "initialised nextRunAt" });
      continue;
    }
    const slot = s.nextRunAt;
    try {
      let idea = await db().idea.findFirst({ where: { channelId: s.channelId, status: "APPROVED", ...(cadence.formats?.length ? { format: { in: cadence.formats } } : {}) }, orderBy: { score: "desc" } });
      if (!idea && s.mode === "AUTO") {
        const ids = await generateIdeas(s.channelId, { count: 3 });
        idea = ids.length ? await db().idea.findFirst({ where: { id: { in: ids } }, orderBy: { score: "desc" } }) : null;
      }
      if (!idea) { out.push({ seriesId: s.id, skipped: "no approved idea" }); continue; }
      const kit = s.channel.kit as { defaultDurationSec?: number };
      const video = await db().video.create({
        data: { channelId: s.channelId, ideaId: idea.id, seriesId: s.id, title: idea.title, format: idea.format, targetSec: kit.defaultDurationSec ?? 45, status: "DRAFT", qc: { _series: { slot: slot.toISOString() } } as Prisma.InputJsonValue },
      });
      if (!(await consumeQuota(s.channel.userId, video.id))) {
        await db().video.update({ where: { id: video.id }, data: { status: "FAILED", error: "video quota exhausted" } });
        out.push({ seriesId: s.id, skipped: "quota exhausted" });
      } else {
        await db().idea.update({ where: { id: idea.id }, data: { status: "QUEUED" } });
        await requestProduce({ videoId: video.id });
        out.push({ seriesId: s.id, videoId: video.id });
      }
      await db().series.update({ where: { id: s.id }, data: { nextRunAt: nextSlot(cadence, s.channel.timezone, slot) } });
    } catch (e) {
      log.error("series tick failed", { seriesId: s.id, err: errMsg(e) });
      out.push({ seriesId: s.id, skipped: errMsg(e) });
    }
  }
  return out;
}

/** On READY: create Publications for a series video at its slot, for each connected account on the series platforms. */
export async function schedulePublicationsForSeriesVideo(videoId: string): Promise<string[]> {
  const v = await db().video.findUnique({ where: { id: videoId }, include: { series: true } });
  if (!v?.series) return [];
  const slotIso = ((v.qc ?? {}) as { _series?: { slot?: string } })._series?.slot;
  const scheduledAt = slotIso && new Date(slotIso).getTime() > Date.now() ? new Date(slotIso) : new Date(Date.now() + 10 * 60_000);
  const accounts = await db().socialAccount.findMany({ where: { channelId: v.channelId, status: "connected", platform: { in: v.series.platforms as Platform[] } } });
  const ids: string[] = [];
  for (const a of accounts) {
    const exists = await db().publication.findFirst({ where: { videoId, socialAccountId: a.id } });
    if (exists) { ids.push(exists.id); continue; }
    const p = await db().publication.create({
      data: { videoId, socialAccountId: a.id, platform: a.platform, scheduledAt, status: "SCHEDULED", meta: { needsApproval: v.series.mode === "APPROVE", series: v.series.id } as Prisma.InputJsonValue },
    });
    ids.push(p.id);
  }
  return ids;
}

const tickStep = createStep({
  id: "tick", inputSchema: z.object({}).passthrough(), outputSchema: z.object({ results: z.array(z.object({ seriesId: z.string(), videoId: z.string().optional(), skipped: z.string().optional() })) }),
  execute: async () => ({ results: await tickSeries() }),
});

export const seriesTick = createWorkflow({ id: "seriesTick", inputSchema: z.object({}).passthrough(), outputSchema: z.object({ results: z.array(z.object({ seriesId: z.string(), videoId: z.string().optional(), skipped: z.string().optional() })) }), cron: "5 * * * *", inputData: {}, concurrency: { limit: 1 } })
  .then(tickStep)
  .commit();
