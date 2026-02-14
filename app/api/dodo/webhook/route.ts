// import { updateUserSubscription } from "@/lib/db";
import { addCredits, updateUserSubscription } from "@/lib/db";
import { Metadata } from "@/lib/dodo";
import { productToCreditMap } from "@/lib/dodo/subscription";
import { Webhooks } from "@dodopayments/nextjs";
import { NextRequest, NextResponse } from "next/server";

const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_SIGNING_KEY;


export const POST = async (req: NextRequest) => {
  const webhookEventId = req.headers.get("webhook-id");

  if (!webhookEventId) return NextResponse.json({ error: "Missing webhook-id" }, { status: 400 })

  return webhookKey ?
    Webhooks({
      webhookKey,
      onPaymentSucceeded: async (payload) => {
        const { userId, product, quantity } = payload.data.metadata as Metadata;
        const creditsToAdd = productToCreditMap[product] * parseInt(quantity);
        const { payment_id } = payload.data;

        console.log(userId, product, quantity, creditsToAdd);

        await addCredits(webhookEventId, userId, creditsToAdd, payment_id);
        console.log("[+] Payment succeeded");
      },
      onSubscriptionUpdated: async (payload) => {
        console.log("[+] Subscription renewed");
        const { userId, product } = payload.data.metadata as Metadata;
        const { status, subscription_id } = payload.data;

        console.log(userId, product, status, subscription_id);

        await updateUserSubscription(
          userId,
          product,
          status,
          subscription_id
        );
      },
    })(req)
    : NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
}