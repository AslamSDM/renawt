import { z } from "zod";

export const ScriptLineSchema = z.object({ beatId: z.string(), text: z.string(), onScreen: z.string().optional(), visualNote: z.string().optional(), targetSec: z.number() });
export const ScriptSchema = z.object({
  title: z.string(),
  hook: z.string(),
  lines: z.array(ScriptLineSchema),
  cta: z.string(),
  sources: z.array(z.object({ title: z.string(), url: z.string() })).default([]),
  hashtags: z.array(z.string()).default([]),
  description: z.string().default(""),
  estimatedSec: z.number(),
});
export type Script = z.infer<typeof ScriptSchema>;

export const WordTimingSchema = z.object({ w: z.string(), s: z.number(), e: z.number() });
export const VoiceTrackSchema = z.object({ audioUrl: z.string(), durationMs: z.number(), words: z.array(WordTimingSchema), provider: z.string(), voiceId: z.string() });
export type VoiceTrack = z.infer<typeof VoiceTrackSchema>;

export const SceneSchema = z.object({
  id: z.string(), beatId: z.string(), startMs: z.number(), durationMs: z.number(),
  block: z.string(),                       // registry block / family
  headline: z.string().optional(),
  body: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),   // chart series, stats, map points...
  assetIds: z.array(z.string()).default([]),
  transitionIn: z.string().optional(),
});
export const ScenePlanSchema = z.object({ scenes: z.array(SceneSchema), totalMs: z.number(), musicMood: z.string(), sfxCues: z.array(z.object({ atMs: z.number(), cue: z.string() })).default([]) });
export type ScenePlan = z.infer<typeof ScenePlanSchema>;

export const AssetSchema = z.object({ id: z.string(), kind: z.enum(["image", "video", "icon", "mascot"]), url: z.string(), source: z.string(), license: z.string().optional(), prompt: z.string().optional(), width: z.number().optional(), height: z.number().optional() });
export type Asset = z.infer<typeof AssetSchema>;

export const CompositionSchema = z.object({ indexHtml: z.string(), sceneFiles: z.array(z.object({ id: z.string(), fileName: z.string(), html: z.string() })), registryBlocks: z.array(z.string()).default([]), width: z.number().default(1080), height: z.number().default(1920), fps: z.number().default(30), durationMs: z.number() });
export type Composition = z.infer<typeof CompositionSchema>;

export const ProgressEventSchema = z.object({ step: z.string(), status: z.enum(["started", "progress", "done", "failed", "skipped"]), message: z.string().optional(), at: z.string(), output: z.unknown().optional() });
export type ProgressEvent = z.infer<typeof ProgressEventSchema>;

export const PIPELINE_STEPS = ["ideate", "script", "voice", "plan", "assets", "compose", "lint", "render", "qc", "cuts"] as const;
export type PipelineStep = (typeof PIPELINE_STEPS)[number];
