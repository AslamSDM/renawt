export interface ScreenshotData {
  name: string;
  path: string;
  url: string;
  section: "hero" | "features" | "pricing" | "testimonials" | "footer" | "full" | "ui";
  description: string;
}

export interface ScrapeResult {
  text: string;
  images: string[];
  title: string;
  screenshots: ScreenshotData[];
  saasIndicators: {
    hasDemoButton: boolean;
    hasPricing: boolean;
    hasSignup: boolean;
  };
}

export interface ScrapeRequest {
  url: string;
}

export interface ScrapeResponse {
  success: boolean;
  data?: ScrapeResult;
  error?: string;
}

export interface CaptureJitterRequest {
  url: string;
  id?: string;
  width?: number;
  height?: number;
  settleMs?: number;
}

export interface CaptureJitterResponse {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

export interface PixabayMusicRequest {
  query: string;
  limit?: number;
}

export interface PixabayMusicTrack {
  title: string;
  artist: string;
  durationSec: number;
  mp3Url: string;
  thumbnailUrl?: string;
  tags: string[];
  pixabayId: string;
}

export interface PixabayMusicResponse {
  success: boolean;
  tracks?: PixabayMusicTrack[];
  error?: string;
}
