/**
 * JITTER-STYLE VIDEO JSON SCHEMA (prototype)
 *
 * Parallel pipeline to videoJson.ts. Models a Jitter-like document:
 *   artboards -> layers (primitives or groups) + operations[] timeline.
 *
 * Times are MILLISECONDS (Jitter native). Renderer converts to frames via fps.
 */

import { z } from "zod";

const Easing = z
  .enum(["none", "slowDown", "natural", "accelerate"])
  .default("natural");

const FontSchema = z.object({
  type: z.enum(["googlefont", "system"]).default("googlefont"),
  name: z.string().default("Inter"),
  weight: z.number().default(400),
  fontStyle: z.string().default("regular"),
});

const BaseLayerProps = {
  id: z.string(),
  name: z.string().optional(),
  x: z.number().default(0),
  y: z.number().default(0),
  width: z.number().default(100),
  height: z.number().default(100),
  scale: z.number().default(1),
  angle: z.number().default(0),
  opacity: z.number().default(100),
  cornerRadius: z.number().default(0),
};

export const TextLayerSchema = z.object({
  type: z.literal("text"),
  ...BaseLayerProps,
  text: z.string(),
  color: z.string().default("#000000"),
  fontSize: z.number().default(24),
  font: FontSchema.default({}),
  lineHeight: z.number().default(150),
  letterSpacing: z.number().default(0),
  textAlign: z.enum(["left", "center", "right"]).default("left"),
  verticalAlign: z.enum(["top", "center", "bottom"]).default("top"),
  case: z.enum(["normal", "upper", "lower"]).default("normal"),
});

export const ImageLayerSchema = z.object({
  type: z.literal("image"),
  ...BaseLayerProps,
  url: z.string(),
  mediaName: z.string().optional(),
});

export const RectLayerSchema = z.object({
  type: z.literal("rect"),
  ...BaseLayerProps,
  fillColor: z.string().default("#ffffff"),
  shadowEnabled: z.boolean().default(false),
  shadowOffsetX: z.number().default(0),
  shadowOffsetY: z.number().default(0),
  shadowBlur: z.number().default(0),
  shadowColor: z.string().default("#000000"),
  shadowOpacity: z.number().default(50),
});

export const LayerGroupSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    type: z.literal("layerGrp"),
    ...BaseLayerProps,
    background: z.boolean().default(false),
    fillColor: z.string().default("#ffffff"),
    clipsContent: z.boolean().default(false),
    shadowEnabled: z.boolean().default(false),
    shadowOffsetX: z.number().default(0),
    shadowOffsetY: z.number().default(0),
    shadowBlur: z.number().default(0),
    shadowColor: z.string().default("#000000"),
    shadowOpacity: z.number().default(50),
    layers: z.array(LayerSchema),
  }),
);

export const CustomLayerSchema = z.object({
  type: z.literal("custom"),
  ...BaseLayerProps,
  component: z
    .string()
    .regex(/^[A-Z][A-Za-z0-9]*$/, "PascalCase customComponents[].name"),
  props: z.record(z.string(), z.unknown()).default({}),
});

export const LayerSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    TextLayerSchema,
    ImageLayerSchema,
    RectLayerSchema,
    LayerGroupSchema,
    CustomLayerSchema,
  ]),
);

export const JitterCustomComponentSchema = z.object({
  name: z.string().regex(/^[A-Z][A-Za-z0-9]*$/, "PascalCase identifier"),
  source: z
    .string()
    .min(1)
    .describe(
      "Function-component source: `function Name(props) { return ... }`. No imports — React, Remotion (AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring) and basic primitives are in scope.",
    ),
  description: z.string().optional(),
});

const OpBase = {
  id: z.string(),
  targetId: z.string(),
  startTime: z.number(),
  endTime: z.number().optional(),
  easing: Easing,
};

export const GrowInOpSchema = z.object({
  type: z.literal("growIn"),
  ...OpBase,
  scale: z.number().default(0),
});

export const ShrinkOutOpSchema = z.object({
  type: z.literal("shrinkOut"),
  ...OpBase,
  scale: z.number().default(0),
});

export const ResizeOpSchema = z.object({
  type: z.literal("resize"),
  ...OpBase,
  anchor: z
    .enum(["center", "topLeft", "topRight", "bottomLeft", "bottomRight"])
    .default("center"),
  fromValue: z
    .object({ width: z.number().optional(), height: z.number().optional() })
    .optional(),
  toValue: z
    .object({ width: z.number().optional(), height: z.number().optional() })
    .optional(),
});

