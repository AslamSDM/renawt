/**
 * Text budgets: how much user text each block can show inside its boxes on a 1080×1920 canvas.
 *
 * One source of truth for three consumers:
 *   - the planner catalogue (prompts/index.ts appends `textBudgetNote(block)` to each block entry),
 *   - plan lint (lint.ts `lintPlanText`), which estimates the rendered width with the SAME estimator
 *     and fitter the blocks use (blocks/common.ts fitLines / estWidth) and reports PlanIssue-shaped
 *     errors the repair loop (engine repairScene) can act on,
 *   - the blocks themselves, which fit (shrink → wrap → ellipsis) and mark truncated text with
 *     data-fit="truncated" (lintComposition reports those).
 */
import type { ScenePlan } from "@remawt/shared";
import { fitLines, type FitOpts } from "./blocks/common";
import { DIAGRAM_TEXT, diagramGeometry, fitNodeText } from "./blocks/diagram";
import { LIST_TEXT } from "./blocks/lists";
import { SPLIT_TEXT } from "./blocks/split";
import { resolveBlockName } from "./blocks/schema";
import { contentBox } from "./skin/index";

export interface TextIssue { sceneId: string; index: number; block: string; path: string; message: string }

/** A text field of a block: where it lives in data, its char budget and the box it is fitted into. */
interface Field { path: string; role: string; max: number; fit?: Omit<FitOpts, "base"> & { base: number } }

const BOX = contentBox(1080, 1920);

/** Per-block fields (non-diagram). `[]` = every array item; `|text` = string item or item.text. */
const FIELDS: Record<string, Field[]> = {
  "bullet-stack": [
    { path: "items[]|text", role: "bullet-stack item", max: LIST_TEXT.bullet, fit: { maxWidth: BOX.w - 206, maxLines: 2, base: 56, min: 34, weight: 800 } },
    { path: "items[].sub", role: "bullet-stack item sub", max: LIST_TEXT.bulletSub, fit: { maxWidth: BOX.w - 206, maxLines: 2, base: 36, min: 26 } },
  ],
  "icon-grid": [{ path: "items[].label", role: "icon-grid label", max: LIST_TEXT.tile, fit: { maxWidth: (BOX.w - 56) / 3 - 48, maxLines: 2, base: 36, min: 24, weight: 700 } }],
  "split-title": ["left", "right"].flatMap((s) => [
    { path: `${s}.label`, role: "split-title label", max: SPLIT_TEXT.label, fit: { maxWidth: BOX.w - 296, maxLines: 2, base: 124, min: 48, weight: 900 } },
    { path: `${s}.sub`, role: "split-title sub", max: SPLIT_TEXT.sub },
  ]),
  "split-stat": [
    { path: "rounds[].metric", role: "split-stat metric", max: SPLIT_TEXT.metric, fit: { maxWidth: BOX.w, maxLines: 2, base: 72, min: 40, weight: 800 } },
    { path: "left.label", role: "split-stat side label", max: SPLIT_TEXT.label, fit: { maxWidth: (BOX.w - 60) / 2 - 56, maxLines: 1, base: 36, min: 24, weight: 700 } },
    { path: "right.label", role: "split-stat side label", max: SPLIT_TEXT.label, fit: { maxWidth: (BOX.w - 60) / 2 - 56, maxLines: 1, base: 36, min: 24, weight: 700 } },
  ],
  counter: [{ path: "label", role: "counter label", max: 48, fit: { maxWidth: BOX.w, maxLines: 2, base: 44, min: 30 } }],
  "numbered-card": [
    { path: "title", role: "numbered-card title", max: 40, fit: { maxWidth: BOX.w - 120, maxLines: 3, base: 96, min: 44, weight: 800 } },
    { path: "body", role: "numbered-card body", max: 90, fit: { maxWidth: BOX.w - 120, maxLines: 3, base: 44, min: 30 } },
  ],
};

/** One line for the planner catalogue: the char budgets of a block's on-screen text. */
export function textBudgetNote(block: string): string {
  if (block === "diagram") return `text budget: node label ≤ ${DIAGRAM_TEXT.label} chars, node sub ≤ ${DIAGRAM_TEXT.sub} chars, edge label ≤ ${DIAGRAM_TEXT.edge} chars; 2–6 nodes (1 node reads as a lone box: use kinetic-headline instead).`;
  const f = FIELDS[block];
  if (!f) return "";
  const seen = new Set<string>();
  const parts = f.filter((x) => !seen.has(x.role) && seen.add(x.role)).map((x) => `${x.role} ≤ ${x.max} chars`);
  return `text budget: ${parts.join(", ")}.`;
}

