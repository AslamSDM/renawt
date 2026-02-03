import { Webhooks } from "@dodopayments/nextjs";
import { NextRequest } from "next/server";

export const POST = async (req: NextRequest) => {
  const headers = Object.fromEntries(req.headers.entries());
  const webhookId = headers["webhook-id"];

  if (!webhookId) return new Response("Missing webhook-id", { status: 400 });

  return Webhooks({
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_SIGNING_KEY!,
    onPayload: async (payload) => {

      console.log(payload);
      if (payload.type === "payment.succeeded") {
        const productId = payload.data.product_cart?.[0]?.product_id;
        const userId = payload.data.metadata?.userId;
        const paymentId = payload.data.payment_id;
        const paperId = payload.data.metadata?.paperId;

        console.log("Payment succeeded:", {
          productId,
          userId,
          paymentId,
          paperId,
        });
      }
    },
  })(req);
}