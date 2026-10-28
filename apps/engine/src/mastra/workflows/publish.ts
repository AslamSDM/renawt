/**
 * publishPublication — Inngest workflow: load → sleepUntil(scheduledAt) → Publisher.publish → update Publication.
 * collectMetrics   — Inngest cron (hourly): snapshots at 1h/6h/24h/72h/7d → MetricSnapshot (+ outlierScore vs account median).
 */
import { z } from "zod";
import { Prisma, type Platform } from "@remawt/db";
import { createWorkflow, createStep } from "../inngest.js";
import { db } from "../../lib/db.js";
import { getPublisher } from "../../lib/publisher.js";
import type { Platform as PubPlatform } from "@remawt/publisher";
import { log, errMsg } from "../../lib/logger.js";

const PubInput = z.object({ publicationId: z.string() });
const Loaded = z.object({ publicationId: z.string(), scheduledAt: z.string() });
const PubOut = z.object({ publicationId: z.string(), status: z.string(), externalUrl: z.string().optional() });

interface PubMeta { title?: string; caption?: string; hashtags?: string[]; privacy?: "public" | "private" | "friends" | "followers" | "unlisted"; aiLabel?: boolean; aiGenerated?: boolean; madeForKids?: boolean; commercial?: boolean; needsApproval?: boolean; approved?: boolean; description?: string; tags?: string[]; [k: string]: unknown }

/** Build provider meta from Publication.meta overrides + Video.cuts per-platform metadata + QC labels. */
export function publishMetaFor(platform: Platform, pubMeta: PubMeta, cuts: Record<string, { meta?: Record<string, unknown> }> | null, labels?: { syntheticMedia?: boolean; aigc?: boolean }) {
  const key = platform === "YOUTUBE" ? "youtube" : platform === "TIKTOK" ? "tiktok" : "instagram";
  const m = (cuts?.[key]?.meta ?? {}) as { title?: string; description?: string; tags?: string[]; caption?: string; hashtags?: string[] };
  return {
    title: pubMeta.title ?? m.title,
    caption: pubMeta.caption ?? m.caption ?? m.description,
    description: pubMeta.description ?? m.description,
    hashtags: pubMeta.hashtags ?? m.hashtags ?? m.tags,
    tags: pubMeta.tags ?? m.tags,
    privacy: pubMeta.privacy,
    aiGenerated: pubMeta.aiGenerated ?? pubMeta.aiLabel ?? !!(labels?.syntheticMedia || labels?.aigc),
    madeForKids: pubMeta.madeForKids ?? false,
    commercial: pubMeta.commercial,
  };
}

export async function publishNow(publicationId: string): Promise<z.infer<typeof PubOut>> {
  const pub = await db().publication.findUnique({ where: { id: publicationId }, include: { video: true, socialAccount: true } });
  if (!pub) return { publicationId, status: "missing" };
  if (pub.status === "CANCELLED" || pub.status === "PUBLISHED") return { publicationId, status: pub.status };
  const meta = (pub.meta ?? {}) as PubMeta;
  if (meta.needsApproval && !meta.approved) return { publicationId, status: "AWAITING_APPROVAL" };
  const videoUrl = pub.video.masterUrl;
  if (!videoUrl || pub.video.status !== "READY" && pub.video.status !== "PUBLISHED") {
    await db().publication.update({ where: { id: pub.id }, data: { status: "FAILED", error: "video not ready" } });
    return { publicationId, status: "FAILED" };
  }
  const claimed = await db().publication.updateMany({ where: { id: pub.id, status: { in: ["SCHEDULED", "FAILED"] } }, data: { status: "PUBLISHING", error: null } });
  if (!claimed.count) return { publicationId, status: "PUBLISHING" };
  try {
    const labels = ((pub.video.qc ?? {}) as { labels?: { syntheticMedia?: boolean; aigc?: boolean } }).labels;
    const r = await getPublisher().publish({
      publicationId: pub.id,
      videoUrl,
      target: { socialAccountId: pub.socialAccountId, platform: pub.platform as PubPlatform, providerAccountId: pub.socialAccount.externalId },
      meta: publishMetaFor(pub.platform, meta, pub.video.cuts as never, labels),
      idempotencyKey: `pub_${pub.id}`,
    });
    const status = r.status === "failed" ? "FAILED" : r.status === "published" ? "PUBLISHED" : "PUBLISHING";
    await db().publication.update({
      where: { id: pub.id },
      data: { status, providerJobId: r.providerJobId, externalPostId: r.externalPostId ?? null, externalUrl: r.externalUrl ?? null, publishedAt: status === "PUBLISHED" ? new Date() : null, error: r.error ?? null },
    });
    if (status === "PUBLISHED") await db().video.update({ where: { id: pub.videoId }, data: { status: "PUBLISHED" } });
    return { publicationId, status, externalUrl: r.externalUrl };
  } catch (e) {
    await db().publication.update({ where: { id: pub.id }, data: { status: "FAILED", error: errMsg(e).slice(0, 1000) } });
    throw e;
  }
}

