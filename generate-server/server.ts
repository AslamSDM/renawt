import "dotenv/config";
import express from "express";
import cors from "cors";
import { join } from "path";

// Shared middleware & helpers
import { jwtAuth } from "./lib/auth";

// Routers
import webhooksRouter from "./routes/webhooks";
import narrateRouter from "./routes/narrate";
import jitterRouter from "./routes/jitter";
import jitterReferenceRouter from "./routes/jitterReference";

const app = express();
const PORT = process.env.PORT || 3001;

// Global Middleware
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://www.remawt.com",
  "https://remawt.com",
];
const ALLOWED_ORIGINS = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : DEFAULT_ALLOWED_ORIGINS;

const corsMiddleware = cors({
  origin: ALLOWED_ORIGINS,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});
app.use(corsMiddleware);
app.options("*", corsMiddleware);
app.use(express.json({ limit: "10mb" }));

// Serve static rendered videos & screenshots
app.use("/renders", express.static(join(process.cwd(), "public", "renders")));
app.use(
  "/screenshots",
  express.static(join(process.cwd(), "public", "screenshots")),
);

// Health check (no auth needed)
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ============================================================
// Mount Routers
// ============================================================

// Webhooks (no auth, verify payload internally if needed)
app.use("/webhooks", webhooksRouter);

// Creative API Routes (JWT Auth Required)
app.use("/api/creative", jwtAuth, narrateRouter);
app.use("/api/creative", jwtAuth, jitterRouter);
app.use("/api/creative", jwtAuth, jitterReferenceRouter);

// Serve Jitter renders + screenshots from the repo /public dir
app.use(
  "/jitter",
  express.static(join(process.cwd(), "..", "public", "jitter")),
);

// Fallback error handler — guarantees CORS headers on thrown errors so the
// browser surfaces the real status instead of a misleading CORS message.
app.use(
  (
    err: unknown,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const origin = req.headers.origin;
    if (
      typeof origin === "string" &&
      ALLOWED_ORIGINS.includes(origin) &&
      !res.headersSent
    ) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[GenerateServer] Unhandled error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    }
  },
);

// ============================================================
// Start server
// ============================================================
const server = app.listen(PORT, () => {
  console.log(`[GenerateServer] Running on http://localhost:${PORT}`);
  console.log(
    `[GenerateServer] JWT auth: ${process.env.API_KEY ? "ENABLED" : "DISABLED (dev mode)"}`,
  );
  console.log(`[GenerateServer] Credits: Deducted server-side via Prisma`);
  console.log(`[GenerateServer] CORS allowed: ${ALLOWED_ORIGINS.join(", ")}`);
  console.log(`[GenerateServer] Endpoints:`);
  console.log(`  POST /api/creative/narrate          — ElevenLabs TTS narration`);
  console.log(`  POST /api/creative/jitter           — URL → animated brand video`);
  console.log(`  POST /api/creative/jitter-reference — reference video → Jitter recreation`);
});

// Long-running endpoints (jitter, render) can exceed Node's default 2-min
// socket timeout. Disable per-socket idle timeout and make keep-alive /
// headers timeouts longer than upstream Caddy/Traefik (15m) so the proxy
// chain never closes a still-working connection.
server.setTimeout(0);
server.keepAliveTimeout = 16 * 60 * 1000;
server.headersTimeout = 16 * 60 * 1000 + 5000;
