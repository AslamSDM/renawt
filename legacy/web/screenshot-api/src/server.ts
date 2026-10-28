import express from "express";
import puppeteer, { Browser } from "puppeteer";
import pLimit from "p-limit";
import { setTimeout as delay } from "node:timers/promises";

const app = express();
const PORT = Number(process.env.PORT) || 4001;

/* ---------- metrics ---------- */
const metrics = {
    queued: 0,
    active: 0,
    completed: 0,
    failed: 0
};

/* ---------- queue ---------- */
const limit = pLimit(2); // max concurrent screenshots
let workerCounter = 0;

/* ---------- browser ---------- */

let browser: Browser;
let restarting = false;

async function startBrowser() {
    console.log("Starting browser with executable:", process.env.PUPPETEER_EXECUTABLE_PATH);
    try {
        browser = await puppeteer.launch({
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
            protocolTimeout: 120000, // Increase to 120s for extreme parallel load
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-gpu",
                "--disable-software-rasterizer",
                "--disable-features=IsolateOrigins,site-per-process,Translate,OptimizationHints",
                "--disable-extensions",
                "--no-first-run",
                "--no-zygote"
            ]
        });
        console.log("Browser started successfully");
    } catch (err) {
        console.error("Failed to start browser:", err);
        throw err;
    }

    browser.on("disconnected", async () => {
        if (restarting) return;
        restarting = true;

        console.error("Browser crashed. Restarting...");
        await delay(1000);
        await startBrowser();

        restarting = false;
    });
}

await startBrowser();

/* ---------- routes ---------- */
app.get("/screenshot", async (req, res) => {
    const url = req.query.url as string | undefined;
    if (!url) return res.status(400).send("url required");

    if (!browser || !browser.isConnected()) {
        return res.status(503).send("Browser is restarting or not available");
    }

    metrics.queued++;

    try {
        await limit(async () => {
            const workerId = ++workerCounter;
            metrics.queued--;
            metrics.active++;
            console.log(`[Worker ${workerId}] Starting: ${url} (Active: ${metrics.active})`);

            let context;
            let page;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 55000); // Fail before 60s protocol timeout

            try {
                context = await browser.createBrowserContext();
                page = await context.newPage();
                await page.setViewport({ width: 1280, height: 800 });

                await page.goto(url, {
                    waitUntil: "networkidle2",
                    timeout: 30000
                });

                const image = await page.screenshot({
                    fullPage: true,
                    type: "png"
                });

                metrics.completed++;
                res.setHeader("Content-Type", "image/png");
                res.send(image);
                console.log(`[Worker ${workerId}] SUCCESS: ${url}`);
            } catch (err: any) {
                const errorMsg = err instanceof Error ? err.message : String(err);
                console.error(`[Worker ${workerId}] FAILED: ${url} -> ${errorMsg}`);
                metrics.failed++;
                if (!res.headersSent) {
                    res.status(500).send(`screenshot failed: ${errorMsg}`);
                }
            } finally {
                clearTimeout(timeoutId);
                if (page) await page.close().catch(() => { });
                if (context) await context.close().catch(() => { });
                metrics.active--;
            }
        });
    } catch (err) {
        // This catch handles errors in the limit() wrapper itself
        console.error("Queue error:", err);
        if (!res.headersSent) {
            res.status(500).send("internal server error");
        }
    }
});

app.get("/health", async (_req, res) => {
    const healthy =
        browser?.isConnected?.() &&
        metrics.active <= 5;

    if (!healthy) {
        return res.status(503).json({
            status: "unhealthy",
            metrics
        });
    }

    res.json({
        status: "ok",
        metrics
    });
});

app.get("/metrics", (_req, res) => {
    res.json(metrics);
});

/* ---------- graceful shutdown ---------- */
process.on("SIGTERM", async () => {
    if (browser) await browser.close();
    process.exit(0);
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Puppeteer Screenshot API running on :${PORT}`);
});