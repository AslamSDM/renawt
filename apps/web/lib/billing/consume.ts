import { getPlan, type Plan, type PlanId } from "@remawt/shared";
import type { UsageLedger } from "@remawt/db";
import { prisma } from "@/lib/db/prisma";
import { resetPeriodIfExpired } from "./entitlements";

export type ConsumeResult =
  | { ok: true; ledger: UsageLedger; alreadyConsumed?: boolean }
  | { ok: false; reason: "QUOTA_EXCEEDED" | "USER_NOT_FOUND" };

/**
 * Atomically consumes one video from the user's quota (allowance + rollover).
 * Idempotent per videoId: a second call for the same video returns the original ledger row.
 */
export async function consumeVideo(userId: string, videoId: string): Promise<ConsumeResult> {
  await resetPeriodIfExpired(userId);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.usageLedger.findFirst({
      where: { userId, videoId, kind: { in: ["video", "refund"] } },
      orderBy: { createdAt: "desc" },
    });
    if (existing?.kind === "video") return { ok: true as const, ledger: existing, alreadyConsumed: true };

    const updated = await tx.$executeRaw`
      UPDATE "User" SET "videosUsed" = "videosUsed" + 1
      WHERE "id" = ${userId} AND "videosUsed" < "videoAllowance" + "rolloverVideos"`;
    if (updated === 0) {
      const exists = await tx.user.count({ where: { id: userId } });
      return { ok: false as const, reason: exists ? ("QUOTA_EXCEEDED" as const) : ("USER_NOT_FOUND" as const) };
    }
    const ledger = await tx.usageLedger.create({
      data: { userId, videoId, delta: -1, kind: "video", note: "video produced" },
    });
    return { ok: true as const, ledger };
  });
}

/**
 * Returns a video to the quota after a failed run. Idempotent: only refunds when the
 * latest ledger row for this video is a `video` consumption.
 */
export async function refundVideo(userId: string, videoId: string, note = "failed run"): Promise<{ ok: boolean; ledger?: UsageLedger }> {
  return prisma.$transaction(async (tx) => {
    const last = await tx.usageLedger.findFirst({
      where: { userId, videoId, kind: { in: ["video", "refund"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!last || last.kind !== "video") return { ok: false };
    await tx.$executeRaw`
      UPDATE "User" SET "videosUsed" = GREATEST("videosUsed" - 1, 0) WHERE "id" = ${userId}`;
    const ledger = await tx.usageLedger.create({
      data: { userId, videoId, delta: 1, kind: "refund", note },
    });
    return { ok: true, ledger };
  });
}

/** Spends add-on credits (AI video clips, custom music). Fails without partial spend. */
export async function consumeAddonCredits(
  userId: string,
  n: number,
  reason: string,
  videoId?: string,
): Promise<{ ok: boolean; balance?: number; ledger?: UsageLedger }> {
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Invalid credit amount: ${n}`);
  return prisma.$transaction(async (tx) => {
    const res = await tx.user.updateMany({
      where: { id: userId, creditBalance: { gte: n } },
      data: { creditBalance: { decrement: n } },
    });
    if (res.count === 0) return { ok: false };
    const [user, ledger] = await Promise.all([
      tx.user.findUniqueOrThrow({ where: { id: userId }, select: { creditBalance: true } }),
      tx.usageLedger.create({ data: { userId, videoId, delta: -n, kind: "addon_credit", note: reason } }),
    ]);
    return { ok: true, balance: user.creditBalance, ledger };
  });
}

/** Free re-renders per video are capped by plan (`rerendersPerVideo`). */
export function canRerender(video: { rerenders: number }, plan: Plan | PlanId): boolean {
  const p = typeof plan === "string" ? getPlan(plan) : plan;
  return video.rerenders < p.rerendersPerVideo;
}
