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
  font: FontSchema.default({
    type: "googlefont",
    name: "Inter",
    weight: 400,
    fontStyle: "regular",
  }),
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

/** Text rendered as a flattened SVG (Jitter `textImg`). Treated like an image. */
export const TextImgLayerSchema = z.object({
  type: z.literal("textImg"),
  ...BaseLayerProps,
  /** Base64/data-uri SVG of the rasterized text (Jitter `textVector`). */
  url: z.string().optional(),
  textVector: z.string().optional(),
  text: z.string().optional(),
  mediaName: z.string().optional(),
});

/** Looping animated GIF — rendered with Remotion <Gif> (or <Img> fallback). */
export const GifLayerSchema = z.object({
  type: z.literal("gif"),
  ...BaseLayerProps,
  url: z.string(),
  mediaName: z.string().optional(),
});

/** Inline video — Remotion <Video> from a url, optionally cued by playVideo. */
export const VideoLayerSchema = z.object({
  type: z.literal("video"),
  ...BaseLayerProps,
  url: z.string(),
  mediaName: z.string().optional(),
  fillColor: z.string().default("#000000"),
  volume: z.number().min(0).max(1).default(0),
  loop: z.boolean().default(true),
});

export const EllipseLayerSchema = z.object({
  type: z.literal("ellipse"),
  ...BaseLayerProps,
  fillColor: z.string().default("#ffffff"),
  background: z.boolean().default(true),
  strokeEnabled: z.boolean().default(false),
  strokeColor: z.string().default("#000000"),
  strokeWeight: z.number().default(0),
  /** Pie-slice / arc params (degrees + percent of full sweep). */
  startAngle: z.number().default(0),
  sweep: z.number().default(100),
});

export const StarLayerSchema = z.object({
  type: z.literal("star"),
  ...BaseLayerProps,
  fillColor: z.string().default("#ffffff"),
  background: z.boolean().default(true),
  strokeEnabled: z.boolean().default(false),
  strokeColor: z.string().default("#000000"),
  strokeWeight: z.number().default(0),
  spikes: z.number().default(5),
  /** Inner radius as a percent of outer radius (0–100). */
  radiusRatio: z.number().default(50),
});

/**
 * Raw vector shape / svg. Either a Jitter spline path (`path.spline.controls`)
 * normalised into an SVG `d` string by the translator, or a data-uri svg `url`.
 */
export const SvgLayerSchema = z.object({
  type: z.enum(["svg", "shape"]),
  ...BaseLayerProps,
  /** Pre-rendered svg as data-uri (Jitter exports svg layers this way). */
  url: z.string().optional(),
  /** SVG path data string (`d` attribute), if a vector path was extracted. */
  path: z.string().optional(),
  fillColor: z.string().default("#000000"),
  background: z.boolean().default(false),
  strokeEnabled: z.boolean().default(false),
  strokeColor: z.string().default("#000000"),
  strokeWeight: z.number().default(0),
  /** Intrinsic viewBox dimensions (defaults to width/height). */
  viewBoxWidth: z.number().optional(),
  viewBoxHeight: z.number().optional(),
});

