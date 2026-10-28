"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { engine } from "@/lib/engine";
import { getViewerOrNull } from "@/lib/queries/viewer";
import { BYPASS_READONLY, NOT_SIGNED_IN, fail, ok, type ActionResult } from "./result";

const ConnectInput = z.object({ channelId: z.string(), platform: z.enum(["TIKTOK", "YOUTUBE", "INSTAGRAM", "FACEBOOK", "THREADS", "LINKEDIN", "X", "PINTEREST"]) });

export async function connectSocial(input: z.input<typeof ConnectInput>): Promise<ActionResult<{ url: string }>> {
  const viewer = await getViewerOrNull();
  if (!viewer) return fail(NOT_SIGNED_IN);
  if (viewer.bypass) return fail(BYPASS_READONLY);
  const parsed = ConnectInput.safeParse(input);
  if (!parsed.success) return fail("Unknown platform.");
  const owned = await prisma.channel.count({ where: { id: parsed.data.channelId, userId: viewer.userId } });
  if (!owned) return fail("Channel not found.");
  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const returnUrl = `${origin}/app/channels/${parsed.data.channelId}/settings?tab=accounts&connected=${parsed.data.platform}`;
  const res = await engine.socialConnect(viewer.userId, { ...parsed.data, returnUrl });
  if (!res.ok) return fail(res.reason);
  return ok({ url: res.data.url });
}

export async function syncSocial(channelId: string): Promise<ActionResult> {
  const viewer = await getViewerOrNull();
  if (!viewer) return fail(NOT_SIGNED_IN);
  if (viewer.bypass) return fail(BYPASS_READONLY);
  const owned = await prisma.channel.count({ where: { id: channelId, userId: viewer.userId } });
  if (!owned) return fail("Channel not found.");
  const res = await engine.socialSync(viewer.userId, { channelId });
  if (!res.ok) return fail(res.reason);
  revalidatePath(`/app/channels/${channelId}/settings`);
  return ok(undefined);
}

export async function disconnectSocial(socialAccountId: string): Promise<ActionResult> {
  const viewer = await getViewerOrNull();
  if (!viewer) return fail(NOT_SIGNED_IN);
  if (viewer.bypass) return fail(BYPASS_READONLY);
  const acc = await prisma.socialAccount.findFirst({ where: { id: socialAccountId, channel: { userId: viewer.userId } } });
  if (!acc) return fail("Account not found.");
  const pending = await prisma.publication.count({ where: { socialAccountId, status: "SCHEDULED" } });
  if (pending > 0) return fail(`Cancel the ${pending} scheduled post${pending === 1 ? "" : "s"} for this account first.`);
  await prisma.socialAccount.update({ where: { id: socialAccountId }, data: { status: "revoked" } });
  revalidatePath(`/app/channels/${acc.channelId}/settings`);
  return ok(undefined);
}
