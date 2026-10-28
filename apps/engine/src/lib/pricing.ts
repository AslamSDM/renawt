/**
 * List-price table (USD) used to estimate per-call cost for `llm_calls.usd` and `Video.cost`.
 * Sources: docs/research/2026-10-28-tech-stack.md §2–6 and the Claude API pricing table (2026-10).
 * Estimates only; the provider invoice is the source of truth.
 */

export interface LlmPrice {
  inPerM: number;          // uncached input $/MTok
  outPerM: number;         // output $/MTok
  cacheReadPerM: number;   // cache hit $/MTok
  cacheWritePerM?: number; // cache write (5m) $/MTok; defaults to 1.25 × input
  offPeakDiscount?: number; // multiplier applied off-peak (DeepSeek: 0.5)
}

export const LLM_PRICES: Record<string, LlmPrice> = {
  "anthropic/claude-opus-5-5": { inPerM: 4, outPerM: 20, cacheReadPerM: 0.2, cacheWritePerM: 5 },
  "anthropic/claude-sonnet-5-5": { inPerM: 2, outPerM: 10, cacheReadPerM: 0.2, cacheWritePerM: 2.5 },
  "anthropic/claude-haiku-5-5": { inPerM: 0.1, outPerM: 0.5, cacheReadPerM: 0.01, cacheWritePerM: 0.125 },
  "anthropic/claude-fable-5-1": { inPerM: 10, outPerM: 50, cacheReadPerM: 0.25, cacheWritePerM: 12.5 },
  "deepseek/deepseek-flash": { inPerM: 0.3, outPerM: 1.2, cacheReadPerM: 0.006, offPeakDiscount: 0.5 },
  "deepseek/deepseek-v4-pro": { inPerM: 1.32, outPerM: 3.96, cacheReadPerM: 0.044, offPeakDiscount: 0.5 },
};

/** Normalise "claude-sonnet-5-5" / "anthropic/claude-sonnet-5-5" / "anthropic.claude-sonnet-5-5" to a table key. */
export function priceKey(provider: string, model: string): string {
  const m = model.includes("/") ? model.split("/").pop()! : model.replace(/^anthropic\./, "");
  const p = provider.toLowerCase().includes("deepseek") ? "deepseek" : provider.toLowerCase().includes("anthropic") ? "anthropic" : provider.toLowerCase();
  return `${p}/${m}`;
}

/** DeepSeek peak = 01:00–04:00 and 06:00–10:00 UTC on weekdays; everything else is off-peak. */
export function isDeepseekOffPeak(at: Date = new Date()): boolean {
  const day = at.getUTCDay();
  if (day === 0 || day === 6) return true;
  const h = at.getUTCHours();
  const peak = (h >= 1 && h < 4) || (h >= 6 && h < 10);
  return !peak;
}

export interface UsageForPricing {
  inputTokens: number;   // total input incl. cached
  outputTokens: number;
  cachedTokens?: number; // cache reads (subset of inputTokens)
  cacheWriteTokens?: number;
}

export function estimateLlmUsd(provider: string, model: string, u: UsageForPricing, at: Date = new Date()): number | null {
  const price = LLM_PRICES[priceKey(provider, model)];
  if (!price) return null;
  const cached = Math.max(0, u.cachedTokens ?? 0);
  const writes = Math.max(0, u.cacheWriteTokens ?? 0);
  const uncached = Math.max(0, u.inputTokens - cached - writes);
  let usd =
    (uncached * price.inPerM + cached * price.cacheReadPerM + writes * (price.cacheWritePerM ?? price.inPerM * 1.25) + u.outputTokens * price.outPerM) / 1_000_000;
  if (price.offPeakDiscount && isDeepseekOffPeak(at)) usd *= price.offPeakDiscount;
  return round6(usd);
}

/** TTS $/1k characters. */
export const TTS_PRICES: Record<string, number> = {
  "elevenlabs/eleven_flash_v2_5": 0.04,
  "elevenlabs/eleven_turbo_v2_5": 0.04,
  "elevenlabs/eleven_v4_turbo": 0.04,
  "elevenlabs/eleven_v4": 0.08,
  "elevenlabs/eleven_multilingual_v2": 0.08,
  "kokoro/hexgrad/Kokoro-82M": 0.00062,
};

export function estimateTtsUsd(provider: string, model: string, chars: number): number {
  const per1k = TTS_PRICES[`${provider}/${model}`] ?? (provider === "kokoro" ? 0.00062 : 0.08);
  return round6((chars / 1000) * per1k);
}

/** Per-image list price. */
export const IMAGE_PRICES: Record<string, number> = {
  nanobanana: 0.034,
  recraft: 0.007,
  pexels: 0,
  pixabay: 0,
};

export const SFX_USD_PER_MIN = 0.12;
export function estimateSfxUsd(durationMs: number): number {
  return round6((durationMs / 60000) * SFX_USD_PER_MIN);
}

/** Rough Lambda render cost: ~$0.0214 per 480 frames (HF docs example). */
export function estimateRenderUsd(durationMs: number, fps = 30, provider: "lambda" | "local" = "lambda"): number {
  if (provider === "local") return 0;
  const frames = (durationMs / 1000) * fps;
  return round6((frames / 480) * 0.0214);
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
