import { getPlan, type Plan } from "@remawt/shared";
import { Prisma } from "@remawt/db";
import { prisma } from "@/lib/db/prisma";
import { PERIOD_MS, startNewPeriod } from "./period";
import { resetPeriodIfExpired } from "./entitlements";

type Tx = Prisma.TransactionClient;

/**
 * Runs `fn` once per Dodo webhook id. The WebhookEvent insert and the effect share a
 * transaction, so a retried delivery either sees the row (skip) or redoes everything.
 */
export async function onceForWebhook(webhookId: string, fn: (tx: Tx) => Promise<void>): Promise<"applied" | "duplicate"> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.webhookEvent.create({ data: { id: webhookId } });
      await fn(tx);
    });
    return "applied";
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "duplicate";
    throw e;
  }
}

const RENEWAL_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

export interface SubscriptionUpsert {
  userId: string;
  plan: Plan;
  status: string;
  billing: "monthly" | "annual";
  dodoSubId: string;
  dodoCustomerId?: string | null;
  dodoProductId?: string | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
}

/**
 * Activation / renewal / plan change.
 * - `resetPeriod: "always"`  new subscription → fresh period with the plan allowance.
 * - `resetPeriod: "renewal"` renewal → fresh period unless a lazy reset ran in the last 3 days.
 * - `resetPeriod: "never"`   plan change → only allowance changes.
 */
export async function applyPaidSubscription(
  tx: Tx,
  s: SubscriptionUpsert,
  resetPeriod: "always" | "renewal" | "never",
): Promise<void> {
  const prev = await tx.subscription.findUnique({ where: { userId: s.userId } });
  const data = {
    plan: s.plan.id,
    status: s.status,
    billing: s.billing,
    dodoSubId: s.dodoSubId,
    dodoCustomerId: s.dodoCustomerId ?? prev?.dodoCustomerId ?? null,
    dodoProductId: s.dodoProductId ?? prev?.dodoProductId ?? null,
    currentPeriodEnd: s.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: s.cancelAtPeriodEnd ?? false,
  };
  await tx.subscription.upsert({ where: { userId: s.userId }, update: data, create: { userId: s.userId, ...data } });

  const user = await tx.user.findUnique({
    where: { id: s.userId },
    select: { videoAllowance: true, videosUsed: true, rolloverVideos: true, usagePeriodStart: true },
  });
  if (!user) throw new Error(`User not found: ${s.userId}`);

  const alreadyActiveSameSub = prev?.status === "active" && prev.dodoSubId === s.dodoSubId && prev.plan === s.plan.id;
  const recentlyReset = Date.now() - user.usagePeriodStart.getTime() < RENEWAL_GRACE_MS;
  const doReset =
    resetPeriod === "always" ? !alreadyActiveSameSub : resetPeriod === "renewal" ? !recentlyReset : false;

  if (doReset) {
    // Upgrading from Free starts clean (no rollover); renewals roll over per plan rules.
    const prevPlanId = prev && prev.status === "active" ? getPlan(prev.plan).id : "FREE";
    await startNewPeriod(tx, {
      userId: s.userId,
      expectedPeriodStart: user.usagePeriodStart,
      usage: user,
      planId: prevPlanId,
      nextAllowance: s.plan.videosPerMonth,
      note: `${resetPeriod === "renewal" ? "renewal" : "activation"} (${s.plan.id} ${s.billing})`,
    });
  } else {
    await tx.user.update({ where: { id: s.userId }, data: { videoAllowance: s.plan.videosPerMonth } });
  }
}

/** Cancel / expire / fail → back to Free (3 videos). Usage in the current period is kept. */
export async function downgradeToFree(tx: Tx, userId: string, status: string, dodoSubId?: string): Promise<void> {
  const free = getPlan("FREE");
  const prev = await tx.subscription.findUnique({ where: { userId } });
  if (prev && dodoSubId && prev.dodoSubId !== dodoSubId) return; // stale event for an older sub
  if (prev) {
    await tx.subscription.update({ where: { userId }, data: { plan: free.id, status } });
  }
  await tx.user.update({ where: { id: userId }, data: { videoAllowance: free.videosPerMonth, rolloverVideos: 0 } });
}

/** One-time add-on purchase → creditBalance += credits, CreditPurchase + ledger rows. */
export async function grantAddonCredits(tx: Tx, userId: string, credits: number, dodoPaymentId: string, note: string) {
  await tx.creditPurchase.create({ data: { userId, amount: credits, dodoPurchaseId: dodoPaymentId } });
  await tx.user.update({ where: { id: userId }, data: { creditBalance: { increment: credits } } });
  await tx.usageLedger.create({ data: { userId, delta: credits, kind: "addon_credit", note } });
}

/** Runs lazy period resets for every user whose 30-day period has lapsed. */
export async function resetAllExpiredPeriods(batchSize = 200): Promise<{ scanned: number; reset: number }> {
  const cutoff = new Date(Date.now() - PERIOD_MS);
  let cursor: string | undefined;
  let scanned = 0;
  let reset = 0;
  for (;;) {
    const users = await prisma.user.findMany({
      where: { usagePeriodStart: { lte: cutoff } },
      select: { id: true },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (users.length === 0) break;
    for (const u of users) {
      scanned++;
      if (await resetPeriodIfExpired(u.id)) reset++;
    }
    cursor = users[users.length - 1].id;
    if (users.length < batchSize) break;
  }
  return { scanned, reset };
}
