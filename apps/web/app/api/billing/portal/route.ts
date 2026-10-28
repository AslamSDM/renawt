import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { createPortalLink } from "@/lib/dodo";

export const runtime = "nodejs";

/** POST (or GET) → { url } for the Dodo customer portal. */
async function handler(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { dodoCustomerId: true },
  });
  if (!sub?.dodoCustomerId) {
    return NextResponse.json({ error: "No billing account yet. Subscribe to a plan first." }, { status: 404 });
  }
  try {
    const url = await createPortalLink(sub.dodoCustomerId, `${req.nextUrl.origin}/app/billing`);
    return NextResponse.json({ url });
  } catch (e) {
    console.error("[billing/portal]", e);
    return NextResponse.json({ error: "Failed to open billing portal" }, { status: 502 });
  }
}

export const GET = handler;
export const POST = handler;
