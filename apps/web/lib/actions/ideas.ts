"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FORMAT_IDS } from "@remawt/shared";
import { prisma } from "@/lib/db/prisma";
import { engine } from "@/lib/engine";
import { getViewerOrNull } from "@/lib/queries/viewer";
import { BYPASS_READONLY, NOT_SIGNED_IN, fail, ok, zodFieldErrors, type ActionResult } from "./result";

async function ownIdea(userId: string, ideaId: string) {
  return prisma.idea.findFirst({ where: { id: ideaId, channel: { userId } }, select: { id: true, status: true } });
}

export async function setIdeaStatus(ideaId: string, status: "APPROVED" | "DISMISSED" | "SUGGESTED"): Promise<ActionResult> {
  const viewer = await getViewerOrNull();
  if (!viewer) return fail(NOT_SIGNED_IN);
  if (viewer.bypass) return fail(BYPASS_READONLY);
  const idea = await ownIdea(viewer.userId, ideaId);
  if (!idea) return fail("Idea not found.");
  await prisma.idea.update({ where: { id: ideaId }, data: { status } });
  revalidatePath("/app/ideas");
  revalidatePath("/app");
  return ok(undefined);
}

const EditIdeaInput = z.object({
  ideaId: z.string(),
  hook: z.string().trim().min(4, "Write a hook (4+ characters).").max(200),
  title: z.string().trim().min(2, "Give it a title.").max(120),
  angle: z.string().trim().max(500).optional(),
  format: z.string().refine((f) => FORMAT_IDS.includes(f), "Pick a format."),
});

export async function editIdea(input: z.input<typeof EditIdeaInput>): Promise<ActionResult> {
  const viewer = await getViewerOrNull();
  if (!viewer) return fail(NOT_SIGNED_IN);
  if (viewer.bypass) return fail(BYPASS_READONLY);
  const parsed = EditIdeaInput.safeParse(input);
  if (!parsed.success) return fail("Check the idea fields.", zodFieldErrors(parsed.error));
  const { ideaId, ...data } = parsed.data;
  const idea = await ownIdea(viewer.userId, ideaId);
  if (!idea) return fail("Idea not found.");
  await prisma.idea.update({ where: { id: ideaId }, data: { ...data, angle: data.angle || null } });
  revalidatePath("/app/ideas");
  return ok(undefined);
}

export async function generateIdeas(channelId: string, weekKey?: string): Promise<ActionResult<{ count: number }>> {
  const viewer = await getViewerOrNull();
  if (!viewer) return fail(NOT_SIGNED_IN);
  if (viewer.bypass) return fail(BYPASS_READONLY);
  const owned = await prisma.channel.count({ where: { id: channelId, userId: viewer.userId } });
  if (!owned) return fail("Channel not found.");
  const res = await engine.generateIdeas(viewer.userId, { channelId, count: 10, weekKey });
  if (!res.ok) return fail(res.reason);
  revalidatePath("/app/ideas");
  revalidatePath("/app/radar");
  revalidatePath("/app");
  return ok({ count: res.data.ideaIds.length });
}