/** Shader layer — rendered as a flat fillColor rect (no WebGL). */
export const CustomShaderLayerSchema = z.object({
  type: z.literal("customShader"),
  ...BaseLayerProps,
  fillColor: z.string().default("#000000"),
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

/**
 * Mask group — a group whose children are clipped by the first child's bounds
 * (or `clipsContent`). Rendered as a clipping container.
 */
export const MaskGroupSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    type: z.literal("maskGrp"),
    ...BaseLayerProps,
    background: z.boolean().default(false),
    fillColor: z.string().default("#ffffff"),
    clipsContent: z.boolean().default(true),
    layers: z.array(LayerSchema).default([]),
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

/**
 * Generic fallback layer — any item type the translator does not specifically
 * map lands here and renders as a bounding-box rect using `fillColor`. The
 * renderer also tolerates unknown `type` strings at runtime.
 */
export const UnknownLayerSchema = z
  .object({
    ...BaseLayerProps,
    type: z.string(),
    fillColor: z.string().optional(),
  })
  .passthrough();

export const LayerSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    TextLayerSchema,
    ImageLayerSchema,
    TextImgLayerSchema,
    GifLayerSchema,
    VideoLayerSchema,
    RectLayerSchema,
    EllipseLayerSchema,
    StarLayerSchema,
    SvgLayerSchema,
    CustomShaderLayerSchema,
    LayerGroupSchema,
    MaskGroupSchema,
    CustomLayerSchema,
    UnknownLayerSchema,
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

const Vec2 = z
  .object({ x: z.number().optional(), y: z.number().optional() })
  .partial();

/** move — translate x/y from→to (absolute artboard-space deltas). */
export const MoveOpSchema = z.object({
  type: z.literal("move"),
  ...OpBase,
  fromValue: Vec2.optional(),
  toValue: Vec2.optional(),
});

/** scale — interpolate scale factor from→to. */
export const ScaleOpSchema = z.object({
  type: z.literal("scale"),
  ...OpBase,
  fromValue: z.number().optional(),
  toValue: z.number().optional(),
});

/** rotate — interpolate angle (deg) from→to. */
export const RotateOpSchema = z.object({
  type: z.literal("rotate"),
  ...OpBase,
  fromValue: z.number().optional(),
  toValue: z.number().optional(),
});

/** opacity — interpolate opacity (0–100) from→to. */
export const OpacityOpSchema = z.object({
  type: z.literal("opacity"),
  ...OpBase,
  fromValue: z.number().optional(),
  toValue: z.number().optional(),
});

/** color — crossfade fillColor / text color from→to. */
export const ColorOpSchema = z.object({
  type: z.literal("color"),
  ...OpBase,
  fromValue: z.string().optional(),
  toValue: z.string().optional(),
});

/** cornerRadius — interpolate corner radius from→to. */
export const CornerRadiusOpSchema = z.object({
  type: z.literal("cornerRadius"),
  ...OpBase,
  fromValue: z.number().optional(),
  toValue: z.number().optional(),
});

/** hide — make the target invisible from startTime onward. */
export const HideOpSchema = z.object({
  type: z.literal("hide"),
  ...OpBase,
});

/** show — make the target visible from startTime onward (hidden before). */
export const ShowOpSchema = z.object({
  type: z.literal("show"),
  ...OpBase,
});

/** blurRadius — interpolate CSS blur (px) from→to. */
export const BlurRadiusOpSchema = z.object({
  type: z.literal("blurRadius"),
  ...OpBase,
  fromValue: z.number().optional(),
  toValue: z.number().optional(),
});

/** blur entrance/exit families — blur(+scale|slide)(In|Out). */
export const BlurInOutOpSchema = z.object({
  type: z.enum([
    "blurIn",
    "blurOut",
    "blurScaleIn",
    "blurScaleOut",
    "blurSlideIn",
    "blurSlideOut",
  ]),
  ...OpBase,
  /** Peak blur in px. */
  blurRadius: z.number().default(40),
  /** scale variants: starting/ending scale. */
  scale: z.number().default(0.8),
  /** slide variants. */
  direction: z.enum(["up", "down", "left", "right"]).default("up"),
  distance: z.number().default(40),
});

/** morph — best-effort: treated as resize + opacity crossfade. */
export const MorphOpSchema = z.object({
  type: z.literal("morph"),
  ...OpBase,
  fromValue: z.unknown().optional(),
  toValue: z.unknown().optional(),
});

/** growIn / growOut — scale entrance/exit. */
export const GrowOutOpSchema = z.object({
  type: z.literal("growOut"),
  ...OpBase,
  scale: z.number().default(0),
});

/** spinOut — rotate while fading out. */
export const SpinOutOpSchema = z.object({
  type: z.literal("spinOut"),
  ...OpBase,
  angle: z.number().default(180),
  direction: z.enum(["cw", "ccw"]).default("cw"),
});

/** textOut — mirror of textIn (per-token exit). */
export const TextOutOpSchema = z.object({
  type: z.literal("textOut"),
  ...OpBase,
  effect: z.enum(["appear", "slide", "fade"]).default("fade"),
  split: z.enum(["letters", "words", "none"]).default("letters"),
  order: z.enum(["forward", "reverse", "random"]).default("forward"),
  offset: z.number().default(50),
  nodeDuration: z.number().default(500),
  nodeEasing: Easing,
  travelDistance: z.number().default(20),
  slideDirection: z.enum(["up", "down", "left", "right"]).default("down"),
});

/** playVideo — media start cue for a video layer. */
export const PlayVideoOpSchema = z.object({
  type: z.literal("playVideo"),
  ...OpBase,
  offset: z.number().default(0),
  volume: z.number().min(0).max(1).default(0),
});

/** playAudio — media start cue (plays a sound at startTime). */
export const PlayAudioOpSchema = z.object({
  type: z.literal("playAudio"),
  ...OpBase,
  url: z.string().optional(),
  offset: z.number().default(0),
  volume: z.number().min(0).max(1).default(1),
  audioDuration: z.number().optional(),
});

/** Generic fallback — any unmapped op type. Renderer treats it as a no-op. */
export const UnknownOpSchema = z
  .object({
    ...OpBase,
    type: z.string(),
  })
  .passthrough();

export const OperationSchema = z.union([
  GrowInOpSchema,
  GrowOutOpSchema,
  ShrinkOutOpSchema,
  ResizeOpSchema,
  FadeInOpSchema,
  FadeOutOpSchema,
  SlideInOpSchema,
  SlideOutOpSchema,
  PulseOpSchema,
  TextInOpSchema,
  TextOutOpSchema,
  MoveOpSchema,
  ScaleOpSchema,
  RotateOpSchema,
  OpacityOpSchema,
  ColorOpSchema,
  CornerRadiusOpSchema,
  HideOpSchema,
  ShowOpSchema,
  BlurRadiusOpSchema,
  BlurInOutOpSchema,
  MorphOpSchema,
  SpinOutOpSchema,
  PlayVideoOpSchema,
  PlayAudioOpSchema,
  UnknownOpSchema,
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
  /** Optional caption track. Rendered as a bottom-aligned overlay synced to chunk windows. */
  captions: z
    .object({
      enabled: z.boolean().default(true),
      style: z
        .enum(["bottom", "centered", "minimal"])
        .default("bottom"),
      fontFamily: z.string().optional(),
      fontSize: z.number().optional(),
      color: z.string().optional(),
      background: z.string().optional(),
      chunks: z
        .array(
          z.object({
            text: z.string(),
            startMs: z.number(),
            endMs: z.number(),
          }),
        )
        .default([]),
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
export type TextImgLayer = z.infer<typeof TextImgLayerSchema>;
export type GifLayer = z.infer<typeof GifLayerSchema>;
export type VideoLayer = z.infer<typeof VideoLayerSchema>;
export type RectLayer = z.infer<typeof RectLayerSchema>;
export type EllipseLayer = z.infer<typeof EllipseLayerSchema>;
export type StarLayer = z.infer<typeof StarLayerSchema>;
export type SvgLayer = z.infer<typeof SvgLayerSchema>;
export type CustomShaderLayer = z.infer<typeof CustomShaderLayerSchema>;
export type LayerGroup = z.infer<typeof LayerGroupSchema>;
export type MaskGroup = z.infer<typeof MaskGroupSchema>;
export type CustomLayer = z.infer<typeof CustomLayerSchema>;
export type UnknownLayer = z.infer<typeof UnknownLayerSchema>;
export type AnyLayer =
  | TextLayer
  | ImageLayer
  | TextImgLayer
  | GifLayer
  | VideoLayer
  | RectLayer
  | EllipseLayer
  | StarLayer
  | SvgLayer
  | CustomShaderLayer
  | LayerGroup
  | MaskGroup
  | CustomLayer
  | UnknownLayer;
export type Artboard = z.infer<typeof ArtboardSchema>;
export type JitterCustomComponent = z.infer<typeof JitterCustomComponentSchema>;
export type JitterDoc = z.infer<typeof JitterDocSchema>;

export function msToFrames(ms: number, fps: number): number {
  return Math.round((ms * fps) / 1000);
}

export function artboardDurationFrames(art: Artboard, fps: number): number {
  return Math.max(1, msToFrames(art.duration, fps));
}
