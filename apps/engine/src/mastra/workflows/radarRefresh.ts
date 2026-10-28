/**
 * radarRefresh — Inngest workflow, cron daily 05:00 UTC (+ manual via /v1/radar/refresh).
 * niches = input.niches ?? (distinct active Channel.niche ∪ LAUNCH_NICHES)
 * per niche: radar sources → score → tag (DeepSeek off-peak → Haiku) → upsert TrendItem → cluster → TrendCard(weekKey)
 */
import { z } from "zod";
import { LAUNCH_NICHES, getNiche } from "@remawt/shared";
import { createWorkflow, createStep } from "../inngest.js";
import { db } from "../../lib/db.js";
import { log, errMsg } from "../../lib/logger.js";
import { runTagger } from "../agents/radar.js";
import { refreshNiche as radarRefreshNiche } from "@remawt/radar";
import { withCallContext } from "../../lib/context.js";

const Input = z.object({ niches: z.array(z.string()).optional(), force: z.boolean().default(false) });
const NicheResult = z.object({ niche: z.string(), items: z.number(), cards: z.number(), error: z.string().optional() });

export async function activeNiches(): Promise<string[]> {
  const rows = await db().channel.findMany({ where: { status: "ACTIVE" }, select: { niche: true }, distinct: ["niche"] });
  return [...new Set([...rows.map((r) => r.niche), ...LAUNCH_NICHES])];
}

export async function refreshNiche(slug: string): Promise<z.infer<typeof NicheResult>> {
  if (!getNiche(slug)) return { niche: slug, items: 0, cards: 0, error: "unknown niche" };
  return withCallContext({ label: `radar:${slug}` }, async () => {
    const r = await radarRefreshNiche({ niche: slug, env: process.env, prisma: db(), runTagger: runTagger as never });
    for (const s of r.sources) if (s.error) log.warn("radar source failed", { source: s.id, niche: slug, err: s.error });
    return { niche: slug, items: r.itemsPersisted, cards: r.cards.length };
  });
}

const resolveNiches = createStep({
  id: "resolve-niches", inputSchema: Input, outputSchema: z.array(z.string()),
  execute: async ({ inputData }) => (inputData.niches?.length ? inputData.niches : await activeNiches()),
});

const refreshOne = createStep({
  id: "refresh-niche", inputSchema: z.string(), outputSchema: NicheResult,
  execute: async ({ inputData }) => {
    try { return await refreshNiche(inputData); } catch (e) { return { niche: inputData, items: 0, cards: 0, error: errMsg(e) }; }
  },
});

export const radarRefresh = createWorkflow({
  id: "radarRefresh",
  inputSchema: Input,
  outputSchema: z.array(NicheResult),
  cron: "0 5 * * *",
  inputData: { force: false },
  retries: 1,
  concurrency: { limit: 1 },
})
  .then(resolveNiches)
  .foreach(refreshOne, { concurrency: 3 })
  .commit();
