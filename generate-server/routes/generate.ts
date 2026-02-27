import { Router } from "express";
import { AuthenticatedRequest } from "../lib/auth";
import { setupSSE, createSSESend } from "../lib/sse";
import { checkAndDeductCredits, COSTS } from "../lib/billing";
import { scraperNode } from "../lib/agents/scraper";
import { scriptWriterNode } from "../lib/agents/scriptWriter";
import { reactPageGeneratorNode } from "../lib/agents/reactPageGenerator";
import { remotionTranslatorNode } from "../lib/agents/remotionTranslator";
import { videoRendererNode } from "../lib/agents/videoRenderer";
import { renderErrorFixerNode } from "../lib/agents/renderErrorFixer";
import type { VideoGenerationStateType } from "../lib/agents/state";

const router: Router = Router();

// ============================================================
// GET /generate — API docs
// ============================================================
router.get("/generate", (_req, res) => {
  res.json({
    endpoint: "/api/creative/generate",
    method: "POST",
    body: {
      description: "string (optional) - What the video is about",
      url: "string (optional) - Product URL to scrape",
      style: "string (optional) - professional, playful, minimal, bold",
      templateStyle: "string (optional) - aurora, floating-glass, blue-clean",
      videoType: "string (optional) - demo, creative, fast-paced, cinematic",
      duration: "number (optional) - Video length in seconds",
      audio: "object (optional) - { url, bpm, duration }",
      recordings: "array (optional) - Screen recordings data",
    },
    returns:
      "Streaming events: productData, videoScript, status, error, complete",
    cost: COSTS.generate,
  });
});

