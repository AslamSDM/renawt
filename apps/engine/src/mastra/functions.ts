/**
 * Plain Inngest functions served next to the Mastra workflow functions:
 *  - video/produce.requested   → start produceVideo run with the pre-assigned runId
 *  - video/rerender.requested  → start rerenderVideo run
 *  - video/render.submitted    → poll fallback every 15s (≤12 min) → resume the suspended render step
 *  - video/ready               → series videos: create Publications at the slot + schedule them
 *  - publication/scheduled     → start publishPublication (sleepUntil scheduledAt)
 *  - radar/refresh.requested   → start radarRefresh for the given niches
 */
import { inngest, EVENTS } from "./inngest.js";
import { mastra, type WorkflowId } from "./index.js";
import { db } from "../lib/db.js";
import { log, errMsg } from "../lib/logger.js";
import { pollRemote } from "../lib/render/index.js";
import { failVideo } from "../pipeline/steps.js";
import { schedulePublicationsForSeriesVideo } from "./workflows/seriesTick.js";

type RenderResult = { status: "queued" | "rendering" | "completed" | "failed"; videoUrl?: string; error?: string };

/**
 * Resume the suspended render step exactly once (webhook and poller race): atomically claim by moving the
 * Video out of RENDERING; the loser does nothing.
 */
export async function resumeRender(videoId: string, result: RenderResult, source: "webhook" | "poll"): Promise<boolean> {
  const v = await db().video.findUnique({ where: { id: videoId }, select: { runId: true, qc: true } });
  if (!v?.runId) return false;
  const meta = ((v.qc ?? {}) as { render?: { jobId?: string; workflowId?: string } }).render;
  const claimed = await db().video.updateMany({ where: { id: videoId, status: "RENDERING" }, data: { status: "QC" } });
  if (!claimed.count) return false;
  const workflowId = (meta?.workflowId ?? "produceVideo") as WorkflowId;
  try {
    const run = await mastra.getWorkflow(workflowId).createRun({ runId: v.runId });
    await run.resumeAsync({ step: "render", resumeData: result });
    log.info("render resumed", { videoId, source, status: result.status });
    return true;
  } catch (e) {
    // Most likely the step hasn't finished suspending yet (very fast callback). Release the claim so the
    // poll fallback (or a webhook retry) resumes it later.
    log.warn("render resume failed; releasing claim", { videoId, err: errMsg(e) });
    await db().video.updateMany({ where: { id: videoId, status: "QC" }, data: { status: "RENDERING" } });
    if (source === "poll" && result.status === "failed") await failVideo(videoId, result.error ?? "render failed");
    return false;
  }
}

async function startRun(workflowId: WorkflowId, runId: string, inputData: Record<string, unknown>): Promise<string> {
  const run = await mastra.getWorkflow(workflowId).createRun({ runId });
  const r = await run.startAsync({ inputData } as never);
  return r.runId;
}

const produceTrigger = inngest.createFunction(
  { id: "produce-trigger", triggers: [{ event: EVENTS.produceRequested }], idempotency: "event.data.runId" },
  async ({ event, step }) => {
    const d = event.data as { videoId: string; runId: string; quality: string; watermark: boolean; notes?: string };
    return step.run("start-run", () => startRun("produceVideo", d.runId, { videoId: d.videoId, quality: d.quality, watermark: d.watermark, notes: d.notes }));
  },
);

const rerenderTrigger = inngest.createFunction(
  { id: "rerender-trigger", triggers: [{ event: EVENTS.rerenderRequested }], idempotency: "event.data.runId" },
  async ({ event, step }) => {
    const d = event.data as { videoId: string; runId: string; quality: string; watermark: boolean };
    return step.run("start-run", () => startRun("rerenderVideo", d.runId, { videoId: d.videoId, quality: d.quality, watermark: d.watermark }));
  },
);

const renderPoller = inngest.createFunction(
  { id: "render-poll-fallback", triggers: [{ event: EVENTS.renderSubmitted }], idempotency: "event.data.jobId" },
  async ({ event, step }) => {
    const d = event.data as { videoId: string; jobId: string };
    const maxPolls = 48; // 48 × 15s = 12 min
    for (let i = 0; i < maxPolls; i++) {
      await step.sleep(`wait-${i}`, "15s");
      const s = await step.run(`poll-${i}`, async () => {
        const v = await db().video.findUnique({ where: { id: d.videoId }, select: { status: true } });
        if (v?.status !== "RENDERING") return { done: true, result: null as RenderResult | null };
        const r = await pollRemote(d.jobId);
        return { done: r.status === "completed" || r.status === "failed", result: { status: r.status, videoUrl: r.videoUrl, error: r.error } as RenderResult | null };
      });
      if (s.done) {
        if (!s.result) return { resolved: true, polls: i + 1, by: "webhook" };
        const ok = await step.run(`resume-${i}`, () => resumeRender(d.videoId, s.result as RenderResult, "poll"));
        if (ok) return { resolved: true, polls: i + 1, by: "poll" };
      }
    }
    await step.run("timeout", () => resumeRender(d.videoId, { status: "failed", error: "render timed out after 12 minutes" }, "poll"));
    return { resolved: false };
  },
);

const onVideoReady = inngest.createFunction(
  { id: "series-on-video-ready", triggers: [{ event: EVENTS.videoReady }] },
  async ({ event, step }) => {
    const ids = await step.run("create-publications", () => schedulePublicationsForSeriesVideo((event.data as { videoId: string }).videoId));
    if (ids.length) await step.sendEvent("schedule", ids.map((publicationId) => ({ name: EVENTS.publishScheduled, data: { publicationId } })));
    return { publications: ids.length };
  },
);

const publishTrigger = inngest.createFunction(
  { id: "publish-trigger", triggers: [{ event: EVENTS.publishScheduled }] },
  async ({ event, step }) => {
    const { publicationId } = event.data as { publicationId: string };
    return step.run("start-run", () => startRun("publishPublication", `pub-${publicationId}-${Date.now()}`, { publicationId }));
  },
);

const radarTrigger = inngest.createFunction(
  { id: "radar-trigger", triggers: [{ event: EVENTS.radarRefresh }] },
  async ({ event, step }) => {
    const d = event.data as { niches?: string[]; force?: boolean };
    return step.run("start-run", () => startRun("radarRefresh", `radar-${Date.now()}`, { niches: d.niches, force: !!d.force }));
  },
);

export const inngestFunctions = [produceTrigger, rerenderTrigger, renderPoller, onVideoReady, publishTrigger, radarTrigger];
