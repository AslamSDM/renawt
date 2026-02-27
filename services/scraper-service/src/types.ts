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
