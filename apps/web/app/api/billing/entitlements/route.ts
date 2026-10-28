import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getEntitlements } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    const ent = await getEntitlements(session.user.id);
    return NextResponse.json({ ...ent, periodEndsAt: ent.periodEndsAt.toISOString() });
  } catch (e) {
    console.error("[billing/entitlements]", e);
    return NextResponse.json({ error: "Failed to load entitlements" }, { status: 500 });
  }
}
