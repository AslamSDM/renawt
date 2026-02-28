import { Router } from "express";
import { AuthenticatedRequest } from "../lib/auth";
import { setupSSE, createSSESend } from "../lib/sse";
import { checkAndDeductCredits, COSTS } from "../lib/billing";
import { chatWithGeminiFlash } from "../lib/agents/model";
import { submitAndWaitForRender } from "../lib/render/renderClient";
import {
  validateAndFixCode,
  hasBasicSyntaxErrors,
} from "../lib/agents/remotionTranslator";
import {
  buildEditVideoPrompt,
  EDIT_SCRIPT_SYSTEM_PROMPT,
} from "../lib/prompts";
import { logAgentOutput } from "../lib/agentLogger";

const router: Router = Router();

// ============================================================
// POST /render — Re-render existing composition
// ============================================================
router.post("/render", async (req: AuthenticatedRequest, res) => {
  console.log(
    `[GenerateServer] POST /api/creative/render | User: ${req.userId}`,
  );

  const credits = await checkAndDeductCredits(req.userId!, COSTS.render);
  if (!credits.ok) {
    return res
      .status(402)
      .json({ error: credits.error, required: COSTS.render });
  }

  try {
    const { remotionCode, durationInFrames, audio } = req.body;

    if (!remotionCode) {
      return res.status(400).json({ error: "remotionCode is required" });
    }

    setupSSE(res);
    const send = createSSESend(res);

    try {
      send("status", {
        step: "rendering",
        message: "Starting video render...",
        progress: 10,
      });

      const status = await submitAndWaitForRender(
        {
          remotionCode,
          durationInFrames: durationInFrames || 300,
          outputFormat: "mp4",
          width: 1920,
          height: 1080,
          fps: 30,
        },
        (progress) => {
          if (progress.progress !== undefined) {
            send("status", {
              step: "rendering",
              message: `Rendering... ${Math.round((progress.progress || 0) * 100)}%`,
              progress: 10 + Math.round((progress.progress || 0) * 85),
            });
          }
        },
      );

      if (status.status === "completed" && status.videoUrl) {
        send("videoUrl", status.videoUrl);
        send("status", {
          step: "complete",
          message: "Video rendered successfully!",
          progress: 100,
        });
        send("complete", { success: true });
      } else {
        send("error", { errors: [status.error || "Rendering failed"] });
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
    if (!res.headersSent) {
      res.status(500).json({
        error: "Render failed",
      });
    }
  }
});

// ============================================================
// POST /edit-video — LLM edit composition
// ============================================================
router.post("/edit-video", async (req: AuthenticatedRequest, res) => {
  console.log(
    `[GenerateServer] POST /api/creative/edit-video | User: ${req.userId}`,
  );

  const credits = await checkAndDeductCredits(req.userId!, COSTS.editVideo);
  if (!credits.ok) {
    return res
      .status(402)
      .json({ error: credits.error, required: COSTS.editVideo });
  }

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
      return res
        .status(400)
        .json({ error: "message and remotionCode are required" });
    }

    setupSSE(res);
    const send = createSSESend(res);

    try {
      send("status", { step: "editing", message: "Analyzing your request..." });

      const editPrompt = buildEditVideoPrompt(
        message,
        remotionCode,
        videoScript,
        productData,
        userPreferences,
        recordings,
      );

      send("status", { step: "generating", message: "Applying your edits..." });

      const editStart = Date.now();
      const editResponse = await chatWithGeminiFlash(
        [{ role: "user", content: editPrompt }],
        {
          temperature: 0.3,
          maxTokens: 16000,
        },
      );
      logAgentOutput("edit-video", { message, codeLength: remotionCode.length }, {
        codeLength: editResponse.content.length,
        currentStep: "editing",
      }, Date.now() - editStart);

      let editedCode = editResponse.content;

      const codeBlockMatch = editedCode.match(
        /```(?:tsx?|typescript)?\s*([\s\S]*?)```/,
      );
      if (codeBlockMatch) {
        editedCode = codeBlockMatch[1].trim();
      }

      send("status", {
        step: "validating",
        message: "Validating composition...",
      });

      const { code: validatedCode, issues } = validateAndFixCode(editedCode);
      if (issues.length > 0) console.log("[EditVideo] Fixed issues:", issues);

      let finalCode = validatedCode;
      const syntaxErrors = hasBasicSyntaxErrors(validatedCode);

      if (syntaxErrors.length > 0) {
        console.warn("[EditVideo] Syntax errors found:", syntaxErrors);
        send("status", { step: "fixing", message: "Fixing syntax errors..." });

        const fixPrompt = `Fix these syntax errors in the video composition:\n\nERRORS:\n${syntaxErrors.join("\n")}\n\nCODE:\n\`\`\`tsx\n${validatedCode}\n\`\`\`\n\nReturn ONLY the fixed code. Ensure it's valid TypeScript/React with no syntax errors.`;

        const fixResponse = await chatWithGeminiFlash(
          [{ role: "user", content: fixPrompt }],
          {
            temperature: 0.2,
            maxTokens: 16000,
          },
        );

        const fixedCodeMatch = fixResponse.content.match(
          /```(?:tsx?|typescript)?\s*([\s\S]*?)```/,
        );
        const fixedCode = fixedCodeMatch
          ? fixedCodeMatch[1].trim()
          : fixResponse.content;

        const finalCheck = hasBasicSyntaxErrors(fixedCode);
        if (finalCheck.length === 0) {
          finalCode = fixedCode;
          send("status", { step: "fixed", message: "Syntax errors fixed!" });
        } else {
          console.warn(
            "[EditVideo] Could not fix all errors, using best attempt",
          );
          finalCode = fixedCode;
        }
      }

      send("remotionCode", finalCode);
      send("status", {
        step: "complete",
        message: "Video composition updated!",
      });
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
    if (!res.headersSent) {
      res.status(500).json({
        error: "Video edit failed",
      });
    }
  }
});

// ============================================================
// POST /edit-script — LLM edit script (JSON response)
// ============================================================
router.post("/edit-script", async (req: AuthenticatedRequest, res) => {
  console.log(
    `[GenerateServer] POST /api/creative/edit-script | User: ${req.userId}`,
  );

  const credits = await checkAndDeductCredits(req.userId!, COSTS.editScript);
  if (!credits.ok) {
    return res
      .status(402)
      .json({ error: credits.error, required: COSTS.editScript });
  }

  try {
    const { message, videoScript, productData } = req.body;

    if (!message || !videoScript) {
      return res
        .status(400)
        .json({ error: "message and videoScript are required" });
    }

    const productContext = productData
      ? `\nProduct: ${productData.name} — ${productData.tagline}\nFeatures: ${productData.features?.map((f: any) => f.title).join(", ") || "N/A"}`
      : "";

    const userMessage = `Current script:\n\`\`\`json\n${JSON.stringify(videoScript, null, 2)}\n\`\`\`\n${productContext}\n\nUser's edit request: "${message}"\n\nApply the changes and return the complete updated script as JSON.`;

    console.log(`[EditScript] Processing: "${message}"`);

    const response = await chatWithGeminiFlash(
      [
        { role: "system", content: EDIT_SCRIPT_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      { temperature: 0.3, maxTokens: 8000 },
    );

    const content = response.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: "Failed to parse edited script" });
    }

    const updatedScript = JSON.parse(jsonMatch[0]);

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
      error: "Failed to edit script",
    });
  }
});

export default router;
