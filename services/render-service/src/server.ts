import express from "express";
import IORedis from "ioredis";
import { existsSync, unlinkSync, createReadStream, statSync } from "fs";
import { registerHfRoutes } from "./hyperframesEngine/hfServer.js";
import { startHfWorker } from "./hyperframesEngine/hfWorker.js";

const app = express();
const PORT = Number(process.env.PORT) || 4002;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

app.use(express.json({ limit: "50mb" }));

const RENDER_API_KEY = process.env.RENDER_API_KEY;
if (RENDER_API_KEY) {
  app.use((req, res, next) => {
    if (req.path === "/health") return next();
    const key = req.headers["x-render-key"] || req.headers["authorization"]?.replace("Bearer ", "");
    if (key !== RENDER_API_KEY) return res.status(401).json({ error: "Unauthorized" });
    next();
  });
  console.log("[RenderService] API key auth enabled");
}

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

startHfWorker();
registerHfRoutes(app);

app.get("/health", async (_req, res) => {
  try {
    await connection.ping();
    res.json({ status: "ok" });
  } catch (error) {
    res.status(503).json({ status: "unhealthy", error: error instanceof Error ? error.message : "Unknown error" });
  }
});

process.on("SIGTERM", async () => {
  console.log("[RenderService] Shutting down...");
  await connection.quit();
  process.exit(0);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[RenderService] Running on :${PORT}`);
  console.log(`[RenderService] HyperFrames render engine active`);
});