import type { BlockFn } from "../types";
import type { ThreeBlockName } from "./schema";
import { chart3d } from "./chart3d";
import { globe3d } from "./globe3d";
import { stat3d } from "./stat3d";
import { scene3d } from "./scene3d";

/** Three.js blocks (registered in ../index.ts). */
export const THREE_BLOCKS: Record<ThreeBlockName, BlockFn> = {
  "chart-3d": chart3d,
  "globe-3d": globe3d,
  "stat-3d": stat3d,
  "scene-3d": scene3d,
};

export * from "./schema";
export { THREE_CDN, THREE_VERSION, THREE_ATTR, threeScriptTag, palette3d, mixHex } from "./runtime";
export { worldOutlines } from "./globe3d";
export { stat3dText } from "./stat3d";
