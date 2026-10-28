/** Starting produce/rerender runs: quota-aware quality resolution + Inngest event dispatch. */
import { randomUUID } from "node:crypto";
import { getPlan, type PlanId } from "@remawt/shared";
import { db } from "../lib/db.js";
import { planForUser } from "../lib/billing.js";
import { inngest, EVENTS } from "../mastra/inngest.js";
import type { Quality } from "../mastra/models.js";

const RANK: Record<Quality, number> = { draft: 0, standard: 1, premium: 2 };

/** Requested quality capped by the plan's quality; FREE → draft + watermark. */
export function resolveQuality(requested: Quality | undefined, plan: PlanId): { quality: Quality; watermark: boolean } {
  const p = getPlan(plan);
  const cap = p.quality as Quality;
  const want = requested ?? cap;
  return { quality: RANK[want] <= RANK[cap] ? want : cap, watermark: p.watermark };
}

export interface ProduceRequest { videoId: string; quality?: Quality; notes?: string; kind?: "produce" | "rerender" }

/** Updates the existing Video row (QUEUED, runId) and emits the Inngest event. Never creates rows. */
export async function requestProduce(req: ProduceRequest): Promise<{ runId: string; quality: Quality; watermark: boolean }> {
  const v = await db().video.findUnique({ where: { id: req.videoId }, select: { id: true, channel: { select: { userId: true } } } });
  if (!v) throw Object.assign(new Error(`video ${req.videoId} not found`), { status: 404 });
  const plan = await planForUser(v.channel.userId);
  const { quality, watermark } = resolveQuality(req.quality, plan);
  const runId = randomUUID();
  await db().video.update({ where: { id: v.id }, data: { runId, status: "QUEUED", error: null } });
  await inngest.send({
    name: req.kind === "rerender" ? EVENTS.rerenderRequested : EVENTS.produceRequested,
    data: { videoId: v.id, runId, quality, watermark, notes: req.notes },
  });
  return { runId, quality, watermark };
}
