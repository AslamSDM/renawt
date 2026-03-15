import { Router } from "express";
import { AuthenticatedRequest } from "../lib/auth";
import { setupSSE, createSSESend } from "../lib/sse";
import { checkAndDeductCredits, COSTS } from "../lib/billing";
import { chatWithGeminiPro } from "../lib/agents/model";
import { scraperNode } from "../lib/agents/scraper";
import { analyzeScreenshotsForUI } from "../lib/agents/uiMockupGenerator";
import type { UIMockupData } from "../lib/agents/uiMockupGenerator";
import type { VideoGenerationStateType } from "../lib/agents/state";
import { submitAndWaitForRender } from "../lib/render/renderClient";
import {
  validateAndFixCodeWithRetry,
  fixBrokenTemplateLiterals,
  isCodeTruncated,
  validateBeforeRender,
  enforceDuration,
} from "../lib/agents/remotionTranslator";
import { FREESTYLE_SYSTEM_PROMPT, buildFreestylePrompt } from "../lib/prompts";
import {
  analyseBrand,
  inferBrandStyleFromText,
  formatBrandStyleForPrompt,
} from "../lib/agents/brandAnalyser";
import {
  enrichProductImages,
  filterImageUrls,
} from "../lib/agents/imageEnrichment";
import { withAgentLogging, logAgentOutput } from "../lib/agentLogger";

const router: Router = Router();

// ============================================================
// Three.js stripping utility — removes all 3D code when WebGL fails
// ============================================================
function stripThreeJs(code: string): string {
  let stripped = code;

  // Remove imports
  stripped = stripped.replace(
    /import\s+\{[^}]*\}\s+from\s+['"]@react-three\/fiber['"];?\n?/g,
    "",
  );
  stripped = stripped.replace(
    /import\s+\{[^}]*\}\s+from\s+['"]@react-three\/drei['"];?\n?/g,
    "",
  );
  stripped = stripped.replace(
    /import\s+\*\s+as\s+THREE\s+from\s+['"]three['"];?\n?/g,
    "",
  );
  stripped = stripped.replace(
    /import\s+\{[^}]*\}\s+from\s+['"]three['"];?\n?/g,
    "",
  );

  // Remove <Canvas ...>...</Canvas> blocks and replace with a dark background placeholder
  stripped = stripped.replace(
    /<Canvas\b[^>]*>[\s\S]*?<\/Canvas>/g,
    '<AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, #1a1a2e 0%, #0a0a0f 100%)" }} />',
  );

  // Remove any remaining standalone drei/fiber component references
  const dreiComponents = [
    "Environment",
    "Stars",
    "OrbitControls",
    "PerspectiveCamera",
    "Float",
    "Text3D",
    "Center",
    "Sky",
    "Cloud",
    "ContactShadows",
    "Sparkles",
    "MeshDistortMaterial",
    "MeshWobbleMaterial",
  ];
  for (const comp of dreiComponents) {
    stripped = stripped.replace(new RegExp(`<${comp}\\b[^/>]*/>`, "g"), "");
    stripped = stripped.replace(
      new RegExp(`<${comp}\\b[^>]*>[\\s\\S]*?</${comp}>`, "g"),
      "",
    );
  }

  // Remove THREE.* references in variable declarations (const geometry = new THREE.BoxGeometry(...))
  stripped = stripped.replace(
    /(?:const|let|var)\s+\w+\s*=\s*new\s+THREE\.\w+\([^)]*\);?\n?/g,
    "",
  );

  console.log(
    "[Freestyle] Stripped Three.js code, new length:",
    stripped.length,
  );
  return stripped;
}

