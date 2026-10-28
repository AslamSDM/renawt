/**
 * Named model configs (Mastra model-router strings + fallback arrays). Keys from env:
 * ANTHROPIC_API_KEY, DEEPSEEK_API_KEY. Entries whose provider key is missing are dropped so a
 * missing DeepSeek key never blocks a run (Claude takes over).
 */
import { has } from "../lib/env.js";

export const MODELS = {
  haiku: "anthropic/claude-haiku-5-5",
  sonnet: "anthropic/claude-sonnet-5-5",
  opus: "anthropic/claude-opus-5-5",
  deepseek: "deepseek/deepseek-flash",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];
export type Quality = "draft" | "standard" | "premium";
export type ModelRole = "classify" | "draft" | "script" | "plan" | "compose" | "critic" | "premium" | "metadata" | "tag" | "ideate" | "repair";

export interface ModelEntry { model: ModelId; maxRetries: number }

function chain(...ids: ModelId[]): ModelEntry[] {
  const ok = ids.filter((id) => (id.startsWith("deepseek/") ? has.deepseek() : has.anthropic()));
  const list = ok.length ? ok : ids; // nothing configured → keep the list so the error names the missing key
  return list.map((model, i) => ({ model, maxRetries: i === 0 ? 2 : 1 }));
}

/**
 * Role × quality → ordered fallback chain.
 *  classify:  Haiku → DeepSeek
 *  draft:     DeepSeek → Haiku
 *  script:    Sonnet → Opus      (premium: Opus → Sonnet; draft: DeepSeek → Haiku → Sonnet)
 *  compose:   Sonnet → Opus      (premium: Opus → Sonnet)
 *  critic:    Sonnet (standard) | Opus (premium)
 *  premium:   Opus
 *  repair:    Haiku → Sonnet   (scene data repair; tiny structured calls)
 */
export function modelsFor(role: ModelRole, quality: Quality = "standard"): ModelEntry[] {
  switch (role) {
    case "classify":
    case "metadata":
      return chain(MODELS.haiku, MODELS.deepseek);
    case "repair":
      return chain(MODELS.haiku, MODELS.sonnet);
    case "tag":
    case "draft":
      return chain(MODELS.deepseek, MODELS.haiku);
    case "script":
      if (quality === "premium") return chain(MODELS.opus, MODELS.sonnet);
      if (quality === "draft") return chain(MODELS.deepseek, MODELS.haiku, MODELS.sonnet);
      return chain(MODELS.sonnet, MODELS.opus);
    case "plan":
      if (quality === "draft") return chain(MODELS.haiku, MODELS.sonnet);
      return quality === "premium" ? chain(MODELS.opus, MODELS.sonnet) : chain(MODELS.sonnet, MODELS.opus);
    case "compose":
      return quality === "premium" ? chain(MODELS.opus, MODELS.sonnet) : chain(MODELS.sonnet, MODELS.opus);
    case "critic":
      return quality === "premium" ? chain(MODELS.opus, MODELS.sonnet) : chain(MODELS.sonnet, MODELS.opus);
    case "ideate":
      return chain(MODELS.sonnet, MODELS.opus);
    case "premium":
      return chain(MODELS.opus, MODELS.sonnet);
  }
}

export function providerOf(model: string): string {
  return model.split("/")[0] ?? "unknown";
}
