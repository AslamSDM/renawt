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
app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
    : DEFAULT_ALLOWED_ORIGINS,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));
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

// ============================================================
// Start server
// ============================================================
app.listen(PORT, () => {
  console.log(`[GenerateServer] Running on http://localhost:${PORT}`);
  console.log(
    `[GenerateServer] JWT auth: ${process.env.API_KEY ? "ENABLED" : "DISABLED (dev mode)"}`,
  );
  console.log(`[GenerateServer] Credits: Deducted server-side via Prisma`);
  console.log(`[GenerateServer] Endpoints:`);
  console.log(`  POST /api/creative/narrate          — ElevenLabs TTS narration`);
  console.log(`  POST /api/creative/jitter           — URL → animated brand video`);
  console.log(`  POST /api/creative/jitter-reference — reference video → Jitter recreation`);
});
