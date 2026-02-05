import { Webhooks } from "@dodopayments/nextjs";
import { upsertUserSubscription } from "@/lib/db";
import { NextResponse } from "next/server";

const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_SIGNING_KEY;

export const POST = webhookKey
  ? Webhooks({
      webhookKey,
  onSubscriptionActive: async (payload) => {
    console.log("Subscription active:");
    await upsertUserSubscription(
      payload.data.metadata!.userId,
      payload.data.metadata!.subscription,
      payload.data.status,
      payload.data.subscription_id
    );
  },
  onSubscriptionRenewed: async (payload) => {
    console.log("Subscription renewed:");
    await upsertUserSubscription(
      payload.data.metadata!.userId,
      payload.data.metadata!.subscription,
      payload.data.status,
      payload.data.subscription_id
    );
  },
  onSubscriptionCancelled: async (payload) => {
    console.log("Subscription cancelled:");
    await upsertUserSubscription(
      payload.data.metadata!.userId,
      payload.data.metadata!.subscription,
      payload.data.status,
      payload.data.subscription_id
    );
  },
})
  : () => NextResponse.json({ error: "Webhook not configured" }, { status: 503 });