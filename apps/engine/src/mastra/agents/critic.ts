import { z } from "zod";
import type { Composition } from "@remawt/shared";
import { generateStructured, type AgentSpec, type ContentPart } from "../llm.js";
import type { Quality } from "../models.js";
import type { LintReport } from "../../lib/hfkit.js";

export const CriticOutputSchema = z.object({
  pass: z.boolean(),
  fixes: z.array(z.object({ sceneId: z.string().optional(), issue: z.string(), fix: z.string(), severity: z.enum(["blocker", "major", "minor"]) })),
  notes: z.string().optional(),
});
export type CriticOutput = z.infer<typeof CriticOutputSchema>;

export const criticSpec: AgentSpec = {
  id: "critic",
  name: "Composition critic",
  role: "critic",
  instructions: `You review a HyperFrames 1080x1920 composition for a faceless short-form video.
Inputs: the linter report, a compact view of the composition, and optionally rendered keyframes.
Flag only concrete, fixable problems: lint errors, text overflowing or outside the 9:16 safe area, illegible contrast,
overlapping elements, empty frames, captions colliding with content, timing drift vs scene data, broken asset references,
off-brand colors/fonts. Every lint error must become a "blocker" fix. Each fix is one imperative sentence a developer can apply.
pass=true only when there are no blocker or major issues. JSON only.`,
};

export async function critique(opts: { comp: Composition; lint: LintReport; keyframes?: Array<{ url: string; atMs: number }> }, quality: Quality): Promise<CriticOutput> {
  const compact = {
    durationMs: opts.comp.durationMs,
    registryBlocks: opts.comp.registryBlocks,
    indexHtml: opts.comp.indexHtml.slice(0, 12000),
    scenes: opts.comp.sceneFiles.map((s) => ({ id: s.id, fileName: s.fileName, html: s.html.slice(0, 4000) })),
  };
  const parts: ContentPart[] = [
    { type: "text", text: `LINT REPORT:\n${JSON.stringify(opts.lint)}\n\nCOMPOSITION:\n${JSON.stringify(compact)}` },
  ];
  for (const k of opts.keyframes ?? []) {
    parts.push({ type: "text", text: `Keyframe at ${k.atMs}ms:` });
    parts.push({ type: "image", image: new URL(k.url) });
  }
  return generateStructured({ spec: criticSpec, quality, label: "critic", schema: CriticOutputSchema, prompt: parts, maxOutputTokens: 6000 });
}
