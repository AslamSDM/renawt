/**
 * Per-request / per-step context carried through AsyncLocalStorage so every LLM, TTS
 * and asset call can attribute cost to (videoId, channelId, userId) without threading args.
 * Ported from legacy tokenLogger.ts.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export interface CallContext {
  label?: string;
  videoId?: string;
  channelId?: string;
  userId?: string;
  step?: string;
}

const store = new AsyncLocalStorage<CallContext>();

export function getCallContext(): CallContext {
  return store.getStore() ?? {};
}

export function withCallContext<T>(ctx: CallContext, fn: () => Promise<T>): Promise<T> {
  return store.run({ ...getCallContext(), ...ctx }, fn);
}
