import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? true }));
app.use(express.json({ limit: "10mb" }));
app.get("/health", (_req, res) => res.json({ ok: true, service: "remawt-engine" }));

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`[engine] listening on :${port}`));
