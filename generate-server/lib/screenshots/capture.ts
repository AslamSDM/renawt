/**
 * Capture a screenshot of a URL via the scraper service.
 * Used by the HyperFrames pipeline for brand analysis.
 */

const SCRAPER_URL =
  process.env.SCRAPER_SERVICE_URL || "http://localhost:4001";

export interface CaptureResult {
  url: string;
  width: number;
  height: number;
}

export interface CrawledPage {
  url: string;
  title: string;
  text: string;
  headings: string[];
  links: string[];
  imageUrls: string[];
}

export interface ScrapeWithCrawlResult {
  screenshotUrl: string;
  title: string;
  images: string[];
  pages: CrawledPage[];
  logoUrl?: string;
  brandImages: string[];
  combinedText: string;
}

export async function captureForJitter(
  url: string,
  id: string,
  opts: { width?: number; height?: number; settleMs?: number } = {},
): Promise<CaptureResult> {
  const { width = 1920, height = 1080, settleMs = 2000 } = opts;

  const resp = await fetch(`${SCRAPER_URL}/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer dev" },
    body: JSON.stringify({ url, id, width, height, settleMs }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Capture failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  if (!data.success || !data.url) {
    throw new Error(data.error || "Capture returned no URL");
  }

  return { url: data.url, width, height };
}

export async function scrapeWithCrawl(
  url: string,
  id: string,
  opts: { maxPages?: number; maxDepth?: number } = {},
): Promise<ScrapeWithCrawlResult> {
  const { maxPages = 6, maxDepth = 2 } = opts;

  const resp = await fetch(`${SCRAPER_URL}/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer dev" },
    body: JSON.stringify({ url, crawl: true, maxPages, maxDepth }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Scrape/crawl failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  if (!data.success || !data.data) {
    throw new Error(data.error || "Scrape returned no data");
  }

  const d = data.data;
  const crawl = d.crawl;

  return {
    screenshotUrl: d.screenshots?.[0]?.url || "",
    title: d.title || "",
    images: d.images || [],
    pages: crawl?.pages || [],
    logoUrl: crawl?.logoUrl,
    brandImages: crawl?.brandImages || [],
    combinedText: crawl?.combinedText || "",
  };
}