const loadStep = createStep({
  id: "load", inputSchema: PubInput, outputSchema: Loaded,
  execute: async ({ inputData }) => {
    const p = await db().publication.findUnique({ where: { id: inputData.publicationId }, select: { scheduledAt: true } });
    if (!p) throw new Error(`publication ${inputData.publicationId} not found`);
    return { publicationId: inputData.publicationId, scheduledAt: p.scheduledAt.toISOString() };
  },
});

const publishStep = createStep({
  id: "publish", inputSchema: Loaded, outputSchema: PubOut,
  execute: async ({ inputData }) => {
    // Re-read: the schedule may have moved while we slept.
    const p = await db().publication.findUnique({ where: { id: inputData.publicationId }, select: { scheduledAt: true, status: true } });
    if (p && p.status === "SCHEDULED" && p.scheduledAt.getTime() > Date.now() + 60_000) return { publicationId: inputData.publicationId, status: "RESCHEDULED" };
    return publishNow(inputData.publicationId);
  },
});

export const publishPublication = createWorkflow({ id: "publishPublication", inputSchema: PubInput, outputSchema: PubOut, retries: 3 })
  .then(loadStep)
  .sleepUntil(async ({ inputData }) => new Date(inputData.scheduledAt))
  .then(publishStep)
  .commit();

// ───────────────────────── metrics ─────────────────────────

export const METRIC_BUCKETS: Array<{ t: string; ms: number }> = [
  { t: "1h", ms: 3600_000 }, { t: "6h", ms: 6 * 3600_000 }, { t: "24h", ms: 24 * 3600_000 }, { t: "72h", ms: 72 * 3600_000 }, { t: "7d", ms: 7 * 86400_000 },
];

export function dueBuckets(publishedAt: Date, existing: string[], now = new Date()): string[] {
  const age = now.getTime() - publishedAt.getTime();
  return METRIC_BUCKETS.filter((b) => age >= b.ms && !existing.includes(b.t)).map((b) => b.t);
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export async function collectMetricsOnce(now = new Date()): Promise<number> {
  const pubs = await db().publication.findMany({
    where: { status: "PUBLISHED", publishedAt: { gte: new Date(now.getTime() - 8 * 86400_000) }, externalPostId: { not: null } },
    include: { metrics: { select: { t: true } }, socialAccount: { select: { externalId: true } } },
    take: 500,
  });
  let written = 0;
  for (const p of pubs) {
    const due = dueBuckets(p.publishedAt!, p.metrics.map((m) => m.t), now);
    if (!due.length) continue;
    try {
      const m = await getPublisher().metrics(p.externalPostId!, p.platform as PubPlatform, { providerAccountId: p.socialAccount.externalId, publishedAt: p.publishedAt! });
      if (!m) continue;
      for (const t of due) {
        const peers = await db().metricSnapshot.findMany({ where: { t, publication: { socialAccountId: p.socialAccountId }, publicationId: { not: p.id } }, select: { views: true }, orderBy: { capturedAt: "desc" }, take: 30 });
        const med = median(peers.map((x) => x.views));
        await db().metricSnapshot.upsert({
          where: { publicationId_t: { publicationId: p.id, t } },
          create: { publicationId: p.id, t, views: m.views, likes: m.likes, comments: m.comments, shares: m.shares, saves: m.saves, avgWatchSec: m.avgWatchSec ?? null, retention: (m.retention ?? undefined) as Prisma.InputJsonValue | undefined, outlierScore: med > 0 ? m.views / med : null, raw: (m.raw ?? undefined) as Prisma.InputJsonValue | undefined },
          update: {},
        });
        written++;
      }
    } catch (e) {
      log.warn("metrics fetch failed", { publicationId: p.id, err: errMsg(e) });
    }
  }
  return written;
}

const metricsStep = createStep({
  id: "collect", inputSchema: z.object({}).passthrough(), outputSchema: z.object({ written: z.number() }),
  execute: async () => ({ written: await collectMetricsOnce() }),
});

export const collectMetrics = createWorkflow({ id: "collectMetrics", inputSchema: z.object({}).passthrough(), outputSchema: z.object({ written: z.number() }), cron: "17 * * * *", inputData: {}, concurrency: { limit: 1 } })
  .then(metricsStep)
  .commit();
