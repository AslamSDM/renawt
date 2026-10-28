/**
 * Quota refunds. The web app consumes quota (UsageLedger -1, videosUsed++) before calling /v1/videos/start.
 * If the pipeline fails, the engine gives the video back here — idempotent per videoId.
 */
import { db } from "./db.js";
import { log } from "./logger.js";
import type { PlanId } from "@remawt/shared";

export async function refundVideo(videoId: string, reason: string): Promise<boolean> {
  const prisma = db();
  return prisma.$transaction(async (tx) => {
    const already = await tx.usageLedger.findFirst({ where: { videoId, kind: "refund" } });
    if (already) return false;
    const video = await tx.video.findUnique({ where: { id: videoId }, select: { channel: { select: { userId: true } } } });
    if (!video) return false;
    const userId = video.channel.userId;
    const consumed = await tx.usageLedger.findFirst({ where: { videoId, kind: { in: ["video", "rerender"] } } });
    if (!consumed) {
      log.warn("refund skipped: no consumption ledger row", { videoId });
      return false;
    }
    await tx.usageLedger.create({ data: { userId, videoId, delta: 1, kind: "refund", note: reason.slice(0, 500) } });
    if (consumed.kind === "video") {
      await tx.$executeRaw`UPDATE "User" SET "videosUsed" = GREATEST("videosUsed" - 1, 0) WHERE id = ${userId}`;
    }
    log.info("refunded video", { videoId, userId, kind: consumed.kind });
    return true;
  });
}

/** Active plan for a user (FREE when no active subscription). */
export async function planForUser(userId: string): Promise<PlanId> {
  const sub = await db().subscription.findUnique({ where: { userId } });
  if (!sub || !["active", "trialing", "on_hold"].includes(sub.status)) return "FREE";
  return (sub.plan as PlanId) ?? "FREE";
}
