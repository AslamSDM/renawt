import type { Asset, IdentityKit, VisualSkin } from "@remawt/shared";
import type { Box, MotionPreset, TypeScale } from "../skin/index";
import type { Anim } from "../anim";

export interface BlockCtx<D = Record<string, unknown>> {
  /** Scene / composition id; prefix every element id and class with it. */
  sid: string;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  headline?: string;
  body?: string;
  /** Validated `scene.data` for this block. */
  data: D;
  durationS: number;
  width: number;
  height: number;
  skin: VisualSkin;
  kit?: IdentityKit;
  motion: MotionPreset;
  type: TypeScale;
  /** Safe content box (inside UI-safe zone, above captions). */
  box: Box;
  /** Assets attached to this scene (scene.assetIds resolved). */
  assets: Asset[];
  anim: Anim;
  fps?: number;
  /** video-segment: keep the footage's own sound (no separate speech track). */
  videoHasAudio?: boolean;
}

export interface BlockOutput {
  /** Markup placed inside `#<sid>-stage`. */
  html: string;
  /** CSS (scoped by prefixed ids/classes). */
  css: string;
  /** JS statements using the scene's paused timeline `tl`. */
  timeline: string;
}

export type BlockFn<D = any> = (ctx: BlockCtx<D>) => BlockOutput;
