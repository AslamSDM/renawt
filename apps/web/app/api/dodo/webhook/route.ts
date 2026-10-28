import { Webhooks } from "@dodopayments/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { getPlan } from "@remawt/shared";
import { prisma } from "@/lib/db/prisma";
import { sendSubscriptionEmail } from "@/lib/email";
import { isAddonId, isPaidPlanId, resolveProduct, getAddon, type Billing, type CheckoutMetadata } from "@/lib/dodo";
import {
  applyPaidSubscription,
  downgradeToFree,
  grantAddonCredits,
  onceForWebhook,
} from "@/lib/billing";

export const runtime = "nodejs";

const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_SIGNING_KEY;

type SubData = {
  subscription_id: string;
  product_id: string;
  status: string;
  metadata: Record<string, unknown>;
  next_billing_date?: Date | string | null;
  cancel_at_next_billing_date?: boolean;
  payment_frequency_interval?: string;
  customer?: { customer_id?: string | null } | null;
};

function meta(m: Record<string, unknown> | null | undefined): Partial<CheckoutMetadata> {
  return (m ?? {}) as Partial<CheckoutMetadata>;
}

/** Plan + billing for a subscription event: product id first (authoritative), metadata fallback. */
function resolveSubscriptionPlan(d: SubData) {
  const byProduct = resolveProduct(d.product_id);
  if (byProduct?.kind === "plan") return { plan: byProduct.plan, billing: byProduct.billing };
  const m = meta(d.metadata);
  if (isPaidPlanId(m.planId)) {
    const billing: Billing = m.billing === "annual" || d.payment_frequency_interval === "Year" ? "annual" : "monthly";
    return { plan: getPlan(m.planId), billing };
  }
  return null;
}

async function resolveUserId(d: SubData): Promise<string | null> {
  const m = meta(d.metadata);
  if (typeof m.userId === "string" && m.userId) return m.userId;
  const sub = await prisma.subscription.findFirst({ where: { dodoSubId: d.subscription_id }, select: { userId: true } });
  return sub?.userId ?? null;
}

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function handlePaidSubscription(webhookId: string, d: SubData, mode: "always" | "renewal" | "never") {
  const userId = await resolveUserId(d);
  const resolved = resolveSubscriptionPlan(d);
  if (!userId || !resolved) {
    console.error("[dodo] subscription event unresolved", { sub: d.subscription_id, product: d.product_id, userId });
    return;
  }
  const result = await onceForWebhook(webhookId, (tx) =>
    applyPaidSubscription(
      tx,
      {
        userId,
        plan: resolved.plan,
        billing: resolved.billing,
        status: d.status,
        dodoSubId: d.subscription_id,
        dodoCustomerId: d.customer?.customer_id ?? null,
        dodoProductId: d.product_id,
        currentPeriodEnd: toDate(d.next_billing_date),
        cancelAtPeriodEnd: d.cancel_at_next_billing_date ?? false,
      },
      mode,
    ),
  );
  console.log("[dodo] subscription", mode, result, { userId, plan: resolved.plan.id, sub: d.subscription_id });

  if (result === "applied" && mode === "always") {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (user?.email) await sendSubscriptionEmail(user.email, user.name, resolved.plan.name).catch(() => {});
  }
}

async function handleEnded(webhookId: string, d: SubData) {
  const userId = await resolveUserId(d);
  if (!userId) {
    console.error("[dodo] end-of-subscription event without user", { sub: d.subscription_id });
    return;
  }
  const result = await onceForWebhook(webhookId, (tx) => downgradeToFree(tx, userId, d.status, d.subscription_id));
  console.log("[dodo] subscription ended", result, { userId, status: d.status, sub: d.subscription_id });
}

export const POST = async (req: NextRequest) => {
  const webhookId = req.headers.get("webhook-id");
  if (!webhookId) return NextResponse.json({ error: "Missing webhook-id" }, { status: 400 });
  if (!webhookKey) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });

  // Signature verification is done by Webhooks() (standard-webhooks, DODO_PAYMENTS_WEBHOOK_SIGNING_KEY).
  return Webhooks({
    webhookKey,
    onSubscriptionActive: async (p) => handlePaidSubscription(webhookId, p.data as unknown as SubData, "always"),
    onSubscriptionRenewed: async (p) => handlePaidSubscription(webhookId, p.data as unknown as SubData, "renewal"),
    onSubscriptionPlanChanged: async (p) => handlePaidSubscription(webhookId, p.data as unknown as SubData, "never"),
    onSubscriptionOnHold: async (p) => {
      const d = p.data as unknown as SubData;
      await onceForWebhook(webhookId, async (tx) => {
        await tx.subscription.updateMany({ where: { dodoSubId: d.subscription_id }, data: { status: d.status } });
      });
    },
    onSubscriptionUpdated: async (p) => {
      // Keep status/period/cancel flag in sync; quota changes come from active/renewed/plan_changed.
      const d = p.data as unknown as SubData;
      await onceForWebhook(webhookId, async (tx) => {
        await tx.subscription.updateMany({
          where: { dodoSubId: d.subscription_id },
          data: {
            currentPeriodEnd: toDate(d.next_billing_date),
            cancelAtPeriodEnd: d.cancel_at_next_billing_date ?? false,
          },
        });
      });
    },
    onSubscriptionCancelled: async (p) => handleEnded(webhookId, p.data as unknown as SubData),
    onSubscriptionExpired: async (p) => handleEnded(webhookId, p.data as unknown as SubData),
    onSubscriptionFailed: async (p) => handleEnded(webhookId, p.data as unknown as SubData),
    onPaymentSucceeded: async (p) => {
      const d = p.data;
      if (d.subscription_id) return; // subscription payments are handled by subscription.* events
      const m = meta(d.metadata as Record<string, unknown>);
      const productId = d.product_cart?.[0]?.product_id;
      const byProduct = resolveProduct(productId);
      const addon = byProduct?.kind === "addon" ? byProduct.addon : isAddonId(m.addonId) ? getAddon(m.addonId) : null;
      if (!addon || typeof m.userId !== "string" || !m.userId) {
        console.error("[dodo] payment.succeeded not an addon purchase", { payment: d.payment_id, productId });
        return;
      }
      const qty = Math.max(1, Math.min(100, d.product_cart?.[0]?.quantity ?? 1));
      const credits = addon.credits * qty;
      const userId = m.userId;
      const result = await onceForWebhook(webhookId, (tx) =>
        grantAddonCredits(tx, userId, credits, d.payment_id, `addon ${addon.id} x${qty}`),
      );
      console.log("[dodo] addon purchase", result, { userId, addon: addon.id, credits });
    },
  })(req);
};
