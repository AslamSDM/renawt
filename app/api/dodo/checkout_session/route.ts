import { NextRequest } from "next/server";
import { createCheckoutSession } from '@/lib/dodo';

// const requestExample = {
//   userId: "12345"
//   product: "SUBSCRIPTION_STARTER",
//   quantity: 1
// }

export async function POST(request: NextRequest) {
  try {
    const { userId, product, quantity } = await request.json();

    if (!product || !userId || !quantity) {
      return new Response(JSON.stringify({ error: 'Missing subscription or userId' }), { status: 400 });
    }

    const session = await createCheckoutSession(userId, product, quantity);

    return new Response(JSON.stringify({ checkout_url: session.checkout_url }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to create checkout session' }), { status: 500 });
  }
}