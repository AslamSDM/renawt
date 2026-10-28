/**
 * Hand-drawn ("Sketch", Excalidraw-style) block renderers.
 *
 * When `ctx.skin.handdrawn` is true, blocks build an Excalidraw element list (Board, the TS port of
 * contentgen `exdraw.py`), Excalidraw's own `exportToSvg` turns it into static rough SVG (seeded,
 * deterministic), and `draw.ts` writes GSAP that draws it stroke by stroke and hand-writes text one
 * LINE at a time. Blocks without a sketch variant (map, icon-grid, image, video-segment) keep their
 * normal renderer.
 */
import type { BlockCtx, BlockOutput } from "../blocks/types";
import type { BlockName } from "../blocks/schema";
import { isHanddrawn } from "../skin/sketch";
import { docJobs, renderDoc, type SketchDoc, type SketchRender } from "./doc";
import { renderSvgs } from "./excalidraw";
import { skChart } from "./blocks/chart";
import { skDiagram } from "./blocks/diagram";
import { skBullets, skNumbered } from "./blocks/lists";
import { skSplitStat, skSplitTitle } from "./blocks/split";
import { skCounter, skHeadline, skNews, skOutro, skSource, skStrike } from "./blocks/text";

type Builder = (ctx: BlockCtx<any>) => SketchDoc;

export const SKETCH_BLOCKS: Partial<Record<BlockName, Builder>> = {
  "kinetic-headline": skHeadline,
  diagram: skDiagram,
  counter: skCounter,
  chart: skChart,
  "split-title": skSplitTitle,
  "split-stat": skSplitStat,
  "numbered-card": skNumbered,
  "strike-through": skStrike,
  "source-card": skSource,
  "headline-card": skNews,
  "bullet-stack": skBullets,
  outro: skOutro,
};

export function hasSketchVariant(block: string): boolean {
  return block in SKETCH_BLOCKS;
}

/** The hand-drawn document for a block, or null when the block has no sketch variant. */
export function sketchDoc(block: string, ctx: BlockCtx): SketchDoc | null {
  const fn = SKETCH_BLOCKS[block as BlockName];
  return fn ? fn(ctx) : null;
}

/** Hand-drawn render of a block: same `{html, css, timeline}` shape as normal blocks, or null. */
export function renderSketchBlock(block: string, ctx: BlockCtx): SketchRender | null {
  const doc = sketchDoc(block, ctx);
  return doc ? renderDoc(ctx, doc) : null;
}

/**
 * Render every scene's Excalidraw SVGs in ONE headless Chrome (the render is cached), so the
 * per-scene `renderSketchBlock` calls that follow are cache hits. Optional: without it each scene
 * starts its own Chrome. Call with the same ctx each scene will get.
 */
export function prerenderSketch(items: Array<{ block: string; ctx: BlockCtx }>): void {
  const jobs = items.flatMap(({ block, ctx }) => {
    if (!isHanddrawn(ctx.skin)) return [];
    const doc = sketchDoc(block, ctx);
    return doc ? docJobs(ctx, doc) : [];
  });
  if (jobs.length) renderSvgs(jobs);
}

export { isHanddrawn };
export type { BlockOutput, SketchDoc, SketchRender };
export { Board, buildUnits, measureText, wrapText, fitText, mulberry32 } from "./board";
export { schedule, sketchTimeline, naturalDuration, STROKE_SPEED, WRITE_CPS, type DrawUnit, type Schedule } from "./draw";
export { renderSvgs, jobKey } from "./excalidraw";
