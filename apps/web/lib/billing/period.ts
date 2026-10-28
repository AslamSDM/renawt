import type { Prisma } from "@remawt/db";
import { getPlan, type PlanId } from "@remawt/shared";

export const PERIOD_DAYS = 30;
export const PERIOD_MS = PERIOD_DAYS * 24 * 60 * 60 * 1000;

type Tx = Prisma.TransactionClient;

export interface UsageSnapshot {
  videoAllowance: number;
  videosUsed: number;
  rolloverVideos: number;
}

export function periodEndsAt(usagePeriodStart: Date): Date {
  return new Date(usagePeriodStart.getTime() + PERIOD_MS);
}

export function isPeriodExpired(usagePeriodStart: Date, now = new Date()): boolean {
  return now.getTime() >= usagePeriodStart.getTime() + PERIOD_MS;
}

/**
 * Rollover rule: rollover videos are consumed first and expire after one period;
 * unused videos from the *allowance* carry over once, capped at the new allowance.
 * Free plan never rolls over.
 */
export function computeRollover(u: UsageSnapshot, planId: PlanId, nextAllowance: number): number {
  if (planId === "FREE") return 0;
  const usedFromAllowance = Math.max(0, u.videosUsed - u.rolloverVideos);
  const unused = Math.max(0, u.videoAllowance - usedFromAllowance);
  return Math.max(0, Math.min(unused, nextAllowance, u.videoAllowance));
}

/**
 * Starts a new usage period for one user inside an existing transaction.
 * Uses `usagePeriodStart` as an optimistic lock so concurrent resets apply once.
 * Returns false when another writer already reset the period.
 */
export async function startNewPeriod(
  tx: Tx,
  args: {
    userId: string;
    expectedPeriodStart: Date;
    usage: UsageSnapshot;
    planId: PlanId;
    nextAllowance?: number;
    now?: Date;
    note?: string;
  },
): Promise<boolean> {
  const now = args.now ?? new Date();
  const nextAllowance = args.nextAllowance ?? args.usage.videoAllowance ?? getPlan(args.planId).videosPerMonth;
  const rollover = computeRollover(args.usage, args.planId, nextAllowance);

  const res = await tx.user.updateMany({
    where: { id: args.userId, usagePeriodStart: args.expectedPeriodStart },
    data: {
      videoAllowance: nextAllowance,
      videosUsed: 0,
      rolloverVideos: rollover,
      usagePeriodStart: now,
    },
  });
  if (res.count === 0) return false;

  const rows: Prisma.UsageLedgerCreateManyInput[] = [
    { userId: args.userId, delta: nextAllowance, kind: "reset", note: args.note ?? `period reset (${args.planId})`, createdAt: now },
  ];
  if (rollover > 0) {
    rows.push({ userId: args.userId, delta: rollover, kind: "rollover", note: "unused videos carried over", createdAt: now });
  }
  await tx.usageLedger.createMany({ data: rows });
  return true;
}
