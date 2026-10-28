/** tagger (DeepSeek off-peak → Haiku) and ideator (Sonnet), injected as LLM runners into @remawt/radar's refreshNiche / ideasForChannel. */
import type { ZodTypeAny } from "zod";
import { generateStructured, type AgentSpec } from "../llm.js";

export const taggerSpec: AgentSpec = { id: "tagger", name: "Trend tagger", role: "tag", instructions: "You classify short-form video trend items into topic/format/hook taxonomies. Be terse and consistent. JSON only." };
export const ideatorSpec: AgentSpec = { id: "ideator", name: "Ideator", role: "ideate", instructions: "You are a short-form video strategist producing grounded, original video ideas for one channel. Cite evidence links from the provided trend cards only; never invent URLs. Flag risk honestly. JSON only." };

type Prompt = { system: string; prompt: string; maxOutputTokens: number };
export const runTagger = (p: Prompt, schema: ZodTypeAny) => generateStructured({ spec: taggerSpec, label: "radar.tag", schema, prompt: p.prompt, system: p.system, maxOutputTokens: p.maxOutputTokens });
export const runIdeator = (p: Prompt, schema: ZodTypeAny) => generateStructured({ spec: ideatorSpec, label: "radar.ideas", schema, prompt: p.prompt, system: p.system, maxOutputTokens: p.maxOutputTokens });
