"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getEntitlements } from "@/lib/billing";
import { engine } from "@/lib/engine";
import { getViewerOrNull } from "@/lib/queries/viewer";
import { BYPASS_READONLY, NOT_SIGNED_IN, fail, ok, type ActionResult } from "./result";

const TikTokPrivacy = z.enum(["public", "friends", "followers", "private"]);

const TargetInput = z
  .object({
    socialAccountId: z.string(),
    scheduledAt: z.string().datetime({ offset: true }),
    title: z.string().trim().max(100).optional(),
    caption: z.string().trim().max(5000).default(""),
    hashtags: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
    aiLabel: z.boolean(),
    madeForKids: z.boolean().default(false),
    // TikTok-only (audit requirements, see packages/publisher/README.md)
    privacy: TikTokPrivacy.optional(),
    allowComment: z.boolean().optional(),
    allowDuet: z.boolean().optional(),
    allowStitch: z.boolean().optional(),
    commercial: z.boolean().optional(),
    brandedContent: z.boolean().optional(),
    consent: z.boolean().optional(),
  });

const ScheduleInput = z.object({ videoId: z.string(), targets: z.array(TargetInput).min(1, "Pick at least one account.") });

export async function schedulePublication(input: z.input<typeof ScheduleInput>): Promise<ActionResult<{ count: number }>> {
  const viewer = await getViewerOrNull();
  if (!viewer) return fail(NOT_SIGNED_IN);
  if (viewer.bypass) return fail(BYPASS_READONLY);
  const parsed = ScheduleInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the publish settings.");

  const ent = await getEntitlements(viewer.userId);
  if (!ent.canPublish) return fail("Posting needs a paid plan. Download the video or upgrade to post automatically.");

  const video = await prisma.video.findFirst({ where: { id: parsed.data.videoId, channel: { userId: viewer.userId } } });
  if (!video) return fail("Video not found.");
  if (video.status !== "READY" && video.status !== "PUBLISHED") return fail("The video must finish rendering before it can be scheduled.");

  const accounts = await prisma.socialAccount.findMany({
    where: { id: { in: parsed.data.targets.map((t) => t.socialAccountId) }, channelId: video.channelId },
  });
  const byId = new Map(accounts.map((a) => [a.id, a]));

  for (const t of parsed.data.targets) {
    const acc = byId.get(t.socialAccountId);
    if (!acc) return fail("One of the selected accounts is no longer connected.");
    if (acc.status !== "connected") return fail(`Reconnect ${acc.handle ?? acc.platform} before posting.`);
    if (new Date(t.scheduledAt).getTime() < Date.now() - 60_000) return fail("Pick a time in the future.");
    if (acc.platform === "TIKTOK") {
      if (!t.privacy) return fail("Choose who can view the TikTok post.");
      if (!t.consent) return fail("Confirm TikTok’s Music Usage Confirmation to post.");
      if (t.brandedContent && t.privacy === "private") return fail("Branded content can’t be private on TikTok.");
    }
  }

  const res = await engine.schedulePublication(viewer.userId, {
    videoId: video.id,
    targets: parsed.data.targets.map((t) => {
      const { socialAccountId, scheduledAt, ...rest } = t;
      const meta: Record<string, unknown> = { ...rest, aiGenerated: t.aiLabel };
      delete meta.consent;
      return { socialAccountId, scheduledAt, meta };
    }),
  });
  if (!res.ok) return fail(res.reason);
  revalidatePath(`/app/videos/${video.id}`);
  revalidatePath("/app/schedule");
  return ok({ count: res.data.publicationIds.length });
}

export async function cancelPublication(publicationId: string): Promise<ActionResult> {
  const viewer = await getViewerOrNull();
  if (!viewer) return fail(NOT_SIGNED_IN);
  if (viewer.bypass) return fail(BYPASS_READONLY);
  const pub = await prisma.publication.findFirst({ where: { id: publicationId, video: { channel: { userId: viewer.userId } } } });
  if (!pub) return fail("Post not found.");
  if (pub.status !== "SCHEDULED") return fail("Only scheduled posts can be cancelled.");
  const res = await engine.cancelPublication(viewer.userId, publicationId);
  if (!res.ok) return fail(res.reason);
  await prisma.publication.update({ where: { id: publicationId }, data: { status: "CANCELLED" } });
  revalidatePath("/app/schedule");
  return ok(undefined);
}

/** Approves a series post that is waiting in APPROVE mode (meta.needsApproval). TikTok needs privacy + consent here too. */
export async function approvePublication(input: { publicationId: string; privacy?: string; consent?: boolean }): Promise<ActionResult> {
  const viewer = await getViewerOrNull();
  if (!viewer) return fail(NOT_SIGNED_IN);
  if (viewer.bypass) return fail(BYPASS_READONLY);
  const pub = await prisma.publication.findFirst({ where: { id: input.publicationId, video: { channel: { userId: viewer.userId } } } });
  if (!pub) return fail("Post not found.");
  if (pub.platform === "TIKTOK") {
    const p = TikTokPrivacy.safeParse(input.privacy);
    if (!p.success) return fail("Choose who can view the TikTok post.");
    if (!input.consent) return fail("Confirm TikTok’s Music Usage Confirmation to approve.");
  }
  const meta = pub.meta && typeof pub.meta === "object" && !Array.isArray(pub.meta) ? pub.meta : {};
  await prisma.publication.update({
    where: { id: pub.id },
    data: { meta: { ...meta, needsApproval: false, approvedAt: new Date().toISOString(), ...(input.privacy ? { privacy: input.privacy } : {}) } },
  });
  revalidatePath("/app/schedule");
  return ok(undefined);
}
