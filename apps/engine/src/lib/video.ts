/**
 * Video row helpers: progress append (atomic jsonb concat), status updates, cost accumulation.
 * The web app polls `Video.progress` every 2s (callback→DB→poll pattern from v1).
 */
import type { ProgressEvent, PipelineStep } from "@remawt/shared";
import type { VideoStatus } from "@remawt/db";
import { db } from "./db.js";
import { has } from "./env.js";
import { log, errMsg } from "./logger.js";

export type CostBucket = "llmUsd" | "ttsUsd" | "sttUsd" | "imagesUsd" | "renderUsd" | "sfxUsd";

/** Step → coarse Video.status while that step is running. */
export const STEP_STATUS: Partial<Record<PipelineStep | string, VideoStatus>> = {
  ingest: "TRANSCRIBING" as VideoStatus,
  transcribe: "TRANSCRIBING" as VideoStatus,
  script: "SCRIPTING",
  voice: "VOICING",
  plan: "PLANNING",
  align: "PLANNING",
  assets: "PLANNING",
  compose: "COMPOSING",
  lint: "COMPOSING",
  render: "RENDERING",
  qc: "QC",
  cuts: "QC",
};

export async function appendProgress(videoId: string, ev: Omit<ProgressEvent, "at"> & { at?: string }): Promise<void> {
  const event: ProgressEvent = { ...ev, at: ev.at ?? new Date().toISOString() };
  log.info("progress", { videoId, step: event.step, status: event.status, message: event.message });
  if (!has.db()) return;
  try {
    await db().$executeRaw`UPDATE "Video" SET progress = COALESCE(progress, '[]'::jsonb) || ${JSON.stringify([event])}::jsonb, "updatedAt" = now() WHERE id = ${videoId}`;
  } catch (e) {
    log.warn("progress write failed", { videoId, err: errMsg(e) });
  }
}

export async function setStatus(videoId: string, status: VideoStatus, extra: Record<string, unknown> = {}): Promise<void> {
  if (!has.db()) return;
  await db().video.update({ where: { id: videoId }, data: { status, ...extra } });
}

/** Atomically add `usd` to Video.cost[bucket] and Video.cost.totalUsd. */
export async function addCost(videoId: string | undefined, bucket: CostBucket, usd: number): Promise<void> {
  if (!videoId || !usd || !has.db()) return;
  try {
    await db().$executeRaw`UPDATE "Video" SET cost = COALESCE(cost, '{}'::jsonb) || jsonb_build_object(${bucket}::text, COALESCE((cost->>${bucket})::float8, 0) + ${usd}::float8, 'totalUsd', COALESCE((cost->>'totalUsd')::float8, 0) + ${usd}::float8) WHERE id = ${videoId}`;
  } catch (e) {
    log.warn("cost write failed", { videoId, bucket, err: errMsg(e) });
  }
}

/** Run `fn` as a pipeline step: started/done/failed progress events + status transitions. */
export async function trackStep<T>(videoId: string, step: string, fn: () => Promise<T>, opts: { message?: string; output?: (r: T) => unknown } = {}): Promise<T> {
  const status = STEP_STATUS[step];
  if (status) await setStatus(videoId, status).catch(() => undefined);
  await appendProgress(videoId, { step, status: "started", message: opts.message });
  try {
    const r = await fn();
    await appendProgress(videoId, { step, status: "done", output: opts.output ? opts.output(r) : undefined });
    return r;
  } catch (e) {
    await appendProgress(videoId, { step, status: "failed", message: errMsg(e) });
    throw e;
  }
}

export async function loadVideo(videoId: string) {
  const v = await db().video.findUnique({ where: { id: videoId }, include: { channel: true } });
  if (!v) throw new Error(`Video ${videoId} not found`);
  return v;
}

export type VideoWithChannel = Awaited<ReturnType<typeof loadVideo>>;