// ============================================================
// POST /freestyle — Gemini Pro creates everything freely
// ============================================================
router.post("/freestyle", async (req: AuthenticatedRequest, res) => {
  console.log(
    `[GenerateServer] POST /api/creative/freestyle | User: ${req.userId}`,
  );

  const credits = await checkAndDeductCredits(req.userId!, COSTS.freestyle);
  if (!credits.ok) {
    return res
      .status(402)
      .json({ error: credits.error, required: COSTS.freestyle });
  }

  try {
    const {
      description,
      url,
      productData,
      videoScript,
      style,
      duration = 15,
      aspectRatio = "16:9",
      audio,
      useThreeJs = false,
    } = req.body;

    const ASPECT_DIMS: Record<string, { width: number; height: number }> = {
      "16:9": { width: 1920, height: 1080 },
      "9:16": { width: 1080, height: 1920 },
      "1:1": { width: 1080, height: 1080 },
      "4:5": { width: 1080, height: 1350 },
    };
    const { width: renderWidth, height: renderHeight } = ASPECT_DIMS[aspectRatio] || ASPECT_DIMS["16:9"];

    if (!description && !videoScript && !productData) {
      return res.status(400).json({
        error: "description, videoScript, or productData is required",
      });
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

      // Step 1: If we have a URL but no productData, scrape first
      let finalProductData = productData;
      if (url && !productData) {
        send("status", { step: "scraping", message: "Analyzing product..." });
        const scraperResult = await withAgentLogging(
          "freestyle-scraper",
          { sourceUrl: url, description },
          () => scraperNode({
            sourceUrl: url,
            description: description || null,
            userPreferences: { style: style || "professional" },
            recordings: [],
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
          } as VideoGenerationStateType),
        );
        if (scraperResult.productData) {
          finalProductData = scraperResult.productData;
          send("productData", finalProductData);
        }
      }

      // Step 2: Brand Analysis + UI Mockup Analysis (run in parallel after scraping)
      // Images/screenshots are only used when the user explicitly requests them
      const useImages = req.body.useImages === true;
      const screenshotsList = useImages ? ((finalProductData as any)?.screenshots || []) : [];
      let uiMockupData: UIMockupData | null = null;
      let brandStyleSection = "";

      // Enrich product images — only when images are explicitly requested
      let enrichedImages: string[] = [];
      if (useImages && finalProductData) {
        try {
          enrichedImages = await enrichProductImages(finalProductData, 4);
          console.log(
            `[Freestyle] Enriched images: ${enrichedImages.length} total`,
          );
        } catch (err) {
          console.warn("[Freestyle] Image enrichment failed (non-fatal):", err);
          // Fallback: just filter existing images
          enrichedImages = filterImageUrls(finalProductData.images || []);
        }
      }

      if (screenshotsList.length > 0 && finalProductData) {
        send("status", {
          step: "analyzing",
          message: "Analyzing brand style and UI components...",
        });

        const heroScreenshot =
          screenshotsList.find((s: any) => s.section === "hero") ||
          screenshotsList[0];

        // Run brand analysis + UI mockup analysis in parallel
        const [brandStyle, uiResult] = await Promise.allSettled([
          heroScreenshot
            ? analyseBrand(
                heroScreenshot,
                finalProductData.name || "Product",
                finalProductData.description,
              )
            : inferBrandStyleFromText(
                finalProductData.name || "Product",
                finalProductData.description || "",
                finalProductData.tone || "professional",
                finalProductData.colors || {},
              ),
          analyzeScreenshotsForUI(screenshotsList, finalProductData),
        ]);

        // Process brand analysis result
        if (brandStyle.status === "fulfilled" && brandStyle.value) {
          brandStyleSection = formatBrandStyleForPrompt(brandStyle.value);
          send("status", {
            step: "brand-analyzed",
            message: `Brand analyzed — ${brandStyle.value.videoStyle?.recommended || "style detected"}`,
          });
          console.log(
            "[Freestyle] Brand analysis complete:",
            brandStyle.value.videoStyle?.recommended,
          );
        } else {
          // Fallback to text-based inference
          try {
            const fallbackBrand = await inferBrandStyleFromText(
              (finalProductData as any).name || "Product",
              (finalProductData as any).description || "",
              (finalProductData as any).tone || "professional",
              (finalProductData as any).colors || {},
            );
            brandStyleSection = formatBrandStyleForPrompt(fallbackBrand);
          } catch (e) {
            console.warn("[Freestyle] Brand fallback also failed:", e);
          }
        }

        // Process UI mockup result
        if (uiResult.status === "fulfilled" && uiResult.value) {
          uiMockupData = uiResult.value;
          send("status", {
            step: "ui-analyzed",
            message: `Extracted ${uiMockupData.components.length} UI components for animation`,
          });
          console.log(
            "[Freestyle] UI mockup analysis complete:",
            uiMockupData.components.length,
            "components",
          );
        }
      } else if (finalProductData) {
        // No screenshots — infer brand from text only
        send("status", {
          step: "analyzing",
          message: "Inferring brand style...",
        });
        try {
          const brand = await inferBrandStyleFromText(
            (finalProductData as any).name || "Product",
            (finalProductData as any).description || "",
            (finalProductData as any).tone || "professional",
            (finalProductData as any).colors || {},
          );
          brandStyleSection = formatBrandStyleForPrompt(brand);
        } catch (e) {
          console.warn("[Freestyle] Text brand inference failed:", e);
        }
      }

      // Step 3: Build the creative prompt
      const audioBpm = audio?.bpm || 120;
      const userPrompt = buildFreestylePrompt(
        durationInFrames,
        duration,
        description,
        finalProductData,
        videoScript,
        useThreeJs,
        audioSrcCode,
        uiMockupData,
        screenshotsList,
        enrichedImages,
        brandStyleSection,
        audioBpm,
      );

      send("status", {
        step: "generating",
        message: "Gemini Pro is creating your video...",
      });

      const llmStart = Date.now();
      const response = await chatWithGeminiPro(
        [
          { role: "system", content: FREESTYLE_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        { temperature: 0.7, maxTokens: 16000 },
      );
      logAgentOutput("freestyle-llm", { description, duration, style }, {
        codeLength: response.content.length,
        currentStep: "generating",
      }, Date.now() - llmStart);

      let code = response.content;

      // Extract code block if wrapped in markdown
      const codeBlockMatch = code.match(
        /```(?:tsx?|jsx?|javascript)?\s*([\s\S]*?)```/,
      );
      if (codeBlockMatch) {
        code = codeBlockMatch[1].trim();
      }

      // Check for truncated LLM output — regenerate with LLM rather than using fallback
      if (isCodeTruncated(code)) {
        console.warn(
          "[Freestyle] Code appears truncated, requesting regeneration...",
        );
        const regenResponse = await chatWithGeminiPro(
          [
            { role: "system", content: FREESTYLE_SYSTEM_PROMPT },
            {
              role: "user",
              content: userPrompt,
              // +                "\n\nIMPORTANT: Keep the code SHORT and COMPLETE. Max 300 lines. Do NOT use Three.js or @react-three. Use only 2D effects. MUST end with export default.",
            },
          ],
          { temperature: 0.5, maxTokens: 16000 },
        );
        let regenCode = regenResponse.content;
        const regenMatch = regenCode.match(
          /```(?:tsx?|jsx?|javascript)?\s*([\s\S]*?)```/,
        );
        if (regenMatch) regenCode = regenMatch[1].trim();
        if (!isCodeTruncated(regenCode)) {
          code = regenCode;
        }
        // If still truncated, continue with what we have — the fix loop will handle it
      }

      // Basic validation
      if (!code.includes("export default")) {
        const componentMatch = code.match(
          /(?:const|function|class)\s+([A-Z][a-zA-Z0-9]*)/,
        );
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
        console.log(`[Freestyle] Static analysis: ${staticAnalysis.errors.length} errors, ${staticAnalysis.warnings.length} warnings — auto-fixing`);
        code = staticAnalysis.autoFixed;
      }

      // Enforce duration coverage
      const freestyleTargetFrames = duration ? parseInt(duration) * 30 : 900;
      code = enforceDuration(code, freestyleTargetFrames);
      send("remotionCode", code);

      // Step 3: Render the video with retry loop
      const maxAttempts = 3;
      let currentCode = code;
      let renderSuccess = false;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        send("status", {
          step: "rendering",
          message: `Rendering video (attempt ${attempt}/${maxAttempts})...`,
        });

        // Aggressively fix broken template literals first
        currentCode = fixBrokenTemplateLiterals(currentCode);

        // Validate and fix code with retry loop
        const { code: validatedCode, issues: fixIssues } =
          validateAndFixCodeWithRetry(currentCode, 3);
        if (fixIssues.length > 0) {
          console.log(
            `[Freestyle] Pre-render fixes (attempt ${attempt}):`,
            fixIssues,
          );
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
        console.warn(
          `[Freestyle] Render attempt ${attempt} failed:`,
          renderError,
        );

        // If it's a Three.js/WebGL/R3F error, strip Three.js and retry immediately
        const isThreeJsError =
          renderError &&
          (renderError.includes("WebGL") ||
            renderError.includes("R3F") ||
            renderError.includes("Canvas component") ||
            renderError.includes("useThree") ||
            renderError.includes("three"));

        if (isThreeJsError) {
          console.warn(
            "[Freestyle] Three.js/WebGL error detected, stripping 3D code...",
          );
          // currentCode = stripThreeJs(currentCode);
          send("remotionCode", currentCode);
          continue;
        }

        // Don't try to fix on last attempt
        if (attempt >= maxAttempts) {
          send("error", {
            errors: [
              renderError || "Rendering failed after all attempts",
            ],
          });
          send("complete", { success: false });
          break;
        }

        // Try to fix render errors with LLM
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
- Three.js components outside <Canvas>
- WebGL context failures (remove Three.js/Canvas if not essential)

Return ONLY the fixed TSX code.`;

        const fixResponse = await chatWithGeminiPro(
          [{ role: "user", content: fixPrompt }],
          { temperature: 0.2, maxTokens: 16000 },
        );

        let fixedCode = fixResponse.content;
        const fixMatch = fixedCode.match(
          /```(?:tsx?|jsx?|javascript)?\s*([\s\S]*?)```/,
        );
        if (fixMatch) fixedCode = fixMatch[1].trim();

        // Check for truncated fix output — keep current code if fix is truncated
        if (isCodeTruncated(fixedCode)) {
          console.warn(
            "[Freestyle] Fix code appears truncated, keeping previous code for next attempt",
          );
          continue;
        }

        currentCode = fixedCode;
        send("remotionCode", currentCode);
      }
    } catch (error) {
      console.error("[Freestyle] Stream error:", error);
      send("error", {
        errors: [error instanceof Error ? error.message : "Unknown error"],
      });
      send("complete", { success: false });
    } finally {
      res.end();
    }
  } catch (error) {
    console.error("[Freestyle] Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Freestyle generation failed" });
    }
  }
});

export default router;
