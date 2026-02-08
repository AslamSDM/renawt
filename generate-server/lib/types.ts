import { z } from "zod";

// Screenshot data captured during scraping
export interface ScreenshotData {
  name: string;
  path: string;
  url: string;
  section: "hero" | "features" | "pricing" | "testimonials" | "footer" | "full" | "ui";
  description: string;
}

// Product Data extracted from website
export interface ProductData {
  name: string;
  tagline: string;
  description: string;
  productType?: "saas" | "ecommerce" | "service" | "other";
  features: Array<{ title: string; description: string; icon?: string }>;
  pricing?: Array<{ tier: string; price: string; features: string[] }>;
  testimonials?: Array<{ quote: string; author: string; role: string }>;
  images: string[];
  screenshots?: ScreenshotData[];
  colors: { primary: string; secondary: string; accent: string };
  tone: "professional" | "playful" | "minimal" | "bold";
  designInsights?: string;
  visualMood?: string;
}

export const ProductDataSchema = z.object({
  name: z.string(),
  tagline: z.string(),
  description: z.string(),
  features: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      icon: z.string().optional(),
    }),
  ),
  pricing: z
    .array(
      z.object({
        tier: z.string(),
        price: z.string(),
        features: z.array(z.string()),
      }),
    )
    .optional(),
  testimonials: z
    .array(
      z.object({
        quote: z.string(),
        author: z.string(),
        role: z.string(),
      }),
    )
    .optional(),
  images: z.array(z.string()),
  colors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
  }),
  tone: z.enum(["professional", "playful", "minimal", "bold"]),
});

// Video Script with scenes and timing
export interface VideoScene {
  id: string;
  startFrame: number;
  endFrame: number;
  type: "intro" | "feature" | "testimonial" | "cta" | "transition" | "stats" | "screenshot" | "tagline" | "value-prop" | "recording";
  content: {
    headline?: string;
    subtext?: string;
    image?: string;
    icon?: string;
    stats?: Array<{ value: number; label: string; suffix?: string }>;
    features?: Array<{ icon: string; title: string; description: string }>;
    // For recording scenes
    recordingId?: string;
    recordingVideoUrl?: string;
    featureName?: string;
    description?: string;
    mockupFrame?: "browser" | "macbook" | "minimal";
  };
  animation: {
    enter:
      | "fade"
      | "slide-up"
      | "slide-down"
      | "slide-left"
      | "slide-right"
      | "scale"
      | "scale-bounce"
      | "reveal"
      | "typewriter"
      | "blur-in"
      | "blur-in-up"
      | "stagger-words"
      | "stagger-chars"
      | "flip-up"
      | "encrypted-text"
      | "gradient-text";
    exit:
      | "fade"
      | "slide-down"
      | "slide-up"
      | "scale-out"
      | "blur-out"
      | "zoom-out";
    staggerDelay?: number;
  };
  style: {
    background: string;
    textColor: string;
    accentColor?: string;
    fontSize: "large" | "medium" | "small";
    fontFamily?: string;
    layout?: "centered" | "left" | "right" | "split" | "grid" | "bento";
    cardStyle?: "glass" | "spotlight" | "floating" | "tilt" | "none";
  };
}

export interface VideoTransition {
  afterScene: string;
  type:
    | "cut"
    | "fade"
    | "crossfade"
    | "wipe"
    | "wipe-left"
    | "wipe-right"
    | "wipe-up"
    | "wipe-down"
    | "zoom"
    | "zoom-through"
    | "scroll-vertical"
    | "scroll-horizontal"
    | "page-flip"
    | "morph"
    | "beat-sync";
  duration: number;
  direction?: "up" | "down" | "left" | "right";
}

export interface VideoScript {
  totalDuration: number;
  scenes: VideoScene[];
  transitions: VideoTransition[];
  music: {
    tempo: number;
    mood: string;
  };
}

export const VideoSceneSchema = z.object({
  id: z.string(),
  startFrame: z.number(),
  endFrame: z.number(),
  type: z.enum(["intro", "feature", "testimonial", "cta", "transition"]),
  content: z.object({
    headline: z.string().optional(),
    subtext: z.string().optional(),
    image: z.string().optional(),
  }),
  animation: z.object({
    enter: z.enum(["fade", "slide-up", "scale", "reveal", "typewriter"]),
    exit: z.enum(["fade", "slide-down", "scale-out"]),
  }),
  style: z.object({
    background: z.string(),
    textColor: z.string(),
    fontSize: z.enum(["large", "medium", "small"]),
  }),
});

export const VideoTransitionSchema = z.object({
  afterScene: z.string(),
  type: z.enum(["cut", "fade", "wipe", "zoom", "beat-sync"]),
  duration: z.number(),
});

export const VideoScriptSchema = z.object({
  totalDuration: z.number(),
  scenes: z.array(VideoSceneSchema),
  transitions: z.array(VideoTransitionSchema),
  music: z.object({
    tempo: z.number(),
    mood: z.string(),
  }),
});

// Beat Map for audio synchronization
export interface BeatMap {
  bpm: number;
  beats: number[];
  drops: number[];
}

export const BeatMapSchema = z.object({
  bpm: z.number(),
  beats: z.array(z.number()),
  drops: z.array(z.number()),
});

// Audio configuration for video
export interface AudioConfig {
  url: string; // Path to audio file (e.g., "/audio/audio1.mp3")
  bpm: number; // Beats per minute
  duration: number; // Duration in seconds
  volume?: number; // 0-1
  startFrom?: number; // Start time in seconds
}

// User Preferences for video generation
export interface UserPreferences {
  style: "professional" | "playful" | "minimal" | "bold";
  duration?: number;
  musicUrl?: string;
  musicBpm?: number;
  videoType?: "demo" | "creative" | "fast-paced" | "cinematic";
  audio?: AudioConfig; // Audio file configuration
}

export const UserPreferencesSchema = z.object({
  style: z.enum(["professional", "playful", "minimal", "bold"]),
  duration: z.number().optional(),
  musicUrl: z.string().optional(),
  musicBpm: z.number().optional(),
});

// Generation State for UI
export type GenerationStep =
  | "idle"
  | "scraping"
  | "scripting"
  | "generating"
  | "complete"
  | "error";

export interface GenerationState {
  step: GenerationStep;
  progress: number;
  message: string;
  projectId?: string;
  productData?: ProductData;
  videoScript?: VideoScript;
  remotionCode?: string;
  errors: string[];
}

// API Request/Response types
export interface GenerateRequest {
  url?: string;
  description?: string;
  preferences: UserPreferences;
}

export const GenerateRequestSchema = z.object({
  url: z.string().url().optional(),
  description: z.string().optional(),
  preferences: UserPreferencesSchema,
});

export interface GenerateStreamChunk {
  type:
    | "status"
    | "productData"
    | "videoScript"
    | "remotionCode"
    | "error"
    | "complete";
  data: unknown;
}

// Image Asset type
export interface ImageAsset {
  id: string;
  url: string;
  source: "scraped" | "uploaded" | "stock";
  prompt?: string;
}

export const ImageAssetSchema = z.object({
  id: z.string(),
  url: z.string(),
  source: z.enum(["scraped", "uploaded", "stock"]),
  prompt: z.string().optional(),
});
