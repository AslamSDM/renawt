import type { BlockFn } from "./types";
import type { BlockName } from "./schema";
import { kineticHeadline } from "./kinetic-headline";
import { diagram } from "./diagram";
import { counter } from "./counter";
import { chart } from "./chart";
import { splitStat, splitTitle } from "./split";
import { headlineCard, numberedCard, sourceCard, strikeThrough } from "./cards";
import { bulletStack, iconGrid } from "./lists";
import { map } from "./map";
import { image, outro } from "./media";
import { videoSegment } from "./video";
import { THREE_BLOCKS } from "./three/index";

export const BLOCKS: Record<BlockName, BlockFn> = {
  "kinetic-headline": kineticHeadline,
  diagram,
  counter,
  chart,
  "split-title": splitTitle,
  "split-stat": splitStat,
  "numbered-card": numberedCard,
  "strike-through": strikeThrough,
  "source-card": sourceCard,
  "headline-card": headlineCard,
  "bullet-stack": bulletStack,
  map,
  "icon-grid": iconGrid,
  image,
  outro,
  "video-segment": videoSegment,
  ...THREE_BLOCKS,
};

export * from "./schema";
export type { BlockCtx, BlockOutput, BlockFn } from "./types";
export { iconSvg, iconExists } from "./icons";
export { resolveRegions } from "./map";
export { KEN_BURNS_MAX } from "./media";
export * from "./coerce";
export { THREE_CDN, THREE_VERSION, THREE_ATTR, THREE_BLOCK_NAMES, isThreeBlock, threeScriptTag } from "./three/index";

// Hand-drawn skins (skin.handdrawn): blocks with a sketch variant render through src/sketch.
import { renderSketchBlock } from "../sketch/index";
for (const [name, fn] of Object.entries(BLOCKS) as Array<[BlockName, BlockFn]>) {
  BLOCKS[name] = (ctx) => ((ctx.skin as { handdrawn?: boolean }).handdrawn && renderSketchBlock(name, ctx)) || fn(ctx);
}
