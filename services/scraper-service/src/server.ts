import express from "express";
import pLimit from "p-limit";
import { scrapeWebsite, captureScreenshot } from "./scraper.js";
import type { ScrapeRequest, ScrapeResponse } from "./types.js";

const app = express();
const PORT = Number(process.env.PORT) || 4001;

app.use(express.json({ limit: "10mb" }));

// Concurrency limit for scraping operations
const scrapeLimit = pLimit(2);

// Metrics
const metrics = {
  scrapeRequests: 0,
  screenshotRequests: 0,
  activeJobs: 0,
  completed: 0,
  failed: 0,
};

/**
 * POST /scrape - Full scrape with screenshots and text extraction
 * Returns raw text + screenshots (base64 + R2 URLs) + meta + SaaS indicators
 */
app.post("/scrape", async (req, res) => {
  const { url } = req.body as ScrapeRequest;

  if (!url) {
    return res.status(400).json({ success: false, error: "url is required" });
  }

  metrics.scrapeRequests++;

  try {
    const result = await scrapeLimit(async () => {
      metrics.activeJobs++;
      console.log(`[ScraperService] Scraping: ${url} (Active: ${metrics.activeJobs})`);

      try {
        const data = await scrapeWebsite(url);
        metrics.completed++;
        return data;
      } finally {
        metrics.activeJobs--;
      }
    });

    const response: ScrapeResponse = {
      success: true,
      data: result,
    };

    res.json(response);
  } catch (error) {
    metrics.failed++;
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[ScraperService] Scrape failed for ${url}: ${errorMsg}`);

    const response: ScrapeResponse = {
      success: false,
      error: errorMsg,
    };

    res.status(500).json(response);
  }
});

/**
 * GET /screenshot?url=... - Simple screenshot (backward compatible)
 */
app.get("/screenshot", async (req, res) => {
  const url = req.query.url as string | undefined;
  if (!url) {
    return res.status(400).send("url required");
  }

  metrics.screenshotRequests++;

  try {
    const image = await scrapeLimit(async () => {
      metrics.activeJobs++;
      try {
        return await captureScreenshot(url);
      } finally {
        metrics.activeJobs--;
      }
    });

    metrics.completed++;
    res.setHeader("Content-Type", "image/png");
    res.send(image);
  } catch (error) {
    metrics.failed++;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[ScraperService] Screenshot failed for ${url}: ${errorMsg}`);
    res.status(500).send(`screenshot failed: ${errorMsg}`);
  }
});

/**
 * GET /health - Health check
 */
app.get("/health", (_req, res) => {
  const healthy = metrics.activeJobs <= 4;

  if (!healthy) {
    return res.status(503).json({ status: "unhealthy", metrics });
  }

  res.json({ status: "ok", metrics });
});

/**
 * GET /metrics - Detailed metrics
 */
app.get("/metrics", (_req, res) => {
  res.json(metrics);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[ScraperService] Shutting down...");
  process.exit(0);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[ScraperService] Running on :${PORT}`);
  console.log(`[ScraperService] POST /scrape - Full scrape`);
  console.log(`[ScraperService] GET /screenshot?url=... - Simple screenshot`);
});
