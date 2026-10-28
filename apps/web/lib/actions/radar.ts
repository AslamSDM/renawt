"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { engine } from "@/lib/engine";
import { getViewerOrNull } from "@/lib/queries/viewer";
import { RADAR_COOLDOWN_MS, RADAR_COOLDOWN_COOKIE as COOLDOWN_COOKIE } from "@/lib/queries/radar-constants";
import { BYPASS_READONLY, NOT_SIGNED_IN, fail, ok, type ActionResult } from "./result";


/** Queues a radar refresh for the channel niche. Cooldown is per browser (cookie) to stop button mashing; the engine dedupes too. */
export async function refreshRadar(channelId: string): Promise<ActionResult<{ nextAllowedAt: string }>> {
  const viewer = await getViewerOrNull();
  if (!viewer) return fail(NOT_SIGNED_IN);
  if (viewer.bypass) return fail(BYPASS_READONLY);
  const ch = await prisma.channel.findFirst({ where: { id: channelId, userId: viewer.userId }, select: { niche: true } });
  if (!ch) return fail("Channel not found.");
  const jar = await cookies();
  const last = Number(jar.get(COOLDOWN_COOKIE)?.value ?? 0);
  if (Date.now() - last < RADAR_COOLDOWN_MS) {
    return fail(`Radar was refreshed recently. Try again after ${new Date(last + RADAR_COOLDOWN_MS).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" })}.`);
  }
  const res = await engine.radarRefresh(viewer.userId, { niches: [ch.niche], force: false });
  if (!res.ok) return fail(res.reason);
  const now = Date.now();
  jar.set(COOLDOWN_COOKIE, String(now), { path: "/", maxAge: RADAR_COOLDOWN_MS / 1000, sameSite: "lax" });
  revalidatePath("/app/radar");
  return ok({ nextAllowedAt: new Date(now + RADAR_COOLDOWN_MS).toISOString() });
}
