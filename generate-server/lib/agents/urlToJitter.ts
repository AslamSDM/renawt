/**
 * Analyze a brand from a screenshot URL using LLM vision.
 * Used by the HyperFrames pipeline.
 */

import { chatWithOllamaCloudVision } from "./model";

export interface BrandReport {
  productName?: string;
  tagline?: string;
  headlines?: string[];
  features?: string[];
  cta?: string;
  brand?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    textColor?: string;
    fontFamily?: string;
    fontWeightDisplay?: number;
    mood?: string;
  };
  layout?: string;
  heroDescription?: string;
  imageUrls?: string[];
}

export interface CrawlContext {
  pages: Array<{
    url: string;
    title: string;
    headings: string[];
    text: string;
    imageUrls: string[];
  }>;
  logoUrl?: string;
  brandImages: string[];
  combinedText: string;
}

export async function analyzeBrandFromScreenshot(
  screenshotUrl: string,
  opts?: { hint?: string; crawl?: CrawlContext },
): Promise<BrandReport> {
  const hint = opts?.hint ? `\nAdditional notes: ${opts.hint}` : "";
  const crawlBlock = opts?.crawl
    ? `\n\nWebsite content from crawled pages:\n${opts.crawl.combinedText.slice(0, 20000)}`
    : "";

  const prompt = `Analyze this website screenshot and its crawled content, then extract brand information for a video ad.

Return JSON with:
- productName: the brand/product name
- tagline: the main tagline
- headlines: array of key headlines/messages
- features: array of product features mentioned
- cta: call to action text
- brand: object with { primary, secondary, accent, background, textColor, fontFamily, fontWeightDisplay, mood }
- layout: visual layout type (centered, split, grid, etc.)
- heroDescription: brief description of the hero section
- imageUrls: array of product/screenshot image URLs${hint}${crawlBlock}

Return ONLY valid JSON. No markdown, no explanation.`;

  const response = await chatWithOllamaCloudVision(
    { type: "image", path: screenshotUrl },
    prompt,
  );

  const content = response.content || "{}";
  const jsonStart = content.indexOf("{");
  const jsonEnd = content.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    console.warn("[urlToJitter] Could not parse brand report JSON from response");
    return {};
  }

  try {
    return JSON.parse(content.slice(jsonStart, jsonEnd + 1));
  } catch (e) {
    console.warn("[urlToJitter] JSON parse failed:", e);
    return {};
  }
}
