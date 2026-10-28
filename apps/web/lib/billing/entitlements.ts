import { getPlan, type Plan } from "@remawt/shared";
import { prisma } from "@/lib/db/prisma";
import { isPeriodExpired, periodEndsAt, startNewPeriod } from "./period";

export interface Entitlements {
  plan: Plan;
  videosRemaining: number;
  videosUsed: number;
  allowance: number;
  rollover: number;
  channelsAllowed: number;
  channelsUsed: number;
  creditBalance: number;
  periodEndsAt: Date;
  canPublish: boolean;
  canClone: boolean;
  quality: Plan["quality"];
}

/** Subscription statuses that keep the paid plan active. */
const ACTIVE_STATUSES = new Set(["active", "on_hold"]);

export function planFromSubscription(sub: { plan: string; status: string } | null | undefined): Plan {
  if (!sub || !ACTIVE_STATUSES.has(sub.status.toLowerCase())) return getPlan("FREE");
  return getPlan(sub.plan.toUpperCase());
}

/**
 * Lazily resets the user's usage period if 30 days have passed.
 * Returns true if a reset was applied.
 */
export async function resetPeriodIfExpired(userId: string, now = new Date()): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      videoAllowance: true,
      videosUsed: true,
      rolloverVideos: true,
      usagePeriodStart: true,
      subscription: { select: { plan: true, status: true } },
    },
  });
  if (!user || !isPeriodExpired(user.usagePeriodStart, now)) return false;
  const plan = planFromSubscription(user.subscription);
  return prisma.$transaction((tx) =>
    startNewPeriod(tx, {
      userId,
      expectedPeriodStart: user.usagePeriodStart,
      usage: user,
      planId: plan.id,
      nextAllowance: plan.videosPerMonth,
      now,
    }),
  );
}

export async function getEntitlements(userId: string): Promise<Entitlements> {
  await resetPeriodIfExpired(userId);

  const [user, channelsUsed] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        creditBalance: true,
        videoAllowance: true,
        videosUsed: true,
        rolloverVideos: true,
        usagePeriodStart: true,
        subscription: { select: { plan: true, status: true } },
      },
    }),
    prisma.channel.count({ where: { userId } }),
  ]);
  if (!user) throw new Error(`User not found: ${userId}`);

  const plan = planFromSubscription(user.subscription);
  const total = user.videoAllowance + user.rolloverVideos;

  return {
    plan,
    videosRemaining: Math.max(0, total - user.videosUsed),
    videosUsed: user.videosUsed,
    allowance: user.videoAllowance,
    rollover: user.rolloverVideos,
    channelsAllowed: plan.channels,
    channelsUsed,
    creditBalance: user.creditBalance,
    periodEndsAt: periodEndsAt(user.usagePeriodStart),
    canPublish: plan.platforms !== 0,
    canClone: plan.voiceClone,
    quality: plan.quality,
  };
}
