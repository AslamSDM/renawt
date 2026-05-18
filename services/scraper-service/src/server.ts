import express, { type Request, type Response, type NextFunction } from "express";
import pLimit from "p-limit";
import {
  scrapeWebsite,
  captureScreenshot,
  captureJitterScreenshot,
} from "./scraper.js";
import type {
  ScrapeRequest,
  ScrapeResponse,
  CaptureJitterRequest,
  CaptureJitterResponse,
} from "./types.js";
import { logger, httpLogger } from "./logger.js";

const app = express();
const PORT = Number(process.env.PORT) || 4001;
const AUTH_TOKEN = process.env.SCRAPER_AUTH_TOKEN || "";

app.disable("x-powered-by");
app.use(httpLogger);
app.use(express.json({ limit: "10mb" }));

// Concurrency limit for scraping operations
const scrapeLimit = pLimit(2);

// Metrics
const metrics = {
  scrapeRequests: 0,
  screenshotRequests: 0,
  jitterRequests: 0,
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
 * POST /scrape - Full scrape with screenshots and text extraction
 */
app.post("/scrape", requireAuth, async (req, res) => {
  const { url } = req.body as ScrapeRequest;
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
      log.info({ url, activeJobs: metrics.activeJobs }, "scrape start");

      try {
        const data = await scrapeWebsite(url);
        metrics.completed++;
        return data;
      } finally {
        metrics.activeJobs--;
      }
    });

    const response: ScrapeResponse = { success: true, data: result };
    res.json(response);
  } catch (error) {
    metrics.failed++;
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    log.error({ url, err: errorMsg }, "scrape failed");

    const response: ScrapeResponse = { success: false, error: errorMsg };
    res.status(500).json(response);
  }
});

/**
 * POST /capture-jitter - Single viewport screenshot to R2 (jitter pipeline)
 */
app.post("/capture-jitter", requireAuth, async (req, res) => {
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
