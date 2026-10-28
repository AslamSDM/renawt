import { prisma } from "@/lib/db/prisma";
import type { Viewer } from "./viewer";

const T_ORDER = ["1h", "6h", "24h", "72h", "7d"];

export interface AnalyticsRow {
  publicationId: string;
  videoId: string;
  title: string;
  format: string;
  platform: string;
  publishedAt: Date | null;
  url: string | null;
  views: number;
  likes: number;
  shares: number;
  saves: number;
  outlier: number | null;
  series: number[];
  latestT: string | null;
}

export interface AnalyticsData {
  rows: AnalyticsRow[];
  totals: { views: number; posts: number; avgOutlier: number | null; saves: number };
  formats: { format: string; avgOutlier: number; posts: number; views: number }[];
  hooks: { hook: string; videoId: string; outlier: number; format: string }[];
}

export const EMPTY_ANALYTICS: AnalyticsData = { rows: [], totals: { views: 0, posts: 0, avgOutlier: null, saves: 0 }, formats: [], hooks: [] };

export async function loadAnalytics(viewer: Viewer, channelId: string, days = 30): Promise<AnalyticsData> {
  if (viewer.bypass) return EMPTY_ANALYTICS;
  const since = new Date(Date.now() - days * 86_400_000);
  const pubs = await prisma.publication.findMany({
    where: { video: { channelId }, status: "PUBLISHED", publishedAt: { gte: since } },
    orderBy: { publishedAt: "desc" },
    take: 200,
    include: {
      metrics: true,
      video: { select: { id: true, title: true, format: true, idea: { select: { hook: true } } } },
    },
  });

  const rows: AnalyticsRow[] = pubs.map((p) => {
    const snaps = [...p.metrics].sort((a, b) => T_ORDER.indexOf(a.t) - T_ORDER.indexOf(b.t));
    const last = snaps[snaps.length - 1];
    return {
      publicationId: p.id,
      videoId: p.video.id,
      title: p.video.title,
      format: p.video.format,
      platform: p.platform,
      publishedAt: p.publishedAt,
      url: p.externalUrl,
      views: last?.views ?? 0,
      likes: last?.likes ?? 0,
      shares: last?.shares ?? 0,
      saves: last?.saves ?? 0,
      outlier: last?.outlierScore ?? null,
      series: snaps.map((s) => s.views),
      latestT: last?.t ?? null,
    };
  });

  const scored = rows.filter((r) => r.outlier != null);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  const byFormat = new Map<string, AnalyticsRow[]>();
  for (const r of scored) byFormat.set(r.format, [...(byFormat.get(r.format) ?? []), r]);
  const formats = [...byFormat.entries()]
    .map(([format, rs]) => ({ format, avgOutlier: avg(rs.map((r) => r.outlier as number)) ?? 0, posts: rs.length, views: rs.reduce((n, r) => n + r.views, 0) }))
    .sort((a, b) => b.avgOutlier - a.avgOutlier);

  const bestPerVideo = new Map<string, { hook: string; videoId: string; outlier: number; format: string }>();
  for (const p of pubs) {
    const r = rows.find((x) => x.publicationId === p.id);
    if (!r || r.outlier == null) continue;
    const hook = p.video.idea?.hook ?? p.video.title;
    const prev = bestPerVideo.get(p.video.id);
    if (!prev || r.outlier > prev.outlier) bestPerVideo.set(p.video.id, { hook, videoId: p.video.id, outlier: r.outlier, format: p.video.format });
  }
  const hooks = [...bestPerVideo.values()].sort((a, b) => b.outlier - a.outlier).slice(0, 5);

  return {
    rows,
    totals: { views: rows.reduce((n, r) => n + r.views, 0), posts: rows.length, avgOutlier: avg(scored.map((r) => r.outlier as number)), saves: rows.reduce((n, r) => n + r.saves, 0) },
    formats,
    hooks,
  };
}
