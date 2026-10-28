import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { CheckoutConfigError, createCheckoutSession, isAddonId, isPaidPlanId } from "@/lib/dodo";

export const runtime = "nodejs";

const Body = z
  .object({
    planId: z.string().optional(),
    addonId: z.string().optional(),
    billing: z.enum(["monthly", "annual"]).default("monthly"),
    returnUrl: z.string().url().optional(),
  })
  .refine((b) => !!b.planId !== !!b.addonId, { message: "Provide exactly one of planId or addonId" });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  const { planId, addonId, billing, returnUrl } = parsed.data;

  const item = planId ?? addonId;
  if (planId && !isPaidPlanId(planId)) return NextResponse.json({ error: "Invalid planId" }, { status: 400 });
  if (addonId && !isAddonId(addonId)) return NextResponse.json({ error: "Invalid addonId" }, { status: 400 });

  // Only allow return URLs on our own origin.
  const safeReturn = returnUrl && new URL(returnUrl).origin === req.nextUrl.origin ? returnUrl : undefined;

  try {
    const checkout = await createCheckoutSession(session.user.id, item as never, billing, {
      email: session.user.email,
      name: session.user.name,
      returnUrl: safeReturn,
    });
    return NextResponse.json({ checkout_url: checkout.checkout_url, session_id: checkout.session_id });
  } catch (e) {
    if (e instanceof CheckoutConfigError) {
      console.error("[billing/checkout] config:", e.message);
      return NextResponse.json({ error: "Checkout is not configured for this product" }, { status: 503 });
    }
    console.error("[billing/checkout]", e);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
