/**
 * produceVideo (Inngest-backed Mastra workflow):
 *   ingest (video/audio uploads) → transcribe (Whisper) → script (idea|prompt: writer; audio: transcript beats; video: edit plan)
 *   → parallel[voice (TTS | uploaded audio | trimmed speech), plan] → align → assets → compose → dountil(review, ok || attempts==2)
 *   → render (local inline | Lambda: submit + SUSPEND until /webhooks/render or the 15s poll fallback)
 *   → qc → cuts → READY
 * rerenderVideo: compose → review loop → render → qc → cuts (script/scenes edited by the user beforehand).
 * On failure: Video.status=FAILED, error set, quota refunded (UsageLedger +1, videosUsed--).
 */
import { z } from "zod";
import { createWorkflow, createStep, inngest, EVENTS } from "../inngest.js";
import {
  runIngest, runTranscribe, runScript, runVoice, runPlan, runAlign, runAssets, runCompose, runReview, runRenderLocal,
  submitRender, completeRender, runQc, runCuts, failVideo, type PipelineCtx,
} from "../../pipeline/steps.js";
import { isLocalRender } from "../../lib/render/index.js";
import { env } from "../../lib/env.js";
import { signToken } from "../../lib/hash.js";
import { db } from "../../lib/db.js";

export const CtxSchema = z.object({
  videoId: z.string(),
  quality: z.enum(["draft", "standard", "premium"]),
  watermark: z.boolean(),
  notes: z.string().optional(),
});
const LoopSchema = CtxSchema.extend({ ok: z.boolean(), attempts: z.number(), errors: z.array(z.string()).default([]) });
const ResumeSchema = z.object({ status: z.enum(["queued", "rendering", "completed", "failed"]), videoUrl: z.string().optional(), error: z.string().optional() });
const DoneSchema = z.object({ videoId: z.string(), masterUrl: z.string(), thumbnailUrl: z.string().nullable() });

const ctxOf = (i: z.infer<typeof CtxSchema>): PipelineCtx => ({ videoId: i.videoId, quality: i.quality, watermark: i.watermark });
const pass = (i: z.infer<typeof CtxSchema>) => ({ videoId: i.videoId, quality: i.quality, watermark: i.watermark, notes: i.notes });

export const renderCallbackUrl = (videoId: string) => `${env.publicUrl}/webhooks/render?videoId=${encodeURIComponent(videoId)}&token=${signToken(env.apiKey, videoId)}`;

const ingestStep = createStep({
  id: "ingest", inputSchema: CtxSchema, outputSchema: CtxSchema,
  execute: async ({ inputData }) => { await runIngest(ctxOf(inputData)); return pass(inputData); },
});
const transcribeStep = createStep({
  id: "transcribe", inputSchema: CtxSchema, outputSchema: CtxSchema,
  execute: async ({ inputData }) => { await runTranscribe(ctxOf(inputData)); return pass(inputData); },
});
const scriptStep = createStep({
  id: "script", inputSchema: CtxSchema, outputSchema: CtxSchema,
  execute: async ({ inputData }) => { await runScript(ctxOf(inputData), { notes: inputData.notes }); return pass(inputData); },
});
const voiceStep = createStep({
  id: "voice", inputSchema: CtxSchema, outputSchema: CtxSchema,
  execute: async ({ inputData }) => { await runVoice(ctxOf(inputData)); return pass(inputData); },
});
const planStep = createStep({
  id: "plan", inputSchema: CtxSchema, outputSchema: CtxSchema,
  execute: async ({ inputData }) => { await runPlan(ctxOf(inputData)); return pass(inputData); },
});
const alignStep = createStep({
  id: "align", inputSchema: z.object({ voice: CtxSchema, plan: CtxSchema }), outputSchema: CtxSchema,
  execute: async ({ inputData }) => { await runAlign(ctxOf(inputData.voice)); return pass(inputData.voice); },
});
const assetsStep = createStep({
  id: "assets", inputSchema: CtxSchema, outputSchema: CtxSchema,
  execute: async ({ inputData }) => { await runAssets(ctxOf(inputData)); return pass(inputData); },
});
const composeStep = createStep({
  id: "compose", inputSchema: CtxSchema, outputSchema: LoopSchema,
  execute: async ({ inputData }) => {
    const s = await runCompose(ctxOf(inputData));
    return { ...pass(inputData), ok: s.ok, attempts: 0, errors: s.lint?.errors ?? [] };
  },
});
const reviewStep = createStep({
  id: "review", inputSchema: LoopSchema, outputSchema: LoopSchema,
  execute: async ({ inputData }) => {
    // Lint already passed in compose and no premium critic pass pending → nothing to do.
    if (inputData.ok && inputData.attempts > 0) return inputData;
    const s = await runReview(ctxOf(inputData), { ok: inputData.ok, attempts: inputData.attempts });
    return { ...pass(inputData), ok: s.ok, attempts: s.attempts, errors: s.lint?.errors ?? [] };
  },
});

