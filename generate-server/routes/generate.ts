import { Router } from "express";
import { AuthenticatedRequest } from "../lib/auth";
import { setupSSE, createSSESend } from "../lib/sse";
import { checkAndDeductCredits, COSTS } from "../lib/billing";
import { scraperNode } from "../lib/agents/scraper";
import { scriptWriterNode } from "../lib/agents/scriptWriter";
import { creativeDirectorNode } from "../lib/agents/creativeDirector";
import { remotionTranslatorNode, validateBeforeRender, enforceDuration } from "../lib/agents/remotionTranslator";
import { videoRendererNode } from "../lib/agents/videoRenderer";
import { renderErrorFixerNode } from "../lib/agents/renderErrorFixer";
import type { VideoGenerationStateType } from "../lib/agents/state";
import { withAgentLogging } from "../lib/agentLogger";
import { generateBeatMap } from "../lib/audio/beatSync";
import {
  inferBrandStyleFromText,
  formatBrandStyleForPrompt,
} from "../lib/agents/brandAnalyser";

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
      aspectRatio,
      audio,
      recordings,
      useImages = false,
      nanoBanana = false,
      stockImages = false,
      animatedComponents = true,
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
          aspectRatio: aspectRatio || "16:9",
          useImages,
          nanoBanana,
          stockImages,
          animatedComponents,
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

      // Pre-compute beatmap from audio BPM + requested duration
      const audioBpm = audio?.bpm || 120;
      const videoDurationSec = duration ? parseInt(duration) : 30;
      const totalFrames = videoDurationSec * 30;
      state.beatMap = generateBeatMap({
        bpm: audioBpm,
        totalDurationFrames: totalFrames,
        fps: 30,
      });
      console.log(
        `[GenerateServer] Pre-computed beatmap: ${state.beatMap.beats.length} beats at ${audioBpm} BPM for ${videoDurationSec}s`,
      );

      // Step 1: Scraper
      send("status", { step: "scraping", message: "Analyzing product..." });
      const scraperResult = await withAgentLogging(
        "scraper",
        { sourceUrl: state.sourceUrl, description: state.description },
        () => scraperNode(state as VideoGenerationStateType),
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

      // Step 1.5: Brand style inference (runs fast, enriches script generation)
      if (state.productData) {
        try {
          const brandStyle = await inferBrandStyleFromText(
            state.productData.name || "Product",
            state.productData.description || "",
            state.productData.tone || "professional",
            state.productData.colors || {},
          );
          // Attach brand insights to productData for script writer and code gen
          (state.productData as any).brandStyle = brandStyle;
          (state.productData as any).designInsights = brandStyle.designInsights;
          (state.productData as any).visualMood = brandStyle.mood?.tone;
          console.log(
            `[GenerateServer] Brand analysis: ${brandStyle.videoStyle?.recommended}, font: ${brandStyle.typography?.primaryFont}`,
          );
        } catch (e) {
          console.warn("[GenerateServer] Brand inference failed (non-fatal):", e);
        }
      }

      // Step 2: Script Writer
      send("status", { step: "scripting", message: "Writing video script..." });
      const scriptResult = await withAgentLogging(
        "scriptWriter",
        {
          productData: state.productData,
          userPreferences: state.userPreferences,
        },
        () => scriptWriterNode(state as VideoGenerationStateType),
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

      // Pre-compute beatmap from audio + video script duration
      const contAudioBpm = (userPreferences as any)?.audio?.bpm || 120;
      const contTotalFrames = videoScript?.totalDuration || 900;
      state.beatMap = generateBeatMap({
        bpm: contAudioBpm,
        totalDurationFrames: contTotalFrames,
        fps: 30,
      });
      console.log(
        `[GenerateServer] Continue beatmap: ${state.beatMap.beats.length} beats at ${contAudioBpm} BPM`,
      );

      // Step 1: Creative Director — enrich script with creative direction
      send("status", {
        step: "directing",
        message: "Adding creative direction...",
      });
      const directorResult = await withAgentLogging(
        "creativeDirector",
        { videoScript: state.videoScript, style: state.userPreferences?.style },
        () => creativeDirectorNode(state as VideoGenerationStateType),
      );
      state = { ...state, ...directorResult };

      // Step 2: Translate script directly to Remotion (skipping React page generation)
      send("status", {
        step: "translating",
        message: "Translating to Remotion...",
      });
      const translatorResult = await withAgentLogging(
        "remotionTranslator",
        {
          videoScript: state.videoScript,
          productData: state.productData?.name,
          userPreferences: state.userPreferences,
        },
        () => remotionTranslatorNode(state as VideoGenerationStateType),
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

      // Step 2.5: Pre-render static analysis — catch forbidden patterns before expensive render
      if (state.remotionCode) {
        const analysis = validateBeforeRender(state.remotionCode as string);
        if (analysis.errors.length > 0 || analysis.warnings.length > 0) {
          console.log(`[GenerateServer] Static analysis: ${analysis.errors.length} errors, ${analysis.warnings.length} warnings — auto-fixing`);
          state.remotionCode = analysis.autoFixed;
        }

        // Enforce scene durations fill the target video duration
        const targetFrames = videoScript?.totalDuration || 900;
        state.remotionCode = enforceDuration(state.remotionCode as string, targetFrames);
        send("remotionCode", state.remotionCode);
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

        const renderResult = await withAgentLogging(
          "videoRenderer",
          {
            remotionCode: state.remotionCode
              ? `${(state.remotionCode as string).length} chars`
              : null,
            attempt: attempts,
          },
          () => videoRendererNode(state as VideoGenerationStateType),
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
          const fixResult = await withAgentLogging(
            "renderErrorFixer",
            { lastRenderError: state.lastRenderError, attempt: attempts },
            () => renderErrorFixerNode(state as VideoGenerationStateType),
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

      if (state.videoUrl) {
        send("complete", {
          success: true,
          message: "Video generation complete",
        });
      } else {
        send("error", {
          errors: state.errors?.length
            ? state.errors
            : ["Video rendering failed after all attempts"],
        });
        send("complete", { success: false, message: "Video rendering failed" });
      }
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
      });
    }
  }
});

export default router;
