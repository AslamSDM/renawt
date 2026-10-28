import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession } from '@/lib/dodo';
import { auth } from "@/auth";
import { productToCreditMap } from "@/lib/dodo/subscription";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const { product, quantity, billing = "monthly" } = await request.json();

    if (!product || !quantity) {
      return NextResponse.json({ error: 'Missing product or quantity' }, { status: 400 });
    }

    // Validate product exists
    if (productToCreditMap[product] === undefined) {
      return NextResponse.json({ error: 'Invalid product' }, { status: 400 });
    }

    // Validate quantity
    const parsedQuantity = parseInt(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0 || parsedQuantity > 100) {
      return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 });
    }

    // Use authenticated user's ID, not client-supplied userId
    const checkoutSession = await createCheckoutSession(session.user.id, product, parsedQuantity, billing);

    return NextResponse.json({ checkout_url: checkoutSession.checkout_url });
  } catch (error) {
    console.error("[Checkout] Error:", error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}