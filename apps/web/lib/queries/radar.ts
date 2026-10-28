import { cookies } from "next/headers";
import type { TrendCard } from "@remawt/db";
import { prisma } from "@/lib/db/prisma";
import { RADAR_COOLDOWN_COOKIE, RADAR_COOLDOWN_MS } from "./radar-constants";
import { shiftWeek } from "./format";
import type { Viewer } from "./viewer";

export interface FormatTrend {
  format: string;
  share: number;
  prevShare: number;
  delta: number;
  count: number;
}

export interface RadarData {
  cards: TrendCard[];
  ideaCounts: Record<string, number>;
  formatTrends: FormatTrend[];
  nextRefreshAt: string | null;
}

export async function loadRadar(viewer: Viewer, channelId: string, niche: string, week: string): Promise<RadarData> {
  const last = Number((await cookies()).get(RADAR_COOLDOWN_COOKIE)?.value ?? 0);
  const nextRefreshAt = last && Date.now() - last < RADAR_COOLDOWN_MS ? new Date(last + RADAR_COOLDOWN_MS).toISOString() : null;
  if (viewer.bypass) return { cards: [], ideaCounts: {}, formatTrends: [], nextRefreshAt };

  const prev = shiftWeek(week, -1);
  const [cards, prevCards] = await Promise.all([
    prisma.trendCard.findMany({ where: { niche, weekKey: week }, orderBy: { score: "desc" }, take: 30 }),
    prisma.trendCard.findMany({ where: { niche, weekKey: prev }, select: { format: true } }),
  ]);
  const ideas = cards.length
    ? await prisma.idea.groupBy({ by: ["cardId"], where: { channelId, cardId: { in: cards.map((c) => c.id) } }, _count: { _all: true } })
    : [];
  const ideaCounts = Object.fromEntries(ideas.flatMap((g) => (g.cardId ? [[g.cardId, g._count._all]] : [])));

  const tally = (list: { format: string }[]) => {
    const m = new Map<string, number>();
    for (const c of list) m.set(c.format, (m.get(c.format) ?? 0) + 1);
    return m;
  };
  const now = tally(cards);
  const before = tally(prevCards);
  const formats = new Set([...now.keys(), ...before.keys()]);
  const formatTrends = [...formats]
    .map((format) => {
      const share = cards.length ? (now.get(format) ?? 0) / cards.length : 0;
      const prevShare = prevCards.length ? (before.get(format) ?? 0) / prevCards.length : 0;
      return { format, share, prevShare, delta: share - prevShare, count: now.get(format) ?? 0 };
    })
    .sort((a, b) => b.share - a.share);

  return { cards, ideaCounts, formatTrends, nextRefreshAt };
}
