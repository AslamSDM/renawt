import type { BlockCtx, BlockOutput } from "../blocks/types";
import { hash } from "../util";
import { Board, buildUnits } from "./board";
import { schedule, sketchTimeline, type DrawUnit, type Schedule } from "./draw";
import { renderSvgs, type RenderedSvg, type SvgJob } from "./excalidraw";
import { sketchPalette } from "../skin/sketch";

/** A hand-drawn scene: one Board per page. Pages draw one after another inside the scene. */
export interface SketchDoc { pages: Board[] }

/** Max hand-written lines on one page (a block with more text paginates). */
export const MAX_LINES_PER_PAGE = 7;
/** Smallest font for body lines. */
export const MIN_BODY = 44;

export function newBoard(ctx: BlockCtx<any>, page: number): Board {
  const seed = parseInt(hash(`${ctx.sid}:${page}`, 8), 16) % 2147483647;
  return new Board(`${ctx.sid}-`, seed || 7, sketchPalette(ctx.skin).ink);
}

export function docJobs(ctx: BlockCtx, doc: SketchDoc): SvgJob[] {
  return doc.pages.map((b, k) => ({ prefix: `${ctx.sid}-p${k}`, width: ctx.width, height: ctx.height, elements: b.elements }));
}

/** Draw units for a rendered page (element order; hachure fills drawn after their outline). */
export function pageUnits(board: Board, rendered: RenderedSvg, page: number): DrawUnit[] {
  return buildUnits(board.elements).map((idx) => {
    const els = idx.map((i) => board.elements[i]);
    const first = els[0];
    if (first.type === "text") {
      return { kind: "text", strokes: [], fills: [], texts: idx.map((i) => ({ id: rendered.els[i].text!, chars: String(board.elements[i].text ?? "").length })), page, pauseAfter: first.customData?.pauseAfter, speed: first.customData?.speed };
    }
    const strokes: DrawUnit["strokes"] = [];
    const fills: string[] = [];
    for (const i of idx) {
      const el = board.elements[i];
      const r = rendered.els[i];
      const hasHachure = el.backgroundColor !== "transparent" && el.fillStyle !== "solid" && r.strokes.length > 1;
      const ss = r.strokes.map((s, k) => ({ ...s, fill: hasHachure && k === 0 }));
      strokes.push(...ss.filter((s) => !s.fill), ...ss.filter((s) => s.fill));
      fills.push(...r.fills);
    }
    const last = els[els.length - 1];
    return { kind: "shape", strokes, fills, page, pauseAfter: last.customData?.pauseAfter, speed: first.customData?.speed };
  });
}

export interface SketchRender extends BlockOutput { units: DrawUnit[]; schedule: Schedule }

/** Drawing window inside the scene: start after the entrance, end with time to read the last line. */
export function drawWindow(ctx: BlockCtx): { t0: number; t1: number } {
  const t0 = ctx.isFirst ? 0.1 : 0.3;
  const hold = Math.min(1.2, Math.max(0.5, ctx.durationS * 0.12));
  return { t0, t1: Math.max(t0 + 0.4, ctx.durationS - hold) };
}

export function renderDoc(ctx: BlockCtx, doc: SketchDoc): SketchRender {
  const { sid, width, height } = ctx;
  const rendered = renderSvgs(docJobs(ctx, doc));
  const units = doc.pages.flatMap((b, k) => pageUnits(b, rendered[k], k));
  const sch = schedule(units, drawWindow(ctx));
  const pageIds = doc.pages.map((_, k) => `${sid}-pg${k}`);
  const html = rendered.map((r, k) => `<div id="${pageIds[k]}" class="${sid}-pg">${cleanSvg(r.svg)}</div>`).join("\n      ");
  const css = `
    .${sid}-pg { position: absolute; left: 0; top: 0; width: ${width}px; height: ${height}px; }
    .${sid}-pg > svg { position: absolute; left: 0; top: 0; overflow: visible; }
  `;
  return { html, css, timeline: sketchTimeline(units, sch, pageIds), units, schedule: sch };
}

/** Drop Excalidraw's empty font <defs> and the source comment. */
function cleanSvg(svg: string): string {
  return svg.replace(/<!--[\s\S]*?-->/g, "").replace(/<defs>\s*<style class="style-fonts">\s*<\/style>\s*<\/defs>/, "");
}
