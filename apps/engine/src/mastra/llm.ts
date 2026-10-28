/**
 * Agent factory + structured generation helper shared by all agents.
 *  - One Agent instance per (agentId, quality), cached, with the role's fallback chain.
 *  - `generateStructured` asks for schema-shaped JSON via Mastra structuredOutput, validates with zod,
 *    repairs malformed JSON (jsonrepair) and retries once with the validation error as feedback.
 *  - Optional cacheable system prompt (Anthropic 1h prompt cache) via providerOptions on the system message.
 * Never sets temperature/top_p (Claude 5.5 models reject non-default sampling params).
 */
import { Agent } from "@mastra/core/agent";
import { jsonrepair } from "jsonrepair";
import type { z } from "zod";
import { modelsFor, type ModelRole, type Quality } from "./models.js";
import { withUsageLogging } from "./usage.js";
import { withCallContext } from "../lib/context.js";
import { log } from "../lib/logger.js";

export interface AgentSpec { id: string; name: string; role: ModelRole; instructions: string }

const agents = new Map<string, Agent>();

export function getAgent(spec: AgentSpec, quality: Quality = "standard"): Agent {
  const key = `${spec.id}:${quality}`;
  let a = agents.get(key);
  if (!a) {
    a = new Agent({ id: quality === "standard" ? spec.id : `${spec.id}-${quality}`, name: spec.name, instructions: spec.instructions, model: modelsFor(spec.role, quality) });
    agents.set(key, a);
  }
  return a;
}

export type ContentPart = { type: "text"; text: string } | { type: "image"; image: string | URL; mimeType?: string };

export interface StructuredCall<S extends z.ZodTypeAny> {
  spec: AgentSpec;
  quality?: Quality;
  label: string;
  schema: S;
  prompt: string | ContentPart[];
  /** Large, stable per-kit system prompt → sent as a cacheable system message (Anthropic 1h TTL). */
  cachedSystem?: string;
  /** Extra (uncached) instructions appended for this call. */
  system?: string;
  maxOutputTokens?: number;
  retries?: number;
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text.slice(Math.max(0, text.search(/[[{]/)));
  return JSON.parse(jsonrepair(body.trim()));
}

export async function generateStructured<S extends z.ZodTypeAny>(call: StructuredCall<S>): Promise<z.infer<S>> {
  const quality = call.quality ?? "standard";
  const agent = getAgent(call.spec, quality);
  const chain = modelsFor(call.spec.role, quality);
  const retries = call.retries ?? 1;
  let feedback = "";
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const userContent: ContentPart[] = typeof call.prompt === "string" ? [{ type: "text", text: call.prompt }] : [...call.prompt];
    if (feedback) userContent.push({ type: "text", text: `Your previous answer failed validation:\n${feedback}\nReturn corrected JSON only.` });

    const instructions = call.cachedSystem
      ? [
          { role: "system" as const, content: call.cachedSystem, providerOptions: { anthropic: { cacheControl: { type: "ephemeral", ttl: "1h" } } } },
          { role: "system" as const, content: `${call.spec.instructions}${call.system ? `\n\n${call.system}` : ""}` },
        ]
      : call.system
        ? `${call.spec.instructions}\n\n${call.system}`
        : undefined;

    try {
      const result = await withCallContext({ label: call.label }, () =>
        withUsageLogging(call.label, chain[0].model, () =>
          agent.generate([{ role: "user", content: userContent }] as never, {
            ...(instructions ? { instructions: instructions as never } : {}),
            structuredOutput: { schema: call.schema, jsonPromptInjection: true, errorStrategy: "warn" },
            modelSettings: { maxOutputTokens: call.maxOutputTokens ?? 16000 },
          } as never),
        ),
      );
      const r = result as unknown as { object?: unknown; text?: string };
      const candidates: unknown[] = [];
      if (r.object !== undefined && r.object !== null) candidates.push(r.object);
      if (r.text) {
        try { candidates.push(extractJson(r.text)); } catch { /* ignore */ }
      }
      for (const c of candidates) {
        const parsed = call.schema.safeParse(c);
        if (parsed.success) return parsed.data;
        feedback = parsed.error.issues.slice(0, 12).map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
      }
      if (!candidates.length) feedback = "No JSON object found in the response.";
      lastErr = new Error(`${call.label}: schema validation failed: ${feedback}`);
    } catch (e) {
      lastErr = e;
      feedback = "";
    }
    log.warn("structured generation retry", { label: call.label, attempt, feedback: feedback.slice(0, 300) });
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