/** Resolve `items[]|text`-style paths to [jsonPath, value] pairs. */
function values(data: unknown, path: string): Array<[string, string]> {
  const [p, alt] = path.split("|");
  let cur: Array<[string, unknown]> = [["", data]];
  for (const seg of p.split(".")) {
    const arr = seg.endsWith("[]");
    const key = arr ? seg.slice(0, -2) : seg;
    const next: Array<[string, unknown]> = [];
    for (const [jp, v] of cur) {
      const child = v && typeof v === "object" ? (v as Record<string, unknown>)[key] : undefined;
      if (child === undefined || child === null) continue;
      if (arr && Array.isArray(child)) child.forEach((c, i) => next.push([`${jp}.${key}[${i}]`, c]));
      else if (!arr) next.push([`${jp}.${key}`, child]);
    }
    cur = next;
  }
  return cur.flatMap(([jp, v]): Array<[string, string]> => {
    if (typeof v === "string") return [[jp, v]];
    if (alt && v && typeof v === "object" && typeof (v as Record<string, unknown>)[alt] === "string") return [[`${jp}.${alt}`, (v as Record<string, string>)[alt]]];
    return [];
  });
}

const msg = (text: string, role: string, max: number, why: string) =>
  `"${text}" is ${text.length} chars; ${role} allows ≤ ${max} (${why}). Shorten it to ≤ ${max} chars, keeping the meaning.`;

/** Text-fit issues for one scene (empty when every label fits its box). */
export function sceneTextIssues(sc: ScenePlan["scenes"][number], index: number): TextIssue[] {
  const block = resolveBlockName(sc.block);
  if (!block) return [];
  const out: TextIssue[] = [];
  const base = `plan.scenes[${index}].data`;
  const add = (path: string, message: string) => out.push({ sceneId: sc.id, index, block, path: `${base}${path}`, message });
  const data = (sc.data ?? {}) as Record<string, unknown>;

  if (block === "diagram") {
    const nodes = Array.isArray(data.nodes) ? (data.nodes as Array<{ id: string; label: string; sub?: string; icon?: string }>).filter((n) => n && typeof n.label === "string") : [];
    if (!nodes.length) return out;
    const edges = Array.isArray(data.edges) ? (data.edges as Array<{ from: string; to: string; label?: string }>) : [];
    const titleH = sc.headline ? 214 : 0;
    const area = { x: BOX.x, y: BOX.y + titleH, w: BOX.w, h: BOX.h - titleH };
    const g = diagramGeometry({ layout: typeof data.layout === "string" ? data.layout : "auto", nodes, edges }, area, { portrait: true });
    nodes.forEach((nd, i) => {
      const f = fitNodeText(nd, g.rects[i], g.layout === "single");
      const box = `${Math.round(g.rects[i].w)}×${Math.round(g.rects[i].h)}px ${g.layout} box`;
      if (nd.label.length > DIAGRAM_TEXT.label || f.label.truncated) add(`.nodes[${i}].label`, msg(nd.label, "diagram node label", DIAGRAM_TEXT.label, f.label.truncated ? `it would be cut with "…" in its ${box}` : "longer labels shrink too small to read"));
      if (nd.sub && (nd.sub.length > DIAGRAM_TEXT.sub || f.sub?.truncated)) add(`.nodes[${i}].sub`, msg(nd.sub, "diagram node sub", DIAGRAM_TEXT.sub, f.sub?.truncated ? `it would be cut with "…" in its ${box}` : "it would wrap past its box"));
    });
    edges.forEach((e, k) => {
      if (e?.label && e.label.length > DIAGRAM_TEXT.edge) add(`.edges[${k}].label`, msg(e.label, "diagram edge label", DIAGRAM_TEXT.edge, "edge labels sit beside a short arrow"));
    });
    return out;
  }

  for (const f of FIELDS[block] ?? []) {
    for (const [jp, text] of values(data, f.path)) {
      const fitted = f.fit ? fitLines(text, f.fit) : null;
      if (fitted?.truncated) add(jp, msg(text, f.role, f.max, `it would be cut with "…" at the smallest size`));
      else if (text.length > f.max) add(jp, msg(text, f.role, f.max, "longer text shrinks too small to read"));
    }
  }
  return out;
}

/** Text-fit issues for every scene of a plan. */
export function planTextIssues(plan: ScenePlan): TextIssue[] {
  return plan.scenes.flatMap((sc, i) => sceneTextIssues(sc, i));
}
