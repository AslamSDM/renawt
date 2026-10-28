/**
 * repairScene: cheap (Haiku) structured fix for ONE scene whose data still fails hf-kit's strict block schema
 * after deterministic coercion. Input = the scene JSON, the failing path + message, and the block's generated
 * shape + valid example (hf-kit `blockGuide`). Output = the corrected scene content (block/headline/body/data).
 */
import { z } from "zod";
import { generateStructured, type AgentSpec } from "../llm.js";
import { hfkit } from "../../lib/hfkit.js";

export const RepairOutputSchema = z.object({
  block: z.string(),
  headline: z.string().optional(),
  body: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
});
export type RepairOutput = z.infer<typeof RepairOutputSchema>;

export const repairSpec: AgentSpec = {
  id: "repairScene",
  name: "Scene data repair",
  role: "repair",
  instructions: `You fix one scene of a video scene plan so its "data" validates against the block's schema.
Keep the scene's meaning, wording and numbers; change only the structure needed to make it valid.
${hfkit.DATA_SHAPE_RULE}
If the block cannot express the content, you may switch "block" to a better-fitting block from the list given, and then data must match that block's shape.
Return JSON only: {"block": "...", "headline": "...", "body": "...", "data": {...}}.`,
};

export interface RepairInput {
  scene: { id: string; block: string; headline?: string; body?: string; data?: unknown };
  issue: { path: string; message: string };
  attempt: number;
  previousError?: string;
}

export function buildRepairPrompt(i: RepairInput): string {
  const g = hfkit.blockGuide(i.scene.block);
  return [
    `SCENE:\n${JSON.stringify({ block: i.scene.block, headline: i.scene.headline, body: i.scene.body, data: i.scene.data ?? {} })}`,
    `VALIDATION ERROR: ${i.issue.path}: ${i.issue.message}`,
    i.previousError ? `YOUR PREVIOUS FIX STILL FAILED: ${i.previousError}` : "",
    g ? `BLOCK "${g.block}": ${g.doc}\ndata shape: ${g.shape}\nvalid example: ${JSON.stringify(g.example)}` : `Unknown block. Known blocks: ${hfkit.BLOCK_NAMES.join(", ")}`,
    `Other blocks you may switch to: ${hfkit.BLOCK_NAMES.filter((b) => b !== "video-segment" && b !== "image").join(", ")}`,
  ].filter(Boolean).join("\n\n");
}

export async function repairScene(i: RepairInput): Promise<RepairOutput> {
  return generateStructured({ spec: repairSpec, quality: "standard", label: "repairScene", schema: RepairOutputSchema, prompt: buildRepairPrompt(i), maxOutputTokens: 3000, retries: 0 });
}
