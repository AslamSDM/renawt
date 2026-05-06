import { z } from "zod";
import type { ProductData, VideoScript, UserPreferences } from "../types";
import type { BeatMap } from "../audio/beatSync";
import type { VideoJson } from "../video/videoJson";

const recordingSchema = z.object({
  id: z.string(),
  videoUrl: z.string(),
  duration: z.number(),
  featureName: z.string(),
  description: z.string(),
  trimStart: z.number(),
  trimEnd: z.number(),
  mockupFrame: z.enum(["browser", "macbook", "minimal"]).optional(),
  zoomPoints: z
    .array(
      z.object({
        time: z.number(),
        x: z.number(),
        y: z.number(),
        scale: z.number(),
        duration: z.number(),
      }),
    )
    .optional(),
  cursorStyle: z
    .enum([
      "mac",
      "windows",
      "hand-pointing",
      "hand-pressing",
      "touch-hand",
      "finger-tap",
      "hand-cursor",
    ])
    .optional(),
  cursorData: z
    .array(
      z.object({
        x: z.number(),
        y: z.number(),
        timestamp: z.number(),
        type: z.string(),
      }),
    )
    .optional(),
});

export const VideoGenerationStateSchema = z.object({
  sourceUrl: z.string().nullable(),
  description: z.string().nullable(),
  userPreferences: z.custom<UserPreferences>(),
  recordings: z.array(recordingSchema),
  productData: z.custom<ProductData>().nullable(),
  videoScript: z.custom<VideoScript>().nullable(),
  reactPageCode: z.string().nullable(),
  remotionCode: z.string().nullable(),
  videoJson: z.custom<VideoJson>().nullable(),
  beatMap: z.custom<BeatMap>().nullable(),
  currentStep: z.enum([
    "idle",
    "scraping",
    "scripting",
    "generating",
    "translating",
    "rendering",
    "fixing",
    "complete",
    "error",
  ]),
  errors: z.array(z.string()),
  renderAttempts: z.number(),
  lastRenderError: z.string().nullable(),
  videoUrl: z.string().nullable(),
  r2Key: z.string().nullable(),
  projectId: z.string().nullable(),
});

export type VideoGenerationStateType = z.infer<typeof VideoGenerationStateSchema>;