function makeRenderStep(workflowId: string) {
  return createStep({
    id: "render", inputSchema: LoopSchema, outputSchema: CtxSchema,
    resumeSchema: ResumeSchema, suspendSchema: z.object({ jobId: z.string() }),
    execute: async ({ inputData, resumeData, suspend }) => {
      const ctx = ctxOf(inputData);
      if (resumeData) {
        await completeRender(ctx, resumeData);
        return pass(inputData);
      }
      if (!inputData.ok) throw new Error(`composition lint failed after ${inputData.attempts} attempt(s): ${inputData.errors.slice(0, 5).join("; ")}`);
      if (isLocalRender()) {
        await runRenderLocal(ctx);
        return pass(inputData);
      }
      const { jobId } = await submitRender(ctx, { callbackUrl: renderCallbackUrl(inputData.videoId), workflowId });
      await inngest.send({ name: EVENTS.renderSubmitted, data: { videoId: inputData.videoId, jobId, workflowId } });
      return suspend({ jobId });
    },
  });
}
const qcStep = createStep({
  id: "qc", inputSchema: CtxSchema, outputSchema: CtxSchema,
  execute: async ({ inputData }) => { await runQc(ctxOf(inputData)); return pass(inputData); },
});
const cutsStep = createStep({
  id: "cuts", inputSchema: CtxSchema, outputSchema: DoneSchema,
  execute: async ({ inputData }) => {
    const r = await runCuts(ctxOf(inputData));
    await inngest.send({ name: EVENTS.videoReady, data: { videoId: inputData.videoId } });
    return { videoId: inputData.videoId, ...r };
  },
});

const onError = async (info: { getInitData: () => unknown; error?: { message?: string } }) => {
  const init = info.getInitData() as { videoId?: string } | undefined;
  if (init?.videoId) await failVideo(init.videoId, info.error?.message ?? "pipeline failed");
};

export const produceVideo = createWorkflow({
  id: "produceVideo",
  inputSchema: CtxSchema,
  outputSchema: DoneSchema,
  retries: 2,
  concurrency: { limit: 20 },
  options: { onError },
})
  .then(ingestStep)
  .then(transcribeStep)
  .then(scriptStep)
  .parallel([voiceStep, planStep])
  .then(alignStep)
  .then(assetsStep)
  .then(composeStep)
  .dountil(reviewStep, async ({ inputData }) => inputData.ok || inputData.attempts >= 2)
  .then(makeRenderStep("produceVideo"))
  .then(qcStep)
  .then(cutsStep)
  .commit();

export const rerenderVideo = createWorkflow({
  id: "rerenderVideo",
  inputSchema: CtxSchema,
  outputSchema: DoneSchema,
  retries: 2,
  options: { onError },
})
  .then(composeStep)
  .dountil(reviewStep, async ({ inputData }) => inputData.ok || inputData.attempts >= 2)
  .then(makeRenderStep("rerenderVideo"))
  .then(qcStep)
  .then(cutsStep)
  .commit();

/** Mark a run id on the Video row (web polls by videoId; webhooks resume by runId). */
export async function attachRun(videoId: string, runId: string): Promise<void> {
  await db().video.update({ where: { id: videoId }, data: { runId, status: "QUEUED", error: null } });
}