export const FadeInOpSchema = z.object({
  type: z.literal("fadeIn"),
  ...OpBase,
});

export const FadeOutOpSchema = z.object({
  type: z.literal("fadeOut"),
  ...OpBase,
});

export const SlideInOpSchema = z.object({
  type: z.literal("slideIn"),
  ...OpBase,
  direction: z.enum(["up", "down", "left", "right"]).default("up"),
  distance: z.number().default(40),
});

export const SlideOutOpSchema = z.object({
  type: z.literal("slideOut"),
  ...OpBase,
  direction: z.enum(["up", "down", "left", "right"]).default("down"),
  distance: z.number().default(60),
});

export const PulseOpSchema = z.object({
  type: z.literal("pulse"),
  ...OpBase,
  /** Peak scale increment (1.04 = 4% bigger at peak). */
  scaleAmount: z.number().default(0.04),
  /** Period of one pulse in ms. Default 484ms (≈ 1 beat @ 124 BPM). */
  intervalMs: z.number().default(484),
});

export const TextInOpSchema = z.object({
  type: z.literal("textIn"),
  ...OpBase,
  effect: z.enum(["appear", "slide", "fade"]).default("appear"),
  split: z.enum(["letters", "words", "none"]).default("letters"),
  order: z.enum(["forward", "reverse", "random"]).default("forward"),
  offset: z.number().default(50),
  nodeDuration: z.number().default(500),
  nodeEasing: Easing,
  travelDistance: z.number().default(20),
  slideDirection: z.enum(["up", "down", "left", "right"]).default("up"),
});

export const OperationSchema = z.discriminatedUnion("type", [
  GrowInOpSchema,
  ShrinkOutOpSchema,
  ResizeOpSchema,
  FadeInOpSchema,
  FadeOutOpSchema,
  SlideInOpSchema,
  SlideOutOpSchema,
  PulseOpSchema,
  TextInOpSchema,
]);

export const ArtboardSchema = z.object({
  type: z.literal("artboard").default("artboard"),
  id: z.string(),
  name: z.string().default("Artboard"),
  x: z.number().default(0),
  y: z.number().default(0),
  width: z.number().default(1920),
  height: z.number().default(1080),
  scale: z.number().default(1),
  angle: z.number().default(0),
  opacity: z.number().default(100),
  cornerRadius: z.number().default(0),
  clipsContent: z.boolean().default(true),
  duration: z.number().default(4000),
  fillColor: z.string().default("#ffffff"),
  background: z.boolean().default(true),
  operations: z.array(OperationSchema).default([]),
  layers: z.array(LayerSchema).default([]),
});

export const JitterDocSchema = z.object({
  name: z.string().default("Untitled"),
  fps: z.number().int().positive().default(30),
  audio: z
    .object({
      url: z.string(),
      bpm: z.number().optional(),
      volume: z.number().min(0).max(1).optional(),
    })
    .nullable()
    .optional(),
  /** Optional voice-over narration. Plays mixed with `audio`. */
  narration: z
    .object({
      url: z.string(),
      volume: z.number().min(0).max(1).optional(),
      /** Where the narration starts inside the video (ms). Default 0. */
      startMs: z.number().optional(),
      /** Narration audio length (ms). Used to duck music during the voice window. */
      durationMs: z.number().optional(),
    })
    .nullable()
    .optional(),
  customComponents: z.array(JitterCustomComponentSchema).default([]),
  conf: z.object({
    id: z.string().default("root"),
    version: z.number().default(4),
    artboards: z.array(ArtboardSchema).min(1),
  }),
});

export type Easing = z.infer<typeof Easing>;
export type Operation = z.infer<typeof OperationSchema>;
export type TextLayer = z.infer<typeof TextLayerSchema>;
export type ImageLayer = z.infer<typeof ImageLayerSchema>;
export type RectLayer = z.infer<typeof RectLayerSchema>;
export type LayerGroup = z.infer<typeof LayerGroupSchema>;
export type CustomLayer = z.infer<typeof CustomLayerSchema>;
export type AnyLayer =
  | TextLayer
  | ImageLayer
  | RectLayer
  | LayerGroup
  | CustomLayer;
export type Artboard = z.infer<typeof ArtboardSchema>;
export type JitterCustomComponent = z.infer<typeof JitterCustomComponentSchema>;
export type JitterDoc = z.infer<typeof JitterDocSchema>;

export function msToFrames(ms: number, fps: number): number {
  return Math.round((ms * fps) / 1000);
}

export function artboardDurationFrames(art: Artboard, fps: number): number {
  return Math.max(1, msToFrames(art.duration, fps));
}
