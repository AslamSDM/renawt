/**
 * Generate Server - Standalone server for video generation
 *
 * Endpoints:
 *   POST /api/creative/generate      - Scraper + ScriptWriter (returns productData + videoScript)
 *   POST /api/creative/continue      - ReactPageGen → RemotionTranslator → VideoRenderer (with retry loop)
 *   POST /api/creative/render        - Re-render only
 *   POST /api/creative/edit-video    - LLM edit composition
 *   POST /api/creative/edit-script   - LLM edit script (JSON response, not SSE)
 *
 * All SSE endpoints use newline-delimited JSON: {"type":"...", "data":...}\n
 * Auth: X-API-Key header checked against process.env.API_KEY
 */

import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { join } from "path";
import { createHmac } from "crypto";

// Agent imports
import { scraperNode } from "./lib/agents/scraper";
import { scriptWriterNode } from "./lib/agents/scriptWriter";
import { reactPageGeneratorNode } from "./lib/agents/reactPageGenerator";
import { remotionTranslatorNode, validateAndFixCode, hasBasicSyntaxErrors } from "./lib/agents/remotionTranslator";
import { videoRendererNode } from "./lib/agents/videoRenderer";
import { renderErrorFixerNode } from "./lib/agents/renderErrorFixer";
import { chatWithKimi } from "./lib/agents/model";
import { renderVideo } from "./lib/render/ssrRenderer";
import type { VideoGenerationStateType } from "./lib/agents/state";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Serve rendered videos
app.use("/renders", express.static(join(process.cwd(), "public", "renders")));

// Serve screenshots captured during scraping
app.use("/screenshots", express.static(join(process.cwd(), "public", "screenshots")));

// ============================================================
// Token Auth Middleware
// Verifies short-lived HMAC tokens issued by the Vercel /api/credits/check route.
// Token format: base64url(JSON payload).base64url(HMAC-SHA256 signature)
// ============================================================
function verifyVpsToken(token: string, secret: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [data, sig] = parts;
  const expectedSig = createHmac("sha256", secret).update(data).digest("base64url");

  // Constant-time comparison
  if (sig.length !== expectedSig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < sig.length; i++) {
    mismatch |= sig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }
  if (mismatch !== 0) return false;

  // Check expiry
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString());
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return false;
  } catch {
    return false;
  }

  return true;
}

function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.API_KEY;
  if (!secret) {
    // No API_KEY configured — skip auth (dev mode)
    return next();
  }

  // Accept either a signed token (Bearer) or a raw API key (X-API-Key)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (verifyVpsToken(token, secret)) {
      return next();
    }
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // Fallback: raw API key (for server-to-server or dev)
  const apiKey = req.headers["x-api-key"];
  if (apiKey === secret) {
    return next();
  }

  return res.status(401).json({ error: "Authentication required" });
}

// Apply API key auth to all /api/* routes
app.use("/api", apiKeyAuth);

// ============================================================
// Health check (no auth)
// ============================================================
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ============================================================
// Webhook endpoint for render service callbacks
// ============================================================
app.post("/webhooks/render-complete", (req, res) => {
  const { jobId, status, videoUrl } = req.body;
  console.log(`[Webhook] Render callback: job=${jobId} status=${status} url=${videoUrl || "N/A"}`);
  res.json({ received: true });
});

// ============================================================
// Helper: SSE send function
// ============================================================
function createSSESend(res: Response) {
  return (type: string, data: any) => {
    res.write(JSON.stringify({ type, data }) + "\n");
  };
}

// ============================================================
// GET /api/creative/generate — API docs
// ============================================================
app.get("/api/creative/generate", (_req, res) => {
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
    returns: "Streaming events: productData, videoScript, status, error, complete",
  });
});

