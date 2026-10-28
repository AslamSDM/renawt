/**
 * composeWithRepair: hf-kit composeVideo with a 3-stage repair path for plan/schema faults.
 *   1. composeVideo(plan)                       → "clean"   (hf-kit's block schemas are already lenient)
 *   2. hfkit.coercePlan(plan) + composeVideo    → "coerced" (context-aware fixes: unknown blocks, tip numbers, asset ids)
 *   3. repairScene (Haiku) per still-invalid scene, ≤ 2 attempts each, then composeVideo → "llm"
 *   otherwise throws ComposeRepairError (outcome "failed") with the repair log attached.
 * Only ComposeError (plan/data faults) enters the repair path; anything else is rethrown untouched.
 */
import type { Composition, ScenePlan } from "@remawt/shared";
import { hfkit, type ComposeVideoInput, type PlanIssue } from "../hfkit.js";
import { log, errMsg } from "../logger.js";
import type { RepairInput, RepairOutput } from "../../mastra/agents/repair.js";

export type ComposeOutcome = "clean" | "coerced" | "llm" | "failed";

export interface RepairLogEntry {
  stage: "coerce" | "llm";
  sceneId: string;
  path: string;
  note: string;
  attempt?: number;
  ok?: boolean;
}

export interface ComposeRepairResult {
  comp: Composition;
  plan: ScenePlan;
  outcome: Exclude<ComposeOutcome, "failed">;
  repairs: RepairLogEntry[];
  firstError?: string;
}

export class ComposeRepairError extends Error {
  constructor(message: string, public repairs: RepairLogEntry[], public firstError: string) {
    super(message);
    this.name = "ComposeRepairError";
  }
}

export interface RepairOptions {
  /** LLM scene repair; omit/null to disable stage 3 (e.g. no ANTHROPIC_API_KEY). */
  repairScene?: ((i: RepairInput) => Promise<RepairOutput>) | null;
  maxAttemptsPerScene?: number;
  onEvent?: (message: string) => void | Promise<void>;
}

const isComposeError = (e: unknown): e is Error & { path: string } => e instanceof Error && e.name === "ComposeError";

/** Map a ComposeError path back to a scene issue (used when coercePlan thinks a plan is fine but compose disagrees). */
function issueFromError(plan: ScenePlan, e: Error & { path: string }): PlanIssue | null {
  const m = e.path.match(/^plan\.scenes\[(\d+)\]/);
  if (!m) return null;
  const index = Number(m[1]);
  const sc = plan.scenes[index];
  return sc ? { sceneId: sc.id, index, block: sc.block, path: e.path, message: e.message.replace(`${e.path}: `, "") } : null;
}

export async function composeWithRepair(input: ComposeVideoInput, opts: RepairOptions = {}): Promise<ComposeRepairResult> {
  const repairs: RepairLogEntry[] = [];
  const emit = async (m: string) => { try { await opts.onEvent?.(m); } catch { /* progress is best effort */ } };
  let firstError: string;
  try {
    return { comp: hfkit.composeVideo(input), plan: input.plan, outcome: "clean", repairs };
  } catch (e) {
    if (!isComposeError(e)) throw e;
    firstError = e.message;
  }
  log.warn("compose failed; coercing plan", { err: firstError });

  // Stage 2: deterministic coercion with scene context.
  const assetIds = [...(input.assets ?? []).map((a) => a.id), ...(input.media?.userVideo ? [input.media.userVideo.id] : [])];
  const co = hfkit.coercePlan(input.plan, { assetIds });
  for (const c of co.changes) repairs.push({ stage: "coerce", sceneId: c.sceneId, path: c.path, note: c.note });
  let plan = co.plan;
  let invalid = co.invalid;
  await emit(`coerced plan: ${co.changes.length} change(s), ${invalid.length} scene(s) still invalid`);
  if (!invalid.length) {
    try {
      return { comp: hfkit.composeVideo({ ...input, plan }), plan, outcome: "coerced", repairs, firstError };
    } catch (e) {
      if (!isComposeError(e)) throw e;
      const iss = issueFromError(plan, e);
      if (!iss) throw new ComposeRepairError(`compose failed after coercion: ${e.message}`, repairs, firstError);
      invalid = [iss];
    }
  }

  // Stage 3: LLM repair of the scenes that are still invalid.
  if (!opts.repairScene) throw new ComposeRepairError(`compose failed; no LLM repair available: ${invalid.map((i) => `${i.path}: ${i.message}`).join("; ")}`, repairs, firstError);
  const max = opts.maxAttemptsPerScene ?? 2;
  for (let round = 0; round < 3 && invalid.length; round++) {
    const fixed = await Promise.all(invalid.map(async (iss) => {
      let scene = plan.scenes[iss.index];
      let issue: PlanIssue | null = iss;
      let prev: string | undefined;
      for (let attempt = 1; attempt <= max && issue; attempt++) {
        try {
          const out = await opts.repairScene!({ scene: { id: scene.id, block: scene.block, headline: scene.headline, body: scene.body, data: scene.data }, issue, attempt, previousError: prev });
          const candidate = { ...scene, block: out.block || scene.block, headline: out.headline ?? scene.headline, body: out.body ?? scene.body, data: out.data };
          // Coerce the LLM's answer too (cheap insurance), then check the single scene strictly.
          const one = hfkit.coercePlan({ ...plan, scenes: [candidate] }, { assetIds });
          const next = one.plan.scenes[0];
          const left = hfkit.sceneIssue(next, iss.index, new Set(assetIds));
          repairs.push({ stage: "llm", sceneId: scene.id, path: iss.path, note: left ? `still invalid: ${left.path}: ${left.message}` : `fixed (${next.block})`, attempt, ok: !left });
          if (!left) { scene = next; issue = null; break; }
          prev = `${left.path.replace(/^plan\.scenes\[\d+\]\./, "")}: ${left.message}`;
        } catch (e) {
          prev = errMsg(e);
          repairs.push({ stage: "llm", sceneId: scene.id, path: iss.path, note: `repair call failed: ${prev}`, attempt, ok: false });
        }
      }
      return { iss, scene, ok: !issue };
    }));
    const failed = fixed.filter((f) => !f.ok);
    if (failed.length) {
      await emit(`LLM repair failed for ${failed.map((f) => f.iss.sceneId).join(", ")}`);
      throw new ComposeRepairError(`compose failed after LLM repair: ${failed.map((f) => `${f.iss.path}: ${f.iss.message}`).join("; ")}`, repairs, firstError);
    }
    const scenes = [...plan.scenes];
    for (const f of fixed) scenes[f.iss.index] = f.scene;
    plan = { ...plan, scenes };
    await emit(`LLM repaired ${fixed.length} scene(s)`);
    try {
      return { comp: hfkit.composeVideo({ ...input, plan }), plan, outcome: "llm", repairs, firstError };
    } catch (e) {
      if (!isComposeError(e)) throw e;
      const iss = issueFromError(plan, e);
      if (!iss) throw new ComposeRepairError(`compose failed after LLM repair: ${e.message}`, repairs, firstError);
      invalid = [iss];
    }
  }
  throw new ComposeRepairError(`compose failed after repair rounds: ${invalid.map((i) => `${i.path}: ${i.message}`).join("; ")}`, repairs, firstError);
}
