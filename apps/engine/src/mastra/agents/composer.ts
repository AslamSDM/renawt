/**
 * HyperFrames composer. The large HF skill/system prompt from hf-kit `buildSystemPrompt` is sent as a
 * cacheable system block (Anthropic 1h prompt cache), so repeated videos for the same kit pay ~5–10% for it.
 * The deterministic hf-kit `composeVideo` output is passed as the baseline the model refines.
 */
import { CompositionSchema, type Composition, type Script, type ScenePlan, type IdentityKit, type FormatTemplate, type Asset } from "@remawt/shared";
import { generateStructured, type AgentSpec } from "../llm.js";
import type { Quality } from "../models.js";
import { hfkit } from "../../lib/hfkit.js";
import { chunkCaptions, type Word } from "../../lib/captions.js";

export const composerSpec: AgentSpec = {
  id: "composer",
  name: "HyperFrames composer",
  role: "compose",
  instructions: `You refine a HyperFrames composition (HTML + GSAP, 1080x1920) for a faceless vertical video.
You receive a working BASELINE composition generated from registry blocks. Improve motion design, hierarchy and pacing while keeping every contract:
- Keep the same scene ids, file names, data-start/data-duration timings, audio tags and caption track. Do not change durations.
- Keep all text legible inside the 9:16 safe area (top 220px and bottom 380px reserved for platform UI; captions sit above the bottom zone).
- Use only fonts, colors and asset URLs already present in the baseline or the kit. No external scripts beyond those already included.
- Deterministic animation only (no Math.random, no Date.now, no network fetches at runtime).
- If FIXES are provided, apply every one of them.
Return the full Composition JSON: {indexHtml, sceneFiles:[{id,fileName,html}], registryBlocks, width, height, fps, durationMs}. JSON only.`,
};

export interface ComposeInput {
  script: Script;
  plan: ScenePlan;
  kit: IdentityKit;
  format: FormatTemplate;
  assets: Asset[];
  words: Word[];
  baseline: Composition;
  fixes?: string[];
}

export async function refineComposition(i: ComposeInput, quality: Quality): Promise<Composition> {
  const cachedSystem = hfkit.buildSystemPrompt({ kit: i.kit, format: i.format, width: i.baseline.width, height: i.baseline.height, durationMs: i.baseline.durationMs });
  const captions = chunkCaptions(i.words).map((c) => ({ text: c.text, s: c.s, e: c.e }));
  const prompt = [
    i.fixes?.length ? `FIXES (mandatory):\n${i.fixes.map((f, k) => `${k + 1}. ${f}`).join("\n")}` : "",
    `SCRIPT TITLE: ${i.script.title}`,
    `SCENE PLAN:\n${JSON.stringify(i.plan.scenes.map((s) => ({ id: s.id, beatId: s.beatId, block: s.block, startMs: s.startMs, durationMs: s.durationMs, headline: s.headline, body: s.body, data: s.data, assetIds: s.assetIds })))}`,
    `ASSETS:\n${JSON.stringify(i.assets.map((a) => ({ id: a.id, kind: a.kind, url: a.url })))}`,
    `CAPTIONS (ms):\n${JSON.stringify(captions)}`,
    `BASELINE COMPOSITION:\n${JSON.stringify(i.baseline)}`,
  ].filter(Boolean).join("\n\n");
  const out = await generateStructured({ spec: composerSpec, quality, label: "compose", schema: CompositionSchema, prompt, cachedSystem, maxOutputTokens: 64000 });
  // Durations are owned by the planner/voice; never let the model drift them.
  return { ...out, width: i.baseline.width, height: i.baseline.height, fps: i.baseline.fps, durationMs: i.baseline.durationMs };
}