// ============================================================
// POST /generate — Scraper + ScriptWriter
// ============================================================
router.post("/generate", async (req: AuthenticatedRequest, res) => {
  console.log(
    `[GenerateServer] POST /api/creative/generate | User: ${req.userId}`,
  );

  // Deduct credits
  const credits = await checkAndDeductCredits(req.userId!, COSTS.generate);
  if (!credits.ok) {
    return res
      .status(402)
      .json({ error: credits.error, required: COSTS.generate });
  }

  try {
    const {
      url,
      description,
      style = "professional",
      templateStyle,
      videoType = "creative",
      duration,
      audio,
      recordings,
    } = req.body;

    if (!description && !url) {
      return res
        .status(400)
        .json({ error: "Either description or url is required" });
    }

    console.log(
      `[GenerateServer] User: ${req.userId} | "${description || url}" | Style: ${style}`,
    );

    setupSSE(res);
    const send = createSSESend(res);

    try {
      let state: Partial<VideoGenerationStateType> = {
        sourceUrl: url || null,
        description: description || null,
        userPreferences: {
          style: style as any,
          templateStyle: templateStyle as any,
          videoType: videoType as any,
          duration: duration ? parseInt(duration) : undefined,
          audio: audio
            ? {
                url: audio.url,
                bpm: audio.bpm || 120,
                duration: audio.duration || 30,
              }
            : undefined,
        },
        recordings: Array.isArray(recordings) ? recordings : [],
        productData: null,
        videoScript: null,
        reactPageCode: null,
        remotionCode: null,
        currentStep: "scraping",
        errors: [],
        renderAttempts: 0,
        lastRenderError: null,
        videoUrl: null,
        beatMap: null,
        r2Key: null,
        projectId: null,
      };

      // Step 1: Scraper
      send("status", { step: "scraping", message: "Analyzing product..." });
      const scraperResult = await scraperNode(
        state as VideoGenerationStateType,
      );
      state = { ...state, ...scraperResult };

      if (state.productData) {
        send("productData", state.productData);
      }

      if (state.currentStep === "error") {
        send("error", { errors: state.errors });
        send("complete", { success: false });
        return res.end();
      }

      // Step 2: Script Writer
      send("status", { step: "scripting", message: "Writing video script..." });
      const scriptResult = await scriptWriterNode(
        state as VideoGenerationStateType,
      );
      state = { ...state, ...scriptResult };

      if (state.videoScript) {
        send("videoScript", state.videoScript);
      }

      if (state.currentStep === "error") {
        send("error", { errors: state.errors });
      }

      send("complete", { success: true, message: "Script ready for review" });
    } catch (error) {
      console.error("[GenerateServer] Stream error:", error);
      send("error", {
        errors: [error instanceof Error ? error.message : "Unknown error"],
      });
      send("complete", { success: false });
    } finally {
      res.end();
    }
  } catch (error) {
    console.error("[GenerateServer] Error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Creative generation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
});

// ============================================================
// POST /continue — ReactPageGen → Remotion → Render
// ============================================================
router.post("/continue", async (req: AuthenticatedRequest, res) => {
  console.log(
    `[GenerateServer] POST /api/creative/continue | User: ${req.userId}`,
  );

  const credits = await checkAndDeductCredits(req.userId!, COSTS.continue);
  if (!credits.ok) {
    return res
      .status(402)
      .json({ error: credits.error, required: COSTS.continue });
  }

  try {
    const {
      videoScript,
      productData,
      userPreferences = { style: "professional" },
      recordings,
    } = req.body;

    if (!videoScript) {
      return res.status(400).json({ error: "videoScript is required" });
    }

    setupSSE(res);
    const send = createSSESend(res);

    try {
      let state: Partial<VideoGenerationStateType> = {
        sourceUrl: null,
        description: null,
        userPreferences: userPreferences as any,
        recordings: Array.isArray(recordings) ? recordings : [],
        productData: productData || null,
        videoScript,
        reactPageCode: null,
        remotionCode: null,
        currentStep: "generating",
        errors: [],
        renderAttempts: 0,
        lastRenderError: null,
        videoUrl: null,
        beatMap: null,
        r2Key: null,
        projectId: null,
      };

      // Step 1: Generate React page code
      send("status", {
        step: "generating",
        message: "Generating React page...",
      });
      const pageResult = await reactPageGeneratorNode(
        state as VideoGenerationStateType,
      );
      state = { ...state, ...pageResult };

      if (state.reactPageCode) {
        send("reactPageCode", state.reactPageCode);
        send("status", { step: "generating", message: "React page generated" });
      }

      if (state.currentStep === "error") {
        send("error", { errors: state.errors });
        send("complete", { success: false });
        return res.end();
      }

      // Step 2: Translate to Remotion
      send("status", {
        step: "translating",
        message: "Translating to Remotion...",
      });
      const translatorResult = await remotionTranslatorNode(
        state as VideoGenerationStateType,
      );
      state = { ...state, ...translatorResult };

      if (translatorResult.remotionCode) {
        send("remotionCode", translatorResult.remotionCode);
        send("status", {
          step: "translating",
          message: "Remotion code generated",
        });
      }

      if (state.currentStep === "error") {
        send("error", { errors: state.errors });
        send("complete", { success: false });
        return res.end();
      }

      // Step 3: Video rendering with retry loop
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        attempts++;
        state.renderAttempts = attempts;
        send("status", {
          step: "rendering",
          message: `Rendering video (attempt ${attempts})...`,
        });

        const renderResult = await videoRendererNode(
          state as VideoGenerationStateType,
        );
        state = { ...state, ...renderResult };

        if (state.videoUrl) {
          send("videoUrl", state.videoUrl);
          send("status", { step: "complete", message: "Video rendered!" });
          break;
        }

        if (state.currentStep === "fixing" && attempts < maxAttempts) {
          send("status", {
            step: "fixing",
            message: `Fixing render errors (attempt ${attempts})...`,
          });
          const fixResult = await renderErrorFixerNode(
            state as VideoGenerationStateType,
          );
          state = { ...state, ...fixResult };
          if (fixResult.remotionCode) {
            send("remotionCode", fixResult.remotionCode);
          }
        } else if (state.currentStep === "error") {
          send("error", { errors: state.errors });
          break;
        }
      }

      send("complete", { success: true, message: "Video generation complete" });
    } catch (error) {
      console.error("[GenerateServer] Continue stream error:", error);
      send("error", {
        errors: [error instanceof Error ? error.message : "Unknown error"],
      });
      send("complete", { success: false });
    } finally {
      res.end();
    }
  } catch (error) {
    console.error("[GenerateServer] Continue error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Continue generation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
});

export default router;
