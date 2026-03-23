import "dotenv/config";
import express from "express";
import cors from "cors";
import { join } from "path";

// Shared middleware & helpers
import { jwtAuth } from "./lib/auth";
import { COSTS } from "./lib/billing";

// Routers
import webhooksRouter from "./routes/webhooks";
import generateRouter from "./routes/generate";
import editRouter from "./routes/edit";
import freestyleRouter from "./routes/freestyle";
import devRouter from "./routes/dev";
import referenceVideoRouter from "./routes/referenceVideo";

const app = express();
const PORT = process.env.PORT || 3001;

// Global Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",")
    : ["http://localhost:3000"],
  methods: ["GET", "POST", "PATCH", "DELETE"],
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
app.use("/api/creative", jwtAuth, generateRouter);
app.use("/api/creative", jwtAuth, editRouter);
app.use("/api/creative", jwtAuth, freestyleRouter);
app.use("/api/creative", jwtAuth, referenceVideoRouter);

// Development Playground (No auth, restricted by NODE_ENV)
if (process.env.NODE_ENV !== "production") {
  app.use("/dev", devRouter);
  console.log("[GenerateServer] 🧪 Dev render playground: /dev/render");
}

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
  console.log(`  POST /api/creative/generate     — ${COSTS.generate} credit`);
  console.log(`  POST /api/creative/continue     — ${COSTS.continue} credits`);
  console.log(`  POST /api/creative/render        — ${COSTS.render} credits`);
  console.log(`  POST /api/creative/edit-video    — ${COSTS.editVideo} credit`);
  console.log(
    `  POST /api/creative/edit-script   — ${COSTS.editScript} credit`,
  );
  console.log(
    `  POST /api/creative/freestyle     — ${COSTS.freestyle} credits`,
  );
  if (process.env.NODE_ENV !== "production") {
    console.log(`  GET  /dev/render                 — 🧪 playground (no auth)`);
    console.log(
      `  POST /dev/render                 — 🧪 test render (no auth)`,
    );
  }
});
