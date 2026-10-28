import type { Channel, Idea, Video } from "@remawt/db";
import { prisma } from "@/lib/db/prisma";
import type { Viewer } from "./viewer";

export const ACTIVE_STATUSES = ["QUEUED", "TRANSCRIBING", "SCRIPTING", "VOICING", "PLANNING", "COMPOSING", "RENDERING", "QC"] as const;

export interface HomeData {
  ideas: Idea[];
  queue: Video[];
  recent: Video[];
  scheduled: number;
  published7d: number;
  avgOutlier: number | null;
}

export const EMPTY_HOME: HomeData = { ideas: [], queue: [], recent: [], scheduled: 0, published7d: 0, avgOutlier: null };

export async function loadHome(viewer: Viewer, channel: Channel | null): Promise<HomeData> {
  if (viewer.bypass || !channel) return EMPTY_HOME;
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const monthAgo = new Date(Date.now() - 30 * 86_400_000);
  const [ideas, queue, recent, scheduled, published7d, outlier] = await Promise.all([
    prisma.idea.findMany({ where: { channelId: channel.id, status: "SUGGESTED" }, orderBy: [{ score: "desc" }, { createdAt: "desc" }], take: 5 }),
    prisma.video.findMany({ where: { channelId: channel.id, status: { in: [...ACTIVE_STATUSES, "FAILED"] } }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.video.findMany({ where: { channelId: channel.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.publication.count({ where: { video: { channelId: channel.id }, status: "SCHEDULED" } }),
    prisma.publication.count({ where: { video: { channelId: channel.id }, status: "PUBLISHED", publishedAt: { gte: weekAgo } } }),
    prisma.metricSnapshot.aggregate({
      _avg: { outlierScore: true },
      where: { publication: { video: { channelId: channel.id } }, capturedAt: { gte: monthAgo }, outlierScore: { not: null } },
    }),
  ]);
  return { ideas, queue, recent, scheduled, published7d, avgOutlier: outlier._avg.outlierScore };
}