// ============================================================
// POST /api/creative/generate — Scraper + ScriptWriter only
// ============================================================
app.post("/api/creative/generate", async (req, res) => {
  console.log("[GenerateServer] POST /api/creative/generate — scraper + scriptWriter");

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
      return res.status(400).json({ error: "Either description or url is required" });
    }

    console.log(`[GenerateServer] Generating for: "${description || url}"`);
    console.log(`[GenerateServer] Style: ${style}, VideoType: ${videoType}`);

    // Set headers for streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

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
          audio: audio ? {
            url: audio.url,
            bpm: audio.bpm || 120,
            duration: audio.duration || 30,
          } : undefined,
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
      };

      // Step 1: Scraper
      send("status", { step: "scraping", message: "Analyzing product..." });
      const scraperResult = await scraperNode(state as VideoGenerationStateType);
      state = { ...state, ...scraperResult };

      if (state.productData) {
        send("productData", state.productData);
      }

      if (state.currentStep === "error") {
        send("error", { errors: state.errors });
        send("complete", { success: false });
        res.end();
        return;
      }

      // Step 2: Script Writer
      send("status", { step: "scripting", message: "Writing video script..." });
      const scriptResult = await scriptWriterNode(state as VideoGenerationStateType);
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
    res.status(500).json({
      error: "Creative generation failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================================
// POST /api/creative/continue — ReactPageGen → Remotion → Render (with retry)
// ============================================================
app.post("/api/creative/continue", async (req, res) => {
  console.log("[GenerateServer] POST /api/creative/continue");

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

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

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
      };

      // Step 1: Generate React page code
      send("status", { step: "generating", message: "Generating React page..." });
      const pageResult = await reactPageGeneratorNode(state as VideoGenerationStateType);
      state = { ...state, ...pageResult };

      if (state.reactPageCode) {
        send("reactPageCode", state.reactPageCode);
        send("status", { step: "generating", message: "React page generated" });
      }

      if (state.currentStep === "error") {
        send("error", { errors: state.errors });
        send("complete", { success: false });
        res.end();
        return;
      }

      // Step 2: Translate to Remotion
      send("status", { step: "translating", message: "Translating to Remotion..." });
      const translatorResult = await remotionTranslatorNode(state as VideoGenerationStateType);
      state = { ...state, ...translatorResult };

      if (translatorResult.remotionCode) {
        send("remotionCode", translatorResult.remotionCode);
        send("status", { step: "translating", message: "Remotion code generated" });
      }

      if (state.currentStep === "error") {
        send("error", { errors: state.errors });
        send("complete", { success: false });
        res.end();
        return;
      }

      // Step 3: Video rendering with retry loop
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        attempts++;
        state.renderAttempts = attempts;
        send("status", { step: "rendering", message: `Rendering video (attempt ${attempts})...` });

        const renderResult = await videoRendererNode(state as VideoGenerationStateType);
        state = { ...state, ...renderResult };

        if (state.videoUrl) {
          send("videoUrl", state.videoUrl);
          send("status", { step: "complete", message: "Video rendered!" });
          break;
        }

        if (state.currentStep === "fixing" && attempts < maxAttempts) {
          send("status", { step: "fixing", message: `Fixing render errors (attempt ${attempts})...` });
          const fixResult = await renderErrorFixerNode(state as VideoGenerationStateType);
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
    res.status(500).json({
      error: "Continue generation failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================================
// POST /api/creative/render — Re-render only
// ============================================================
app.post("/api/creative/render", async (req, res) => {
  console.log("[GenerateServer] POST /api/creative/render");

  try {
    const { remotionCode, durationInFrames, audio } = req.body;

    if (!remotionCode) {
      return res.status(400).json({ error: "remotionCode is required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const send = createSSESend(res);

    try {
      send("status", { step: "rendering", message: "Starting video render...", progress: 10 });

      const result = await renderVideo({
        remotionCode,
        durationInFrames: durationInFrames || 300,
        outputFormat: "mp4",
        width: 1920,
        height: 1080,
        fps: 30,
      });

      if (result.success && result.videoUrl) {
        send("videoUrl", result.videoUrl);
        send("status", { step: "complete", message: "Video rendered successfully!", progress: 100 });
        send("complete", { success: true });
      } else {
        send("error", { errors: [result.error || "Rendering failed"] });
        send("complete", { success: false });
      }
    } catch (error) {
      console.error("[GenerateServer] Render error:", error);
      send("error", {
        errors: [error instanceof Error ? error.message : "Unknown error"],
      });
      send("complete", { success: false });
    } finally {
      res.end();
    }
  } catch (error) {
    console.error("[GenerateServer] Render error:", error);
    res.status(500).json({
      error: "Render failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================================
// POST /api/creative/edit-video — LLM edit composition
// ============================================================
app.post("/api/creative/edit-video", async (req, res) => {
  console.log("[GenerateServer] POST /api/creative/edit-video");

  try {
    const {
      message,
      remotionCode,
      videoScript,
      productData,
      userPreferences,
      recordings,
    } = req.body;

    if (!message || !remotionCode) {
      return res.status(400).json({ error: "message and remotionCode are required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const send = createSSESend(res);

    try {
      send("status", { step: "editing", message: "Analyzing your request..." });

      const editPrompt = `You are a video editor. The user wants to modify their video via chat.

USER REQUEST: "${message}"

CURRENT VIDEO COMPOSITION:
\`\`\`tsx
${remotionCode}
\`\`\`

VIDEO SCRIPT CONTEXT:
${JSON.stringify(videoScript, null, 2)}

INSTRUCTIONS:
1. Analyze the user's request and determine what changes to make
2. Modify the video composition to implement the requested changes
3. Keep all existing imports, types, and helper functions
4. Only change what's necessary to fulfill the request
5. Ensure the composition remains valid TypeScript/React
6. Maintain the same structure: imports → components → scenes → composition

COMMON EDITS:
- "make it faster" → Reduce scene durations by 30%
- "change colors" → Update the COLORS constant
- "add more text" → Add additional text elements to scenes
- "zoom in on X" → Add zoom effects to specific timestamps
- "make text bigger" → Increase font sizes
- "add background" → Add gradient/aurora backgrounds
- "change music" → Just acknowledge (music is handled separately)

Return ONLY the complete modified video composition as a TypeScript code block.
Do not include explanations or markdown outside the code block.`;

      send("status", { step: "generating", message: "Applying your edits..." });

      const editResponse = await chatWithKimi([{ role: "user", content: editPrompt }], {
        temperature: 0.3,
        maxTokens: 16000,
      });

      let editedCode = editResponse.content;

      // Extract code from markdown if present
      const codeBlockMatch = editedCode.match(/```(?:tsx?|typescript)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        editedCode = codeBlockMatch[1].trim();
      }

      send("status", { step: "validating", message: "Validating composition..." });

      // Validate and fix syntax errors
      const { code: validatedCode, issues } = validateAndFixCode(editedCode);

      if (issues.length > 0) {
        console.log("[EditVideo] Fixed issues:", issues);
      }

      let finalCode = validatedCode;
      const syntaxErrors = hasBasicSyntaxErrors(validatedCode);

      if (syntaxErrors.length > 0) {
        console.warn("[EditVideo] Syntax errors found:", syntaxErrors);
        send("status", { step: "fixing", message: "Fixing syntax errors..." });

        const fixPrompt = `Fix these syntax errors in the video composition:

ERRORS:
${syntaxErrors.join("\n")}

CODE:
\`\`\`tsx
${validatedCode}
\`\`\`

Return ONLY the fixed code. Ensure it's valid TypeScript/React with no syntax errors.`;

        const fixResponse = await chatWithKimi([{ role: "user", content: fixPrompt }], {
          temperature: 0.2,
          maxTokens: 16000,
        });

        const fixedCodeMatch = fixResponse.content.match(/```(?:tsx?|typescript)?\s*([\s\S]*?)```/);
        const fixedCode = fixedCodeMatch ? fixedCodeMatch[1].trim() : fixResponse.content;

        const finalCheck = hasBasicSyntaxErrors(fixedCode);
        if (finalCheck.length === 0) {
          finalCode = fixedCode;
          send("status", { step: "fixed", message: "Syntax errors fixed!" });
        } else {
          console.warn("[EditVideo] Could not fix all errors, using best attempt");
          finalCode = fixedCode;
        }
      }

      send("remotionCode", finalCode);
      send("status", { step: "complete", message: "Video composition updated!" });
      send("complete", { success: true });
    } catch (error) {
      console.error("[EditVideo] Error:", error);
      send("error", {
        errors: [error instanceof Error ? error.message : "Unknown error"],
      });
      send("complete", { success: false });
    } finally {
      res.end();
    }
  } catch (error) {
    console.error("[EditVideo] Error:", error);
    res.status(500).json({
      error: "Video edit failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================================
// POST /api/creative/edit-script — LLM edit script (JSON response)
// ============================================================
const EDIT_SCRIPT_SYSTEM_PROMPT = `You are a video script editor. You receive a video script (JSON) and a user's edit instruction.
Apply the requested changes and return the COMPLETE updated script as valid JSON.

Rules:
- Preserve the exact JSON structure: { totalDuration, scenes[], transitions[], music }
- Each scene has: id, startFrame, endFrame, type, content, animation, style
- After editing, recalculate startFrame/endFrame sequentially (each scene starts where the previous ends)
- Update totalDuration to match the last scene's endFrame
- Scene durations are in frames at 30fps (e.g., 90 frames = 3 seconds)
- Valid scene types: "intro", "feature", "tagline", "value-prop", "screenshot", "testimonial", "recording", "cta"
- Keep scene IDs stable when modifying existing scenes
- When adding scenes, generate IDs like "scene-<timestamp>"
- When reordering, just move scenes and recalculate frames
- When the user says to make something shorter/longer, adjust endFrame - startFrame for those scenes
- Preserve all fields you don't need to change

Return ONLY the updated JSON. No markdown fences, no explanation.`;

app.post("/api/creative/edit-script", async (req, res) => {
  console.log("[GenerateServer] POST /api/creative/edit-script");

  try {
    const { message, videoScript, productData } = req.body;

    if (!message || !videoScript) {
      return res.status(400).json({ error: "message and videoScript are required" });
    }

    const productContext = productData
      ? `\nProduct: ${productData.name} — ${productData.tagline}\nFeatures: ${productData.features?.map((f: any) => f.title).join(", ") || "N/A"}`
      : "";

    const userMessage = `Current script:
\`\`\`json
${JSON.stringify(videoScript, null, 2)}
\`\`\`
${productContext}

User's edit request: "${message}"

Apply the changes and return the complete updated script as JSON.`;

    console.log(`[EditScript] Processing: "${message}"`);

    const response = await chatWithKimi(
      [
        { role: "system", content: EDIT_SCRIPT_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      { temperature: 0.3, maxTokens: 8000 },
    );

    const content = response.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[EditScript] Failed to extract JSON from response");
      return res.status(500).json({ error: "Failed to parse edited script" });
    }

    const updatedScript = JSON.parse(jsonMatch[0]);

    // Ensure frames are sequential
    let frame = 0;
    for (const scene of updatedScript.scenes) {
      const duration = scene.endFrame - scene.startFrame;
      scene.startFrame = frame;
      scene.endFrame = frame + duration;
      frame += duration;
    }
    updatedScript.totalDuration = frame;

    console.log(
      `[EditScript] Done: ${updatedScript.scenes.length} scenes, ${updatedScript.totalDuration} frames`,
    );

    res.json({ success: true, videoScript: updatedScript });
  } catch (error) {
    console.error("[EditScript] Error:", error);
    res.status(500).json({
      error: "Script editing failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================================
// Start server
// ============================================================
app.listen(PORT, () => {
  console.log(`[GenerateServer] Running on http://localhost:${PORT}`);
  console.log(`[GenerateServer] API key auth: ${process.env.API_KEY ? "ENABLED" : "DISABLED (dev mode)"}`);
  console.log(`[GenerateServer] Endpoints:`);
  console.log(`  POST /api/creative/generate     — Scraper + ScriptWriter`);
  console.log(`  POST /api/creative/continue     — ReactPage → Remotion → Render`);
  console.log(`  POST /api/creative/render        — Re-render only`);
  console.log(`  POST /api/creative/edit-video    — LLM edit composition`);
  console.log(`  POST /api/creative/edit-script   — LLM edit script`);
});
