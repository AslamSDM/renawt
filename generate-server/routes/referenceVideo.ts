import { Router } from "express";
import { AuthenticatedRequest } from "../lib/auth";
import { setupSSE, createSSESend } from "../lib/sse";
import { checkAndDeductCredits, COSTS } from "../lib/billing";
import { chatWithGeminiProVision, chatWithGeminiPro } from "../lib/agents/model";
import { submitAndWaitForRender } from "../lib/render/renderClient";
import {
  validateAndFixCodeWithRetry,
  fixBrokenTemplateLiterals,
  isCodeTruncated,
  validateBeforeRender,
  enforceDuration,
} from "../lib/agents/remotionTranslator";
import { FREESTYLE_SYSTEM_PROMPT } from "../lib/prompts";
import { withAgentLogging, logAgentOutput } from "../lib/agentLogger";

const router: Router = Router();

const REFERENCE_VIDEO_SYSTEM_PROMPT = `You are a world-class creative technologist and motion designer. You are given a reference video and a description of what content to use. Your job is to recreate the visual style, transitions, animations, and layout of the reference video using Remotion, but with the user's own content/description.

## CORE RULES:
- Return ONLY valid TypeScript React code (.tsx). NO markdown fences.
- MUST import React from 'react'.
- MUST import from 'remotion': AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, spring, interpolate, Easing.
- Main component MUST be: export const MainVideo = () => { ... }
- MUST end with: export default MainVideo;
- DO NOT use registerRoot.
- For images, use <Img> from 'remotion'.

## YOUR TASK:
1. Analyze the reference video carefully — note the visual style, color scheme, typography, transitions, pacing, animations, and layout.
2. Recreate the same visual style and motion design but using the content/description provided by the user.
3. Match the timing and pacing of the reference video as closely as possible.
4. Use the same types of transitions (fade, slide, scale, etc.) as the reference.
5. Keep the same overall structure (number of scenes, scene types, etc.).

## ANIMATION PATTERNS:
- Use interpolate() for smooth transitions
- Use spring() for bouncy/natural animations
- Use Easing for custom timing curves
- Use Math.sin/cos for continuous floating effects
- Use opacity transitions for fade effects

## IMPORTANT:
- Match the energy and style of the reference video exactly
- Use modern, clean code
- All text content should come from the user's description
- Colors and visual style should match the reference video
- Do NOT use Three.js, Canvas, or WebGL
- Do NOT use external image URLs unless provided in the description
- Keep the code under 500 lines
`;

