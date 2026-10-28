import "dotenv/config";
import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { serve as inngestExpress } from "inngest/express";
import { createServe } from "@mastra/inngest";
import { env } from "./lib/env.js";
import { log } from "./lib/logger.js";
import { disconnectDb } from "./lib/db.js";
import { getPublisher } from "./lib/publisher.js";
import { mastra } from "./mastra/index.js";
import { inngest } from "./mastra/inngest.js";
import { inngestFunctions } from "./mastra/functions.js";
import { requireAuth, errorHandler } from "./routes/http.js";
import { videos } from "./routes/videos.js";
import { kit, voices, radarRoutes, ideas, publications, social, series } from "./routes/misc.js";
import { webhooks } from "./routes/webhooks.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);
app.use(cors({ origin: env.corsOrigin?.split(",") ?? true }));
app.use(express.json({ limit: "20mb" }));

// structured access log
app.use((req, res, next) => {
  const id = req.header("x-request-id") ?? randomUUID();
  const t0 = Date.now();
  res.setHeader("x-request-id", id);
  res.on("finish", () => {
    if (req.originalUrl === "/health") return;
    log.info("http", { id, method: req.method, path: req.originalUrl.split("?")[0], status: res.statusCode, ms: Date.now() - t0, userId: req.header("x-user-id") });
  });
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "remawt-engine", renderProvider: env.renderProvider, publisher: getPublisher().id }));

// Inngest: Mastra workflow functions + our plain functions (signature-verified by the SDK via INNGEST_SIGNING_KEY).
app.use("/api/inngest", createServe(inngestExpress as never)({ mastra, inngest, functions: inngestFunctions as never }) as express.RequestHandler);

const v1 = express.Router();
v1.use(requireAuth({ user: true }));
v1.use("/videos", videos);
v1.use("/kit", kit);
v1.use("/voices", voices);
v1.use("/radar", radarRoutes);
v1.use("/ideas", ideas);
v1.use("/publications", publications);
v1.use("/social", social);
app.use("/v1/series", requireAuth({ user: false }), series);
app.use("/v1", v1);
app.use("/webhooks", webhooks);

app.use((_req, res) => res.status(404).json({ error: "not found" }));
app.use(errorHandler);

const server = app.listen(env.port, () => log.info("engine listening", { port: env.port, renderProvider: env.renderProvider }));

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info("shutting down", { signal });
  const force = setTimeout(() => process.exit(1), 25_000);
  force.unref();
  server.close(async () => {
    try { await mastra.shutdown?.(); } catch { /* ignore */ }
    await disconnectDb().catch(() => undefined);
    process.exit(0);
  });
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (e) => log.error("unhandledRejection", { err: e instanceof Error ? e.message : String(e) }));
