/**
 * LLM token usage logger.
 *
 * Every chat call in model.ts pushes a row into the `llm_calls` table.
 * Context (label / projectId / userId) flows via AsyncLocalStorage so call
 * sites don't have to thread metadata through every helper.
 *
 * Writes are fire-and-forget — never block the chat response on the DB.
 */

import { AsyncLocalStorage } from "async_hooks";
import { PrismaClient } from "../generated/prisma/index.js";

let prismaClient: PrismaClient | null = null;
function prisma(): PrismaClient {
  if (!prismaClient) prismaClient = new PrismaClient();
  return prismaClient;
}

export interface LlmContext {
  label?: string;
  projectId?: string;
  userId?: string;
}

const ctxStore = new AsyncLocalStorage<LlmContext>();

export function getLlmContext(): LlmContext {
  return ctxStore.getStore() ?? {};
}

/** Wrap an async block so every LLM call inside inherits the given context. */
export function withLlmContext<T>(ctx: LlmContext, fn: () => Promise<T>): Promise<T> {
  const merged = { ...getLlmContext(), ...ctx };
  return ctxStore.run(merged, fn);
}

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface LogLlmCallInput {
  provider: string;
  model: string;
  /** Override the ALS label if you want a more specific tag for this single call. */
  label?: string;
  usage?: TokenUsage;
  latencyMs: number;
  ok: boolean;
  error?: string;
}

/**
 * Persist one chat-call's usage. Errors swallowed — logging must never break
 * a production request.
 */
export function logLlmCall(input: LogLlmCallInput): void {
  const ctx = getLlmContext();
  const label = input.label ?? ctx.label ?? "unlabeled";
  const inputTokens = input.usage?.inputTokens ?? 0;
  const outputTokens = input.usage?.outputTokens ?? 0;
  const totalTokens =
    input.usage?.totalTokens ?? inputTokens + outputTokens;

  console.log(
    `[llm-tokens] ${input.provider}/${input.model} label=${label} in=${inputTokens} out=${outputTokens} total=${totalTokens} ${input.latencyMs}ms ${input.ok ? "ok" : "err"}`,
  );

  prisma()
    .llmCall.create({
      data: {
        provider: input.provider,
        model: input.model,
        label,
        inputTokens,
        outputTokens,
        totalTokens,
        latencyMs: input.latencyMs,
        ok: input.ok,
        error: input.error ?? null,
        projectId: ctx.projectId ?? null,
        userId: ctx.userId ?? null,
      },
    })
    .catch((err) => {
      console.warn(
        `[llm-tokens] failed to persist log: ${err instanceof Error ? err.message : err}`,
      );
    });
}
