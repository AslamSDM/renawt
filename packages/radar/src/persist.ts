import type { Platform, Prisma, PrismaClient } from "@remawt/db";
import type { Outcome } from "./bandit";
import { topicKey } from "./text";
import type { IdeaDraft, RadarPlatform, ScoredTrendItem, TrendCardDraft, TrendTags } from "./types";
import { weekStart } from "./week";

/** Only the delegates the radar touches — lets tests pass a fake. No global client here. */
export type RadarDb = Pick<PrismaClient, "trendItem" | "trendCard" | "idea" | "video" | "metricSnapshot">;

/** DB `Platform` enum values. Radar-only platforms (REDDIT/GOOGLE_TRENDS/NEWS) are not persisted as TrendItems yet. */
export const DB_PLATFORMS: readonly Platform[] = ["TIKTOK", "YOUTUBE", "INSTAGRAM", "FACEBOOK", "THREADS", "LINKEDIN", "X", "PINTEREST"];
export function isDbPlatform(p: RadarPlatform): p is Platform { return (DB_PLATFORMS as readonly string[]).includes(p); }

const json = (v: unknown) => v as Prisma.InputJsonValue;

export type PersistableItem = ScoredTrendItem & { tags?: TrendTags };

export function itemStats(it: ScoredTrendItem) {
  return {
    views: it.views, likes: it.likes, comments: it.comments, shares: it.shares,
    ageHours: Number(it.ageHours.toFixed(2)), velocity: Number(it.velocity.toFixed(3)), outlier: Number(it.outlier.toFixed(3)),
    zscore: it.zscore === undefined ? undefined : Number(it.zscore.toFixed(3)), corroboration: it.corroboration, breakout: it.breakout,
    score: it.score === undefined ? undefined : Number(it.score.toFixed(4)), lengthSec: it.lengthSec, sourceId: it.sourceId, region: it.region, query: it.query,
  };
}

/** Upsert by (platform, url). Returns the number of rows written (radar-only platforms skipped). */
export async function upsertTrendItems(prisma: RadarDb, niche: string, items: PersistableItem[], opts: { now?: Date; concurrency?: number } = {}): Promise<number> {
  const now = opts.now ?? new Date();
  const rows = items.filter((i) => isDbPlatform(i.platform));
  const conc = opts.concurrency ?? 10;
  let written = 0;
  for (let i = 0; i < rows.length; i += conc) {
    await Promise.all(rows.slice(i, i + conc).map(async (it) => {
      const data = {
        niche,
        externalId: it.externalId ?? null,
        title: it.title.slice(0, 500),
        caption: it.caption?.slice(0, 2000) ?? null,
        creator: it.creator ?? null,
        creatorMedianViews: it.creatorMedianViews ? Math.round(Math.min(it.creatorMedianViews, 2_147_483_647)) : null,
        stats: json(itemStats(it)),
        ...(it.tags ? { tags: json(it.tags) } : {}),
        fetchedAt: now,
        publishedAt: it.publishedAt ?? null,
      };
      await prisma.trendItem.upsert({
        where: { platform_url: { platform: it.platform as Platform, url: it.url } },
        create: { platform: it.platform as Platform, url: it.url, ...data },
        update: data,
      });
      written++;
    }));
  }
  return written;
}

export interface StoredCard extends TrendCardDraft { id: string }

/**
 * Write this week's cards for a niche. Existing cards matching (topicKey, format) are
 * updated in place so Idea.cardId links survive re-runs; stale cards with no ideas are deleted.
 */
export async function writeTrendCards(prisma: RadarDb, niche: string, weekKey: string, cards: TrendCardDraft[]): Promise<StoredCard[]> {
  const existing = await prisma.trendCard.findMany({ where: { niche, weekKey }, select: { id: true, topic: true, format: true, _count: { select: { ideas: true } } } });
  const byKey = new Map(existing.map((c) => [`${topicKey(c.topic)}|${c.format}`, c]));
  const used = new Set<string>();
  const out: StoredCard[] = [];
  for (const card of cards) {
    const data = {
      niche, weekKey, topic: card.topic.slice(0, 200), format: card.format, hookType: card.hookType ?? null, score: card.score,
      summary: card.summary.slice(0, 1000), exemplars: json(card.exemplars), evidence: json(card.evidence),
    };
    const match = byKey.get(`${topicKey(card.topic)}|${card.format}`);
    if (match && !used.has(match.id)) {
      used.add(match.id);
      await prisma.trendCard.update({ where: { id: match.id }, data });
      out.push({ ...card, niche, weekKey, id: match.id });
    } else {
      const created = await prisma.trendCard.create({ data, select: { id: true } });
      out.push({ ...card, niche, weekKey, id: created.id });
    }
  }
  const stale = existing.filter((c) => !used.has(c.id) && c._count.ideas === 0).map((c) => c.id);
  if (stale.length) await prisma.trendCard.deleteMany({ where: { id: { in: stale } } });
  return out;
}

