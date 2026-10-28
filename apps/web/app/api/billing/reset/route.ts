import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { resetAllExpiredPeriods } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const key = process.env.API_KEY;
  const header = req.headers.get("authorization") ?? "";
  if (!key || !header.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Internal cron (engine): resets every user whose 30-day usage period has lapsed. */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await resetAllExpiredPeriods();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[billing/reset]", e);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
