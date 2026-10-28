import { addCredits, updateUserSubscription } from "@/lib/db";
import { prisma } from "@/lib/db/prisma";
import { sendSubscriptionEmail } from "@/lib/email";
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

        // Validate metadata fields
        if (!userId || !product || !quantity) {
          console.error("[Webhook] Missing required metadata fields");
          return;
        }

        const creditRate = productToCreditMap[product];
        if (creditRate === undefined) {
          console.error(`[Webhook] Unknown product: ${product}`);
          return;
        }

        const parsedQuantity = parseInt(quantity);
        if (isNaN(parsedQuantity) || parsedQuantity <= 0 || parsedQuantity > 100) {
          console.error(`[Webhook] Invalid quantity: ${quantity}`);
          return;
        }

        const creditsToAdd = creditRate * parsedQuantity;
        const { payment_id } = payload.data;

        console.log("[+] Payment succeeded:", { userId, product, quantity: parsedQuantity, creditsToAdd });

        await addCredits(webhookEventId, userId, creditsToAdd, payment_id);
      },
      onSubscriptionUpdated: async (payload) => {
        const { userId, product } = payload.data.metadata as Metadata;
        const { status, subscription_id } = payload.data;

        console.log("[+] Subscription updated:", { userId, product, status, subscription_id });

        await updateUserSubscription(
          userId,
          product,
          status,
          subscription_id
        );

        // Add credits for active subscriptions
        if (status === "active") {
          const credits = productToCreditMap[product];
          if (credits !== undefined) {
            await addCredits(webhookEventId, userId, credits, subscription_id);
            console.log("[+] Subscription credits added:", { userId, product, credits });
          }
        }

        // Send subscription confirmation email
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true },
        });
        if (user?.email) {
          await sendSubscriptionEmail(user.email, user.name, product);
        }
      },
      onSubscriptionRenewed: async (payload) => {
        const { userId, product } = payload.data.metadata as Metadata;
        const { subscription_id, status } = payload.data;

        if (!userId || !product) {
          console.error("[Webhook] subscription.renewed missing metadata", { subscription_id });
          return;
        }

        const credits = productToCreditMap[product];
        if (credits === undefined) {
          console.error(`[Webhook] subscription.renewed unknown product: ${product}`);
          return;
        }

        console.log("[+] Subscription renewed:", { userId, product, status, subscription_id, credits });

        await updateUserSubscription(userId, product, status, subscription_id);
        await addCredits(webhookEventId, userId, credits, subscription_id);
        console.log("[+] Renewal credits added:", { userId, product, credits });
      },
    })(req)
    : NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
}