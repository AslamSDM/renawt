/**
 * Generate Server - Standalone server for video generation
 *
 * POST /api/creative/generate
 * Body: { description: string, style?: string, videoType?: string }
 *
 * Returns: Streaming events for each pipeline stage
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import { join } from "path";
import { streamVideoGeneration } from "./lib/agents/graph";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve rendered videos
app.use("/renders", express.static(join(process.cwd(), "public", "renders")));

// Serve screenshots captured during scraping
app.use("/screenshots", express.static(join(process.cwd(), "public", "screenshots")));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// GET for API documentation
app.get("/api/creative/generate", (req, res) => {
  res.json({
    endpoint: "/api/creative/generate",
    method: "POST",
    body: {
      description: "string (required) - What the video is about",
      style: "string (optional) - professional, playful, minimal, bold",
      videoType: "string (optional) - demo, creative, fast-paced, cinematic",
    },
    returns:
      "Streaming events: productData, videoScript, reactPageCode, remotionCode, videoUrl, status, error, complete",
    workflow: [
      "scraper: Analyzes input/product",
      "scriptWriter/demoScriptWriter: Creates video script",
      "reactPageGenerator: Generates React page component",
      "remotionTranslator: Converts React to Remotion code",
      "videoRenderer: Renders video (retries up to 3 times)",
      "renderErrorFixer: Fixes render errors automatically",
    ],
  });
});

// POST - Main generation endpoint
app.post("/api/creative/generate", async (req, res) => {
  console.log("[GenerateServer] Starting LangGraph workflow...");

  try {
    const {
      url,
      description,
      style = "professional",
      videoType = "creative",
    } = req.body;

    if (!description && !url) {
      return res.status(400).json({ error: "Either description or url is required" });
    }

    console.log(`[GenerateServer] Generating for: "${description || url}"`);
    console.log(`[GenerateServer] URL: ${url || "none"}`);
    console.log(`[GenerateServer] Style: ${style}, VideoType: ${videoType}`);

    // Set headers for streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
      // Run the LangGraph workflow
      const generator = streamVideoGeneration({
        sourceUrl: url || null,
        description,
        userPreferences: {
          style: style as "professional" | "playful" | "minimal" | "bold",
          videoType: videoType as "demo" | "creative" | "fast-paced" | "cinematic",
        },
      });

      for await (const chunk of generator) {
        // Handle scraper output
        if (chunk.scraper) {
          const state = chunk.scraper;
          if (state.productData) {
            res.write(
              JSON.stringify({
                type: "productData",
                data: state.productData,
              }) + "\n"
            );
          }
          res.write(
            JSON.stringify({
              type: "status",
              data: { step: "scraping", message: "Analyzing product..." },
            }) + "\n"
          );
        }

        // Handle scriptWriter output
        if (chunk.scriptWriter) {
          const state = chunk.scriptWriter;
          if (state.videoScript) {
            res.write(
              JSON.stringify({
                type: "videoScript",
                data: state.videoScript,
              }) + "\n"
            );
          }
          res.write(
            JSON.stringify({
              type: "status",
              data: {
                step: "scripting",
                message: "Writing video script...",
              },
            }) + "\n"
          );
        }

        // Handle reactPageGenerator output (Step 1)
        if (chunk.reactPageGenerator) {
          const state = chunk.reactPageGenerator;
          if (state.reactPageCode) {
            res.write(
              JSON.stringify({
                type: "reactPageCode",
                data: state.reactPageCode,
              }) + "\n"
            );
          }
          res.write(
            JSON.stringify({
              type: "status",
              data: {
                step: "generating",
                message: "Generating React page...",
              },
            }) + "\n"
          );
        }

        // Handle remotionTranslator output (Step 2)
        if (chunk.remotionTranslator) {
          const state = chunk.remotionTranslator;
          if (state.remotionCode) {
            res.write(
              JSON.stringify({
                type: "remotionCode",
                data: state.remotionCode,
              }) + "\n"
            );
          }
          res.write(
            JSON.stringify({
              type: "status",
              data: {
                step: "translating",
                message: "Translating to Remotion...",
              },
            }) + "\n"
          );
        }

        // Handle videoRenderer output (Step 3 - with retry loop)
        if (chunk.videoRenderer) {
          const state = chunk.videoRenderer;

          if (state.videoUrl) {
            res.write(
              JSON.stringify({
                type: "videoUrl",
                data: state.videoUrl,
              }) + "\n"
            );
          }

          res.write(
            JSON.stringify({
              type: "status",
              data: {
                step: "rendering",
                message: state.videoUrl
                  ? "Video rendered successfully!"
                  : `Rendering video (attempt ${state.renderAttempts})...`,
                attempts: state.renderAttempts,
              },
            }) + "\n"
          );
        }

        // Handle renderErrorFixer output (Step 4 - fixes render errors)
        if (chunk.renderErrorFixer) {
          const state = chunk.renderErrorFixer;

          if (state.remotionCode) {
            res.write(
              JSON.stringify({
                type: "remotionCode",
                data: state.remotionCode,
              }) + "\n"
            );
          }

          res.write(
            JSON.stringify({
              type: "status",
              data: {
                step: "fixing",
                message: `Fixing render errors (attempt ${state.renderAttempts})...`,
                attempts: state.renderAttempts,
              },
            }) + "\n"
          );
        }

        // Handle errors
        if (chunk.errorHandler) {
          const state = chunk.errorHandler;
          if (state.errors && state.errors.length > 0) {
            res.write(
              JSON.stringify({
                type: "error",
                data: { errors: state.errors },
              }) + "\n"
            );
          }
        }
      }

      // Send completion
      res.write(
        JSON.stringify({
          type: "complete",
          data: {
            success: true,
            message: "Video generation complete",
          },
        }) + "\n"
      );
    } catch (error) {
      console.error("[GenerateServer] Stream error:", error);
      res.write(
        JSON.stringify({
          type: "error",
          data: {
            errors: [error instanceof Error ? error.message : "Unknown error"],
          },
        }) + "\n"
      );
    } finally {
      res.end();
    }
  } catch (error) {
    console.error("[GenerateServer] Error:", error);
    res.status(500).json({
      error: "Creative generation failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.listen(PORT, () => {
  console.log(`[GenerateServer] Running on http://localhost:${PORT}`);
  console.log(`[GenerateServer] API endpoint: POST /api/creative/generate`);
});