export async function loadTrendCards(prisma: RadarDb, niche: string, weekKey: string, limit = 20) {
  const rows = await prisma.trendCard.findMany({ where: { niche, weekKey }, orderBy: { score: "desc" }, take: limit });
  return rows.map((r) => ({
    id: r.id, topic: r.topic, format: r.format, hookType: r.hookType, score: r.score, summary: r.summary,
    exemplars: (r.exemplars ?? []) as unknown as TrendCardDraft["exemplars"],
    evidence: (r.evidence ?? []) as unknown as TrendCardDraft["evidence"],
  }));
}

/** Pseudo-cards (one per tagged item) for formatTrends(), built from TrendItems fetched in a week. */
export async function loadWeekFormatItems(prisma: RadarDb, niche: string, weekKey: string) {
  const start = weekStart(weekKey);
  const end = new Date(start.getTime() + 7 * 86400000);
  const rows = await prisma.trendItem.findMany({ where: { niche, fetchedAt: { gte: start, lt: end } }, select: { tags: true, stats: true } });
  return rows.flatMap((r) => {
    const tags = r.tags as unknown as TrendTags | null;
    if (!tags?.format) return [];
    const stats = (r.stats ?? {}) as { breakout?: boolean };
    return [{ format: tags.format, itemCount: 1, breakoutCount: stats.breakout ? 1 : 0 }];
  });
}

export async function createIdeas(prisma: RadarDb, channelId: string, drafts: IdeaDraft[], opts: { source?: string } = {}): Promise<string[]> {
  const ids: string[] = [];
  for (const d of drafts) {
    const row = await prisma.idea.create({
      data: {
        channelId, cardId: d.cardId ?? null, hook: d.hook, title: d.title, format: d.format, angle: d.angle,
        beats: json(d.beats), evidence: json(d.evidence), risk: json(d.risk), score: d.score, source: opts.source ?? "radar",
      },
      select: { id: true },
    });
    ids.push(row.id);
  }
  return ids;
}

/** Recent idea + video titles for the dedupe list. */
export async function loadRecentTitles(prisma: RadarDb, channelId: string, opts: { days?: number; limit?: number } = {}): Promise<string[]> {
  const since = new Date(Date.now() - (opts.days ?? 60) * 86400000);
  const limit = opts.limit ?? 40;
  const [ideas, videos] = await Promise.all([
    prisma.idea.findMany({ where: { channelId, createdAt: { gte: since } }, select: { title: true }, orderBy: { createdAt: "desc" }, take: limit }),
    prisma.video.findMany({ where: { channelId, createdAt: { gte: since } }, select: { title: true }, orderBy: { createdAt: "desc" }, take: limit }),
  ]);
  return [...new Set([...videos.map((v) => v.title), ...ideas.map((i) => i.title)])].slice(0, limit);
}

const T_RANK: Record<string, number> = { "7d": 5, "72h": 4, "24h": 3, "6h": 2, "1h": 1 };

/** Bandit outcomes: latest outlier score per publication (prefers 7d > 72h > 24h). */
export async function loadChannelOutcomes(prisma: RadarDb, channelId: string, opts: { days?: number } = {}): Promise<Outcome[]> {
  const since = new Date(Date.now() - (opts.days ?? 120) * 86400000);
  const snaps = await prisma.metricSnapshot.findMany({
    where: { outlierScore: { not: null }, capturedAt: { gte: since }, t: { in: ["24h", "72h", "7d"] }, publication: { video: { channelId } } },
    select: { publicationId: true, t: true, outlierScore: true, publication: { select: { video: { select: { format: true, title: true, idea: { select: { card: { select: { topic: true } } } } } } } } },
  });
  const best = new Map<string, (typeof snaps)[number]>();
  for (const s of snaps) {
    const prev = best.get(s.publicationId);
    if (!prev || (T_RANK[s.t] ?? 0) > (T_RANK[prev.t] ?? 0)) best.set(s.publicationId, s);
  }
  return [...best.values()].map((s) => ({
    format: s.publication.video.format,
    topic: s.publication.video.idea?.card?.topic ?? s.publication.video.title,
    outlierScore: s.outlierScore ?? 0,
  }));
}
