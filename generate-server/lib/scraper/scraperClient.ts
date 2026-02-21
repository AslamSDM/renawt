/**
 * HTTP client for the scraper microservice.
 * Replaces direct Puppeteer usage in the orchestrator.
 */

const SCRAPER_SERVICE_URL = process.env.SCRAPER_SERVICE_URL || "http://localhost:4001";

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

/**
 * Call the scraper service to scrape a URL
 */
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  console.log(`[ScraperClient] Requesting scrape of: ${url}`);

  const response = await fetch(`${SCRAPER_SERVICE_URL}/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(120000), // 2 minute timeout
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Scraper service error (${response.status}): ${errorText}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(`Scraper service failed: ${result.error}`);
  }

  console.log(`[ScraperClient] Scrape complete: ${result.data.text.length} chars, ${result.data.screenshots.length} screenshots`);

  return result.data;
}

/**
 * Check if the scraper service is available
 */
export async function isScraperServiceAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${SCRAPER_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
