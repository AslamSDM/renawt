/**
 * Plan-level coercion + repair helpers for the engine.
 *
 *   coercePlan(plan)  → runs the lenient block coercion with scene context (headline/body/ordinal), maps
 *                       unknown block names, drops unknown asset ids, and reports the scenes that still fail
 *                       the strict schemas (those go to the engine's LLM `repairScene` agent).
 *   blockGuide(block) → doc + generated data shape + validated example for one block (repair prompt).
 */
import type { ScenePlan } from "@remawt/shared";
import {
  BLOCK_DOCS, BLOCK_SAMPLES, NEEDS_HEADLINE, OVERLAY_DOCS, OVERLAY_SAMPLES, STRICT_BLOCK_SCHEMAS, STRICT_OVERLAY_SCHEMAS,
  isOverlayBlock, resolveBlockName, type BlockName, type OverlayName,
} from "./blocks/schema";
import { coerceData, shapeOf, type CoerceChange } from "./blocks/coerce";

export interface PlanChange { sceneId: string; index: number; path: string; note: string }
export interface PlanIssue { sceneId: string; index: number; block: string; path: string; message: string }
export interface CoercePlanResult { plan: ScenePlan; changes: PlanChange[]; invalid: PlanIssue[] }

type Scene = ScenePlan["scenes"][number];

function strictFor(block: string): { name: string; schema: (typeof STRICT_BLOCK_SCHEMAS)[BlockName] | (typeof STRICT_OVERLAY_SCHEMAS)[OverlayName] } | null {
  const key = String(block).trim().toLowerCase();
  if (isOverlayBlock(key)) return { name: key, schema: STRICT_OVERLAY_SCHEMAS[key as OverlayName] };
  const b = resolveBlockName(block);
  return b ? { name: b, schema: STRICT_BLOCK_SCHEMAS[b] } : null;
}

/** Validate one scene against the strict contract; returns the first issue or null. */
export function sceneIssue(sc: Scene, index: number, assetIds?: Set<string>): PlanIssue | null {
  const p = `plan.scenes[${index}]`;
  const s = strictFor(sc.block);
  if (!s) return { sceneId: sc.id, index, block: sc.block, path: `${p}.block`, message: `unknown block "${sc.block}"` };
  if (NEEDS_HEADLINE[s.name as BlockName] && !sc.headline?.trim()) return { sceneId: sc.id, index, block: s.name, path: `${p}.headline`, message: `block "${s.name}" needs a headline` };
  const r = s.schema.safeParse(sc.data ?? undefined);
  if (!r.success) {
    const iss = r.error.issues[0];
    const path = [`${p}.data`, ...iss.path.map((x) => (typeof x === "number" ? `[${x}]` : `.${String(x)}`))].join("").replace(/\.\[/g, "[");
    return { sceneId: sc.id, index, block: s.name, path, message: iss.message };
  }
  if (assetIds) {
    const bad = (sc.assetIds ?? []).find((id) => !assetIds.has(id));
    if (bad) return { sceneId: sc.id, index, block: s.name, path: `${p}.assetIds`, message: `asset "${bad}" not found` };
  }
  return null;
}

/**
 * Run the lenient coercion with scene context and return a fixed plan, the list of changes, and the scenes
 * that still fail the strict schemas. Pure and deterministic; never throws.
 */
export function coercePlan(plan: ScenePlan, opts: { assetIds?: string[] } = {}): CoercePlanResult {
  const changes: PlanChange[] = [];
  const invalid: PlanIssue[] = [];
  const known = opts.assetIds ? new Set(opts.assetIds) : undefined;
  const ordinals = new Map<string, number>();
  const totals = new Map<string, number>();
  for (const sc of plan.scenes) { const b = resolveBlockName(sc.block); if (b) totals.set(b, (totals.get(b) ?? 0) + 1); }

  const scenes = plan.scenes.map((sc0, index) => {
    const sc: Scene = { ...sc0, assetIds: [...(sc0.assetIds ?? [])] };
    const add = (path: string, note: string) => changes.push({ sceneId: sc.id, index, path: `plan.scenes[${index}].${path}`, note });
    let s = strictFor(sc.block);
    if (!s) {
      const fallback: BlockName = (sc.data as { items?: unknown } | undefined)?.items ? "bullet-stack" : "kinetic-headline";
      add("block", `unknown block "${sc.block}" → "${fallback}"`);
      sc.block = fallback;
      s = strictFor(fallback)!;
    }
    if (NEEDS_HEADLINE[s.name as BlockName] && !sc.headline?.trim()) {
      const d = (sc.data ?? {}) as Record<string, unknown>;
      const h = sc.body ?? (typeof d.text === "string" ? d.text : typeof d.title === "string" ? d.title : undefined);
      if (h) { sc.headline = h; if (h === sc.body) sc.body = undefined; add("headline", "headline ← body/data.text"); }
    }
    if (known) {
      const kept = sc.assetIds.filter((id) => known.has(id));
      if (kept.length !== sc.assetIds.length) { add("assetIds", `dropped unknown asset id(s) ${sc.assetIds.filter((id) => !known.has(id)).join(", ")}`); sc.assetIds = kept; }
    }
    if (s.name === "image" && known) {
      const d = (sc.data ?? {}) as Record<string, unknown>;
      const ids = [...sc.assetIds, ...(typeof d.assetId === "string" ? [d.assetId] : [])];
      if (!ids.some((id) => known.has(id))) {
        // No resolved image (asset search failed or offline): keep the line on screen as type instead of failing.
        const h = sc.headline ?? (typeof d.caption === "string" ? d.caption : undefined) ?? sc.body;
        if (h) {
          add("block", 'image without a resolved asset → "kinetic-headline"');
          sc.block = "kinetic-headline";
          sc.headline = h;
          sc.data = Object.fromEntries(Object.entries(d).filter(([k]) => !["caption", "credit", "kenBurns", "assetId"].includes(k)));
          s = strictFor("kinetic-headline")!;
        }
      }
    }
    const n = (ordinals.get(s.name) ?? 0) + 1;
    ordinals.set(s.name, n);
    const { data, changes: ch } = coerceData(s.name, s.schema, sc.data, { headline: sc.headline, body: sc.body, ordinal: n, total: totals.get(s.name) }, "data");
    ch.forEach((c: CoerceChange) => add(c.path, c.note));
    sc.data = data as Record<string, unknown> | undefined;
    const iss = sceneIssue(sc, index, known);
    if (iss) invalid.push(iss);
    return sc;
  });
  return { plan: { ...plan, scenes }, changes, invalid };
}

export interface BlockGuide { block: string; doc: string; shape: string; example: { headline?: string; body?: string; data: unknown } }

/** Doc + generated data shape + a validated example for one block (or overlay). */
export function blockGuide(block: string): BlockGuide | null {
  const s = strictFor(block);
  if (!s) return null;
  if (isOverlayBlock(s.name)) {
    const k = s.name as OverlayName;
    return { block: k, doc: OVERLAY_DOCS[k], shape: shapeOf(s.schema), example: { data: OVERLAY_SAMPLES[k] } };
  }
  const k = s.name as BlockName;
  const ex = BLOCK_SAMPLES[k];
  return { block: k, doc: BLOCK_DOCS[k], shape: shapeOf(s.schema), example: { headline: ex.headline, body: ex.body, data: ex.data } };
}
