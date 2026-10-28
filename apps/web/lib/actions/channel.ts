"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { IdentityKitSchema, NICHES, type IdentityKit } from "@remawt/shared";
import type { Prisma } from "@remawt/db";
import { prisma } from "@/lib/db/prisma";
import { getEntitlements } from "@/lib/billing";
import { CHANNEL_COOKIE } from "@/lib/queries/channels";
import { getViewerOrNull } from "@/lib/queries/viewer";
import { BYPASS_READONLY, NOT_SIGNED_IN, fail, ok, zodFieldErrors, type ActionResult } from "./result";

const NICHE_SLUGS = new Set(NICHES.map((n) => n.slug));

const CreateChannelInput = z.object({
  name: z.string().trim().min(2, "Give the channel a name (2+ characters).").max(60),
  handle: z.string().trim().max(40).optional(),
  niche: z.string().refine((s) => NICHE_SLUGS.has(s), "Pick a niche."),
  timezone: z.string().max(64).default("UTC"),
  kit: IdentityKitSchema,
});

function kitJson(kit: IdentityKit): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(kit)) as Prisma.InputJsonValue;
}

async function setActiveCookie(id: string) {
  (await cookies()).set(CHANNEL_COOKIE, id, { path: "/", httpOnly: false, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
}

export async function createChannel(input: z.input<typeof CreateChannelInput>): Promise<ActionResult<{ channelId: string }>> {
  const viewer = await getViewerOrNull();
  if (!viewer) return fail(NOT_SIGNED_IN);
  if (viewer.bypass) return fail(BYPASS_READONLY);

  const parsed = CreateChannelInput.safeParse(input);
  if (!parsed.success) return fail("Some kit fields need attention.", zodFieldErrors(parsed.error));

  const ent = await getEntitlements(viewer.userId);
  if (ent.channelsUsed >= ent.channelsAllowed) {
    return fail(`Your ${ent.plan.name} plan includes ${ent.channelsAllowed} channel${ent.channelsAllowed === 1 ? "" : "s"}. Upgrade to add another.`);
  }

  const { name, handle, niche, timezone, kit } = parsed.data;
  const channel = await prisma.channel.create({
    data: { userId: viewer.userId, name, handle: handle || null, niche, timezone, kit: kitJson(kit), status: "ACTIVE" },
  });
  await prisma.user.updateMany({ where: { id: viewer.userId, onboardedAt: null }, data: { onboardedAt: new Date() } });
  await setActiveCookie(channel.id);
  revalidatePath("/app", "layout");
  return ok({ channelId: channel.id });
}

export async function setActiveChannel(channelId: string): Promise<ActionResult> {
  const viewer = await getViewerOrNull();
  if (!viewer) return fail(NOT_SIGNED_IN);
  if (!viewer.bypass) {
    const owned = await prisma.channel.count({ where: { id: channelId, userId: viewer.userId } });
    if (!owned) return fail("Channel not found.");
  }
  await setActiveCookie(channelId);
  revalidatePath("/app", "layout");
  return ok(undefined);
}

const UpdateChannelInput = z.object({
  channelId: z.string(),
  name: z.string().trim().min(2).max(60).optional(),
  handle: z.string().trim().max(40).nullable().optional(),
  niche: z.string().refine((s) => NICHE_SLUGS.has(s), "Pick a niche.").optional(),
  timezone: z.string().max(64).optional(),
  kit: IdentityKitSchema.optional(),
});

export async function updateChannel(input: z.input<typeof UpdateChannelInput>): Promise<ActionResult> {
  const viewer = await getViewerOrNull();
  if (!viewer) return fail(NOT_SIGNED_IN);
  if (viewer.bypass) return fail(BYPASS_READONLY);
  const parsed = UpdateChannelInput.safeParse(input);
  if (!parsed.success) return fail("Some fields need attention.", zodFieldErrors(parsed.error));
  const { channelId, kit, ...rest } = parsed.data;
  const res = await prisma.channel.updateMany({
    where: { id: channelId, userId: viewer.userId },
    data: { ...rest, ...(kit ? { kit: kitJson(kit) } : {}) },
  });
  if (res.count === 0) return fail("Channel not found.");
  revalidatePath("/app", "layout");
  return ok(undefined);
}

export async function setChannelStatus(channelId: string, status: "ACTIVE" | "PAUSED"): Promise<ActionResult> {
  const viewer = await getViewerOrNull();
  if (!viewer) return fail(NOT_SIGNED_IN);
  if (viewer.bypass) return fail(BYPASS_READONLY);
  const res = await prisma.channel.updateMany({ where: { id: channelId, userId: viewer.userId }, data: { status } });
  if (res.count === 0) return fail("Channel not found.");
  if (status === "PAUSED") await prisma.series.updateMany({ where: { channelId }, data: { active: false } });
  revalidatePath("/app", "layout");
  return ok(undefined);
}

export async function deleteChannel(channelId: string, confirmName: string): Promise<ActionResult> {
  const viewer = await getViewerOrNull();
  if (!viewer) return fail(NOT_SIGNED_IN);
  if (viewer.bypass) return fail(BYPASS_READONLY);
  const ch = await prisma.channel.findFirst({ where: { id: channelId, userId: viewer.userId }, select: { name: true } });
  if (!ch) return fail("Channel not found.");
  if (ch.name !== confirmName.trim()) return fail("Type the channel name exactly to confirm.");
  // relationMode = "prisma": cascade children explicitly.
  await prisma.$transaction(async (tx) => {
    const videos = await tx.video.findMany({ where: { channelId }, select: { id: true } });
    const videoIds = videos.map((v) => v.id);
    const pubs = await tx.publication.findMany({ where: { videoId: { in: videoIds } }, select: { id: true } });
    await tx.metricSnapshot.deleteMany({ where: { publicationId: { in: pubs.map((p) => p.id) } } });
    await tx.publication.deleteMany({ where: { videoId: { in: videoIds } } });
    await tx.video.deleteMany({ where: { channelId } });
    await tx.idea.deleteMany({ where: { channelId } });
    await tx.series.deleteMany({ where: { channelId } });
    await tx.socialAccount.deleteMany({ where: { channelId } });
    await tx.channel.delete({ where: { id: channelId } });
  });
  const jar = await cookies();
  if (jar.get(CHANNEL_COOKIE)?.value === channelId) jar.delete(CHANNEL_COOKIE);
  revalidatePath("/app", "layout");
  return ok(undefined);
}
