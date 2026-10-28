/**
 * withUsageLogging: wraps any Mastra agent call, writes one `llm_calls` row (provider, model, tokens incl.
 * cached, estimated USD, latency, label, video/channel/user from AsyncLocalStorage) and adds the USD to
 * Video.cost.llmUsd. Writes are fire-and-forget; logging never breaks the pipeline.
 */
import { db } from "../lib/db.js";
import { has } from "../lib/env.js";
import { getCallContext } from "../lib/context.js";
import { estimateLlmUsd } from "../lib/pricing.js";
import { addCost } from "../lib/video.js";
import { log, errMsg } from "../lib/logger.js";
import { providerOf } from "./models.js";

export interface NormalizedUsage { inputTokens: number; outputTokens: number; totalTokens: number; cachedTokens: number; cacheWriteTokens: number }

/** Accepts AI SDK v5/v6/v7 usage shapes. */
export function normalizeUsage(u: unknown): NormalizedUsage {
  const x = (u ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const details = (x.inputTokenDetails ?? x.inputTokensDetails ?? {}) as Record<string, unknown>;
  const inputTokens = typeof x.inputTokens === "object" && x.inputTokens ? num((x.inputTokens as Record<string, unknown>).total) : num(x.inputTokens ?? x.promptTokens);
  const outputTokens = typeof x.outputTokens === "object" && x.outputTokens ? num((x.outputTokens as Record<string, unknown>).total) : num(x.outputTokens ?? x.completionTokens);
  const cachedTokens = num(x.cachedInputTokens ?? details.cacheReadTokens ?? details.cachedTokens ?? (typeof x.inputTokens === "object" && x.inputTokens ? (x.inputTokens as Record<string, unknown>).cacheRead : 0));
  const cacheWriteTokens = num(details.cacheWriteTokens ?? (typeof x.inputTokens === "object" && x.inputTokens ? (x.inputTokens as Record<string, unknown>).cacheWrite : 0));
  return { inputTokens, outputTokens, totalTokens: num(x.totalTokens) || inputTokens + outputTokens, cachedTokens, cacheWriteTokens };
}

export interface LlmCallRecord { label: string; model: string; usage?: unknown; latencyMs: number; ok: boolean; error?: string }

export function recordLlmCall(rec: LlmCallRecord): number {
  const ctx = getCallContext();
  const u = normalizeUsage(rec.usage);
  const provider = providerOf(rec.model);
  const usd = rec.ok ? estimateLlmUsd(provider, rec.model, u) ?? 0 : 0;
  log.info("llm_call", { label: rec.label, model: rec.model, in: u.inputTokens, out: u.outputTokens, cached: u.cachedTokens, usd, ms: rec.latencyMs, ok: rec.ok, videoId: ctx.videoId });
  if (has.db()) {
    db().llmCall.create({
      data: {
        provider, model: rec.model, label: rec.label,
        inputTokens: u.inputTokens, outputTokens: u.outputTokens, totalTokens: u.totalTokens, cachedTokens: u.cachedTokens,
        latencyMs: rec.latencyMs, usd, ok: rec.ok, error: rec.error?.slice(0, 1000) ?? null,
        videoId: ctx.videoId ?? null, channelId: ctx.channelId ?? null, userId: ctx.userId ?? null,
      },
    }).catch((e) => log.warn("llm_calls write failed", { err: errMsg(e) }));
    void addCost(ctx.videoId, "llmUsd", usd);
  }
  return usd;
}

/** Run `fn` (an agent.generate call) and record usage. `primaryModel` is used when the result doesn't name the serving model. */
export async function withUsageLogging<T>(label: string, primaryModel: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try {
    const result = await fn();
    const r = result as unknown as { usage?: unknown; totalUsage?: unknown; response?: { modelId?: string }; model?: { modelId?: string; provider?: string } };
    const served = r.response?.modelId;
    const inferProvider = (id: string) => (id.startsWith("claude") ? "anthropic" : id.startsWith("deepseek") ? "deepseek" : providerOf(primaryModel));
    const model = served ? (served.includes("/") ? served : `${inferProvider(served)}/${served}`) : primaryModel;
    recordLlmCall({ label, model, usage: r.totalUsage ?? r.usage, latencyMs: Date.now() - t0, ok: true });
    return result;
  } catch (e) {
    recordLlmCall({ label, model: primaryModel, latencyMs: Date.now() - t0, ok: false, error: errMsg(e) });
    throw e;
  }
}
