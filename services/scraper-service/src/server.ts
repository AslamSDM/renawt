import express, { type Request, type Response, type NextFunction } from "express";
import pLimit from "p-limit";
import {
  captureJitterScreenshot,
} from "./scraper.js";
import { crawlSite } from "./crawl.js";
import { scrapePixabayMusic } from "./pixabayMusic.js";
import type {
  ScrapeRequest,
  ScrapeResponse,
  CaptureJitterRequest,
  CaptureJitterResponse,
  PixabayMusicRequest,
  PixabayMusicResponse,
} from "./types.js";
import { logger, httpLogger } from "./logger.js";

const app = express();
const PORT = Number(process.env.PORT) || 4001;
const AUTH_TOKEN = process.env.SCRAPER_AUTH_TOKEN || "";

app.disable("x-powered-by");
app.use(httpLogger);
app.use(express.json({ limit: "10mb" }));
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setTimeout(5 * 60 * 1000, () => {
    res.status(503).json({ success: false, error: "request timeout" });
  });
  next();
});

// Concurrency limit for scraping operations
const scrapeLimit = pLimit(2);

// Metrics
const metrics = {
  scrapeRequests: 0,
  screenshotRequests: 0,
  jitterRequests: 0,
  pixabayMusicRequests: 0,
  activeJobs: 0,
  completed: 0,
  failed: 0,
  authRejected: 0,
};

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!AUTH_TOKEN) return next(); // dev mode: no auth required
  const header = req.headers["authorization"];
  const expected = `Bearer ${AUTH_TOKEN}`;
  if (header === expected) return next();
  metrics.authRejected++;
  (req as any).log?.warn({ path: req.path }, "auth rejected");
  res.status(401).json({ success: false, error: "unauthorized" });
}

/**
 * POST /scrape - Full scrape with optional crawl, screenshots, logo/images and text extraction
 */
app.post("/scrape", requireAuth, async (req, res) => {
  const { url, crawl = false, maxPages = 6, maxDepth = 2 } = req.body as ScrapeRequest;
  const log = (req as any).log;

  if (!url) {
    return res
      .status(400)
      .json({ success: false, error: "url is required" });
  }

  metrics.scrapeRequests++;

  try {
    const result = await scrapeLimit(async () => {
      metrics.activeJobs++;
      log.info({ url, activeJobs: metrics.activeJobs, crawl }, "scrape start");

      try {
        const shot = await captureJitterScreenshot({ url, id: `scrape-${Date.now()}`, width: 1920, height: 1080 });
        const crawlResult = crawl
          ? await crawlSite({ url, maxPages, maxDepth })
          : undefined;
        metrics.completed++;
        return { shot, crawl: crawlResult };
      } finally {
        metrics.activeJobs--;
      }
    });

    const images = result.crawl?.brandImages || [];
    const screenshots = [
      {
        name: result.shot.key,
        path: result.shot.url,
        url: result.shot.url,
        section: "hero" as const,
        description: "captured screenshot",
      },
    ];

    const response: ScrapeResponse = {
      success: true,
      data: {
        text: result.crawl?.combinedText || "",
        images,
        title: result.crawl?.pages[0]?.title || "",
        screenshots,
        saasIndicators: { hasDemoButton: false, hasPricing: false, hasSignup: false },
        crawl: result.crawl,
      },
    };
    res.json(response);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    log.error({ url, err: errorMsg }, "scrape failed");

    const response: ScrapeResponse = { success: false, error: errorMsg };
    res.status(500).json(response);
  }
});

/**
 * POST /capture - Single viewport screenshot to R2 (hyperframes pipeline)
 */
app.post("/capture", requireAuth, async (req, res) => {
  const body = req.body as CaptureJitterRequest;
  const log = (req as any).log;

  if (!body?.url) {
    return res
      .status(400)
      .json({ success: false, error: "url is required" });
  }

  metrics.jitterRequests++;

  try {
    const id = body.id || `jitter-${Date.now()}`;
    const result = await scrapeLimit(async () => {
      metrics.activeJobs++;
      log.info({ url: body.url, id }, "jitter capture start");
      try {
        const r = await captureJitterScreenshot({
          url: body.url,
          id,
          width: body.width,
          height: body.height,
          settleMs: body.settleMs,
        });
        metrics.completed++;
        return r;
      } finally {
        metrics.activeJobs--;
      }
    });

    const response: CaptureJitterResponse = {
      success: true,
      url: result.url,
      key: result.key,
    };
    res.json(response);
  } catch (error) {
    metrics.failed++;
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error({ url: body.url, err: errorMsg }, "jitter capture failed");
    const response: CaptureJitterResponse = {
      success: false,
      error: errorMsg,
    };
    res.status(500).json(response);
  }
});

/**
 * POST /scrape-pixabay-music - Scrape pixabay.com/music for tracks.
 * Returns metadata + direct mp3 URLs. Caller is responsible for downloading
 * and storing the mp3s (we don't proxy bytes).
 */
app.post("/scrape-pixabay-music", requireAuth, async (req, res) => {
  const body = req.body as PixabayMusicRequest;
  const log = (req as any).log;

  if (!body?.query) {
    return res
      .status(400)
      .json({ success: false, error: "query is required" });
  }

  metrics.pixabayMusicRequests++;
  const limit = Math.min(Math.max(body.limit ?? 20, 1), 60);

  try {
    const tracks = await scrapeLimit(async () => {
      metrics.activeJobs++;
      log.info({ query: body.query, limit }, "pixabay music scrape start");
      try {
        const r = await scrapePixabayMusic(body.query, limit);
        metrics.completed++;
        return r;
      } finally {
        metrics.activeJobs--;
      }
    });

    log.info({ query: body.query, count: tracks.length }, "pixabay music scrape done");
    const response: PixabayMusicResponse = { success: true, tracks };
    res.json(response);
  } catch (error) {
    metrics.failed++;
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error({ query: body.query, err: errorMsg }, "pixabay music scrape failed");
    const response: PixabayMusicResponse = { success: false, error: errorMsg };
    res.status(500).json(response);
  }
});

/**
 * GET /screenshot?url=... - Simple screenshot (backward compatible)
 */
app.get("/screenshot", requireAuth, async (req, res) => {
  const url = req.query.url as string | undefined;
  const log = (req as any).log;
  if (!url) {
    return res.status(400).send("url required");
  }

  metrics.screenshotRequests++;

  try {
    const result = await scrapeLimit(async () => {
      metrics.activeJobs++;
      try {
        const r = await captureJitterScreenshot({ url, id: `ss-${Date.now()}`, width: 1920, height: 1080 });
        return r;
      } finally {
        metrics.activeJobs--;
      }
    });

    metrics.completed++;
    res.json({ success: true, url: result.url, key: result.key });
  } catch (error) {
    metrics.failed++;
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error({ url, err: errorMsg }, "screenshot failed");
    res.status(500).send(`screenshot failed: ${errorMsg}`);
  }
});

/** GET /health */
app.get("/health", (_req, res) => {
  const healthy = metrics.activeJobs <= 4;
  if (!healthy) return res.status(503).json({ status: "unhealthy", metrics });
  res.json({ status: "ok", metrics });
});

/** GET /metrics */
app.get("/metrics", (_req, res) => {
  res.json(metrics);
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down");
  process.exit(0);
});

app.listen(PORT, "0.0.0.0", () => {
  logger.info({ port: PORT, authEnabled: !!AUTH_TOKEN }, "scraper service listening");
});
