/**
 * HTTP client for the scraper microservice.
 * Replaces direct Puppeteer usage in the orchestrator.
 */
import { randomUUID } from "crypto";

const SCRAPER_SERVICE_URL = process.env.SCRAPER_SERVICE_URL || "http://localhost:4001";
const SCRAPER_AUTH_TOKEN = process.env.SCRAPER_AUTH_TOKEN || "";

function authHeaders(): Record<string, string> {
  return SCRAPER_AUTH_TOKEN
    ? { Authorization: `Bearer ${SCRAPER_AUTH_TOKEN}` }
    : {};
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: { attempts?: number; baseDelayMs?: number; timeoutMs?: number } = {},
): Promise<Response> {
  const attempts = opts.attempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 500;
  const timeoutMs = opts.timeoutMs ?? 120000;

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
      // Retry on 5xx; surface 4xx immediately
      if (res.status >= 500 && i < attempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i));
        continue;
      }
    }
  }
  throw lastErr ?? new Error("fetch failed");
}

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
  const reqId = randomUUID();
  console.log(`[ScraperClient ${reqId}] Requesting scrape of: ${url}`);

  const response = await fetchWithRetry(
    `${SCRAPER_SERVICE_URL}/scrape`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": reqId,
        ...authHeaders(),
      },
      body: JSON.stringify({ url }),
    },
    { attempts: 3, baseDelayMs: 750, timeoutMs: 120000 },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Scraper service error (${response.status}): ${errorText}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(`Scraper service failed: ${result.error}`);
  }

  console.log(
    `[ScraperClient ${reqId}] Scrape complete: ${result.data.text.length} chars, ${result.data.screenshots.length} screenshots`,
  );

  return result.data;
}

export interface JitterCaptureResult {
  url: string;
  key: string;
}

/**
 * Capture a single viewport screenshot via the scraper microservice.
 * The PNG is uploaded to R2 by the service; we receive only the public URL.
 */
export async function captureJitter(opts: {
  url: string;
  id?: string;
  width?: number;
  height?: number;
  settleMs?: number;
}): Promise<JitterCaptureResult> {
  const reqId = randomUUID();
  const response = await fetchWithRetry(
    `${SCRAPER_SERVICE_URL}/capture-jitter`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": reqId,
        ...authHeaders(),
      },
      body: JSON.stringify(opts),
    },
    { attempts: 3, baseDelayMs: 750, timeoutMs: 60000 },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`captureJitter ${response.status}: ${errorText}`);
  }
  const result = await response.json();
  if (!result.success || !result.url) {
    throw new Error(`captureJitter failed: ${result.error || "no url"}`);
  }
  return { url: result.url, key: result.key };
}

/**
 * Check if the scraper service is available
 */
export async function isScraperServiceAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${SCRAPER_SERVICE_URL}/health`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
