import { z } from "zod";

export const LayerSchema = z.object({
  component: z.string(),
  props: z.record(z.string(), z.unknown()).default({}),
});

export const TransitionSchema = z.object({
  type: z.enum(["fade", "slide", "wipe", "none"]).default("none"),
  durationInFrames: z.number().min(0).default(0),
});

export const SceneJsonSchema = z.object({
  id: z.string(),
  durationInFrames: z.number().int().positive(),
  layers: z.array(LayerSchema).min(1),
  transitionIn: TransitionSchema.optional(),
});

export const AudioJsonSchema = z.object({
  url: z.string(),
  bpm: z.number().optional(),
  volume: z.number().min(0).max(1).optional(),
});

export const CustomComponentSchema = z.object({
  name: z.string().regex(/^[A-Z][A-Za-z0-9]*$/, "PascalCase identifier"),
  source: z
    .string()
    .min(1)
    .describe(
      "Function-component source: `function Name(props) { return ... }`. No imports — React, Remotion (AbsoluteFill, Sequence, Audio, Video, useCurrentFrame, useVideoConfig, interpolate, spring, staticFile), and registry components are in scope.",
    ),
  description: z.string().optional(),
});

export const VideoJsonSchema = z.object({
  fps: z.number().int().positive().default(30),
  width: z.number().int().positive().default(1920),
  height: z.number().int().positive().default(1080),
  audio: AudioJsonSchema.nullable().optional(),
  scenes: z.array(SceneJsonSchema).min(1),
  customComponents: z.array(CustomComponentSchema).default([]),
});

export type VideoJson = z.infer<typeof VideoJsonSchema>;
export type SceneJson = z.infer<typeof SceneJsonSchema>;
export type LayerJson = z.infer<typeof LayerSchema>;
export type CustomComponent = z.infer<typeof CustomComponentSchema>;

export function totalFrames(json: VideoJson): number {
  return json.scenes.reduce((sum, s) => sum + s.durationInFrames, 0);
}