// ============================================================
// POST /reference-video — Analyze reference video + recreate with Gemini Pro
// ============================================================
router.post("/reference-video", async (req: AuthenticatedRequest, res) => {
  console.log(
    `[GenerateServer] POST /api/creative/reference-video | User: ${req.userId}`,
  );

  const credits = await checkAndDeductCredits(req.userId!, COSTS.referenceVideo);
  if (!credits.ok) {
    return res
      .status(402)
      .json({ error: credits.error, required: COSTS.referenceVideo });
  }

  try {
    const {
      referenceVideoUrl,
      description,
      duration = 15,
      aspectRatio = "16:9",
      audio,
    } = req.body;

    const ASPECT_DIMS: Record<string, { width: number; height: number }> = {
      "16:9": { width: 1920, height: 1080 },
      "9:16": { width: 1080, height: 1920 },
      "1:1": { width: 1080, height: 1080 },
      "4:5": { width: 1080, height: 1350 },
    };
    const { width: renderWidth, height: renderHeight } = ASPECT_DIMS[aspectRatio] || ASPECT_DIMS["16:9"];

    if (!referenceVideoUrl) {
      return res.status(400).json({ error: "referenceVideoUrl is required" });
    }
    if (!description) {
      return res.status(400).json({ error: "description is required" });
    }

    setupSSE(res);
    const send = createSSESend(res);

    try {
      const durationInFrames = duration * 30;
      const audioUrl = audio?.url || "";
      const isR2Audio = audioUrl.startsWith("http");
      const audioSrcCode = audioUrl
        ? isR2Audio
          ? `"${audioUrl}"`
          : `staticFile("${audioUrl}")`
        : "";

      // Step 1: Analyze the reference video with Gemini Pro Vision
      send("status", {
        step: "analyzing",
        message: "Analyzing reference video with Gemini Pro...",
      });

      const analysisPrompt = `Analyze this reference video in detail. Describe:
1. The overall visual style (colors, typography, mood)
2. The number of distinct scenes/sections
3. The transitions between scenes (fade, slide, scale, wipe, etc.)
4. Animation patterns (how text appears, how elements move, timing)
5. Layout structure (centered, split, grid, etc.)
6. Pacing (fast cuts, slow reveals, etc.)
7. Any special effects (particles, gradients, blur, glow, etc.)

Be very specific about timing, colors (hex values if possible), and animation curves.`;

      const analysisStart = Date.now();
      const analysisResult = await chatWithGeminiProVision(
        { type: "video", path: referenceVideoUrl },
        analysisPrompt,
        "You are a video analysis expert. Provide detailed technical breakdowns of video compositions, animations, and visual styles.",
        { temperature: 0.3, maxTokens: 4000 },
      );
      logAgentOutput("reference-video-analysis", { referenceVideoUrl, description }, {
        analysisLength: analysisResult.content.length,
        currentStep: "analyzing",
      }, Date.now() - analysisStart);

      const videoAnalysis = analysisResult.content;
      send("status", {
        step: "analyzed",
        message: "Reference video analyzed! Generating code...",
      });

      // Step 2: Generate Remotion code based on analysis + user description
      const codePrompt = `## REFERENCE VIDEO ANALYSIS:
${videoAnalysis}

## USER'S CONTENT DESCRIPTION:
${description}

## VIDEO SPECIFICATIONS:
- Duration: ${durationInFrames} frames (${duration} seconds) at 30fps
- Resolution: ${renderWidth}x${renderHeight}
${audioSrcCode ? `- Audio: Include <Audio src={${audioSrcCode}} /> in the composition` : "- No audio track"}
${audio?.bpm ? `- Music BPM: ${audio.bpm} (sync animations to beat: ${Math.round((60 / audio.bpm) * 30)} frames per beat)` : ""}

## INSTRUCTIONS:
Recreate the visual style and animation patterns from the reference video analysis above, but use the user's content description for all text and thematic content. The output should look like a recreation of the reference video with new content.

Return ONLY the complete TSX code. No markdown, no explanation.`;

      send("status", {
        step: "generating",
        message: "Gemini Pro is recreating the video style...",
      });

      const llmStart = Date.now();
      const codeResponse = await chatWithGeminiPro(
        [
          { role: "system", content: REFERENCE_VIDEO_SYSTEM_PROMPT },
          { role: "user", content: codePrompt },
        ],
        { temperature: 0.7, maxTokens: 16000 },
      );
      logAgentOutput("reference-video-codegen", { description, duration }, {
        codeLength: codeResponse.content.length,
        currentStep: "generating",
      }, Date.now() - llmStart);

      let code = codeResponse.content;

      // Extract code block if wrapped in markdown
      const codeBlockMatch = code.match(
        /```(?:tsx?|jsx?|javascript)?\s*([\s\S]*?)```/,
      );
      if (codeBlockMatch) {
        code = codeBlockMatch[1].trim();
      }

      // Check for truncated output
      if (isCodeTruncated(code)) {
        console.warn("[ReferenceVideo] Code appears truncated, requesting regeneration...");
        const regenResponse = await chatWithGeminiPro(
          [
            { role: "system", content: REFERENCE_VIDEO_SYSTEM_PROMPT },
            { role: "user", content: codePrompt },
          ],
          { temperature: 0.5, maxTokens: 16000 },
        );
        let regenCode = regenResponse.content;
        const regenMatch = regenCode.match(/```(?:tsx?|jsx?|javascript)?\s*([\s\S]*?)```/);
        if (regenMatch) regenCode = regenMatch[1].trim();
        if (!isCodeTruncated(regenCode)) {
          code = regenCode;
        }
      }

      // Ensure export default
      if (!code.includes("export default")) {
        const componentMatch = code.match(/(?:const|function|class)\s+([A-Z][a-zA-Z0-9]*)/);
        if (componentMatch) {
          code += `\nexport default ${componentMatch[1]};`;
        }
      }

      send("remotionCode", code);
      send("status", {
        step: "code-ready",
        message: "Composition generated! Rendering...",
      });

      // Step 2.5: Pre-render static analysis
      const staticAnalysis = validateBeforeRender(code);
      if (staticAnalysis.errors.length > 0 || staticAnalysis.warnings.length > 0) {
        console.log(`[ReferenceVideo] Static analysis: ${staticAnalysis.errors.length} errors, ${staticAnalysis.warnings.length} warnings — auto-fixing`);
        code = staticAnalysis.autoFixed;
      }

      // Enforce duration
      code = enforceDuration(code, durationInFrames);
      send("remotionCode", code);

      // Step 3: Render with retry loop
      const maxAttempts = 3;
      let currentCode = code;
      let renderSuccess = false;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        send("status", {
          step: "rendering",
          message: `Rendering video (attempt ${attempt}/${maxAttempts})...`,
        });

        currentCode = fixBrokenTemplateLiterals(currentCode);

        const { code: validatedCode, issues: fixIssues } =
          validateAndFixCodeWithRetry(currentCode, 3);
        if (fixIssues.length > 0) {
          console.log(`[ReferenceVideo] Pre-render fixes (attempt ${attempt}):`, fixIssues);
          currentCode = validatedCode;
        }

        const renderResult = await submitAndWaitForRender(
          {
            remotionCode: currentCode,
            durationInFrames,
            outputFormat: "mp4",
            width: renderWidth,
            height: renderHeight,
            fps: 30,
          },
          (progress) => {
            if (progress.progress !== undefined) {
              send("status", {
                step: "rendering",
                message: `Rendering... ${Math.round((progress.progress || 0) * 100)}%`,
              });
            }
          },
        );

        if (renderResult.status === "completed" && renderResult.videoUrl) {
          send("videoUrl", renderResult.videoUrl);
          send("status", { step: "complete", message: "Video rendered!" });
          send("complete", { success: true });
          renderSuccess = true;
          break;
        }

        const renderError = renderResult.error;
        console.warn(`[ReferenceVideo] Render attempt ${attempt} failed:`, renderError);

        if (attempt >= maxAttempts) {
          send("error", {
            errors: [renderError || "Rendering failed after all attempts"],
          });
          send("complete", { success: false });
          break;
        }

        // Fix render errors with LLM
        send("status", {
          step: "fixing",
          message: `Fixing render errors (attempt ${attempt})...`,
        });

        const fixPrompt = `The following Remotion code failed to render with this error:

ERROR: ${renderError}

CODE:
\`\`\`tsx
${currentCode}
\`\`\`

Fix the code so it renders correctly. Common issues:
- Missing imports
- Invalid interpolate() ranges
- Components not properly exported
- Using browser APIs not available in Remotion

Return ONLY the fixed TSX code.`;

        const fixResponse = await chatWithGeminiPro(
          [{ role: "user", content: fixPrompt }],
          { temperature: 0.2, maxTokens: 16000 },
        );

        let fixedCode = fixResponse.content;
        const fixMatch = fixedCode.match(/```(?:tsx?|jsx?|javascript)?\s*([\s\S]*?)```/);
        if (fixMatch) fixedCode = fixMatch[1].trim();

        if (isCodeTruncated(fixedCode)) {
          console.warn("[ReferenceVideo] Fix code truncated, keeping previous code");
          continue;
        }

        currentCode = fixedCode;
        send("remotionCode", currentCode);
      }
    } catch (error) {
      console.error("[ReferenceVideo] Stream error:", error);
      send("error", {
        errors: [error instanceof Error ? error.message : "Unknown error"],
      });
      send("complete", { success: false });
    } finally {
      res.end();
    }
  } catch (error) {
    console.error("[ReferenceVideo] Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Reference video generation failed" });
    }
  }
});

export default router;
