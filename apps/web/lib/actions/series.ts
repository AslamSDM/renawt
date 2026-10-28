"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FORMAT_IDS } from "@remawt/shared";
import { prisma } from "@/lib/db/prisma";
import { getViewerOrNull } from "@/lib/queries/viewer";
import { BYPASS_READONLY, NOT_SIGNED_IN, fail, ok, zodFieldErrors, type ActionResult } from "./result";

const PLATFORMS = ["TIKTOK", "YOUTUBE", "INSTAGRAM", "FACEBOOK", "THREADS", "LINKEDIN", "X", "PINTEREST"] as const;

const SeriesInput = z
  .object({
    id: z.string().optional(),
    channelId: z.string(),
    name: z.string().trim().min(2, "Name the series.").max(80),
    perWeek: z.number().int().min(1).max(21),
    days: z.array(z.number().int().min(1).max(7)).min(1, "Pick at least one day."),
    hourLocal: z.number().int().min(0).max(23),
    platforms: z.array(z.enum(PLATFORMS)).min(1, "Pick at least one platform."),
    mode: z.enum(["APPROVE", "AUTO"]),
    formats: z.array(z.string().refine((f) => FORMAT_IDS.includes(f))).default([]),
    active: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "AUTO" && v.platforms.includes("TIKTOK"))
      ctx.addIssue({ code: "custom", path: ["mode"], message: "TikTok posts always need your approval. Use Approve mode or drop TikTok." });
  });

export async function upsertSeries(input: z.input<typeof SeriesInput>): Promise<ActionResult<{ id: string }>> {
  const viewer = await getViewerOrNull();
  if (!viewer) return fail(NOT_SIGNED_IN);
  if (viewer.bypass) return fail(BYPASS_READONLY);
  const parsed = SeriesInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the series fields.", zodFieldErrors(parsed.error));
  const { id, channelId, name, perWeek, days, hourLocal, platforms, mode, formats, active } = parsed.data;
  const owned = await prisma.channel.count({ where: { id: channelId, userId: viewer.userId } });
  if (!owned) return fail("Channel not found.");
  const data = { name, cadence: { perWeek, days, hourLocal, formats }, platforms, mode, active };
  if (id) {
    const res = await prisma.series.updateMany({ where: { id, channel: { userId: viewer.userId } }, data });
    if (res.count === 0) return fail("Series not found.");
    revalidatePath("/app/series");
    return ok({ id });
  }
  const created = await prisma.series.create({ data: { ...data, channelId } });
  revalidatePath("/app/series");
  return ok({ id: created.id });
}

export async function setSeriesActive(id: string, active: boolean): Promise<ActionResult> {
  const viewer = await getViewerOrNull();
  if (!viewer) return fail(NOT_SIGNED_IN);
  if (viewer.bypass) return fail(BYPASS_READONLY);
  const res = await prisma.series.updateMany({ where: { id, channel: { userId: viewer.userId } }, data: { active } });
  if (res.count === 0) return fail("Series not found.");
  revalidatePath("/app/series");
  return ok(undefined);
}

export async function deleteSeries(id: string): Promise<ActionResult> {
  const viewer = await getViewerOrNull();
  if (!viewer) return fail(NOT_SIGNED_IN);
  if (viewer.bypass) return fail(BYPASS_READONLY);
  const s = await prisma.series.findFirst({ where: { id, channel: { userId: viewer.userId } }, select: { id: true } });
  if (!s) return fail("Series not found.");
  await prisma.video.updateMany({ where: { seriesId: id }, data: { seriesId: null } });
  await prisma.series.delete({ where: { id } });
  revalidatePath("/app/series");
  return ok(undefined);
}
