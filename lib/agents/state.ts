import { Annotation } from "@langchain/langgraph";
import type { ProductData, VideoScript, UserPreferences } from "../types";
import type { BeatMap } from "../audio/beatSync";

// Define the state schema for the video generation workflow
export const VideoGenerationState = Annotation.Root({
  // Input
  sourceUrl: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  description: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  userPreferences: Annotation<UserPreferences>({
    reducer: (_, next) => next,
    default: () => ({ style: "professional" as const }),
  }),

  // Recordings (screen recordings to include in video)
  recordings: Annotation<Array<{
    id: string;
    videoUrl: string;
    duration: number;
    featureName: string;
    description: string;
    trimStart: number;
    trimEnd: number;
    mockupFrame?: "browser" | "macbook" | "minimal";
    zoomPoints?: Array<{ time: number; x: number; y: number; scale: number; duration: number }>;
    cursorStyle?: "normal" | "hand";
    cursorData?: Array<{ x: number; y: number; timestamp: number; type: string }>;
  }>>({
    reducer: (_, next) => next,
    default: () => [],
  }),

  // Agent outputs
  productData: Annotation<ProductData | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  videoScript: Annotation<VideoScript | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  // Two-step code generation: React page first, then Remotion
  reactPageCode: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  remotionCode: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Audio/Beat sync
  beatMap: Annotation<BeatMap | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Status tracking
  currentStep: Annotation<
    | "idle"
    | "scraping"
    | "scripting"
    | "generating"
    | "translating"
    | "rendering"
    | "fixing"
    | "complete"
    | "error"
  >({
    reducer: (_, next) => next,
    default: () => "idle",
  }),
  errors: Annotation<string[]>({
    reducer: (current, next) => [...current, ...next],
    default: () => [],
  }),

  // Render tracking
  renderAttempts: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
  lastRenderError: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  videoUrl: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  r2Key: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Metadata
  projectId: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
});

export type VideoGenerationStateType = typeof VideoGenerationState.State;
