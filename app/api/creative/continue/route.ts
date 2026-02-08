/**
 * CONTINUE GENERATION API - Runs pipeline from approved script onward
 *
 * POST /api/creative/continue
 * Body: { videoScript, productData, userPreferences, recordings? }
 *
 * Runs: reactPageGenerator → remotionTranslator → videoRenderer (with error fix loop)
 * Returns: Streaming events for each pipeline stage
 */

import { NextRequest } from "next/server";
import { reactPageGeneratorNode } from "@/lib/agents/reactPageGenerator";
import { remotionTranslatorNode } from "@/lib/agents/remotionTranslator";
import { videoRendererNode } from "@/lib/agents/videoRenderer";
import { renderErrorFixerNode } from "@/lib/agents/renderErrorFixer";
import type { VideoGenerationStateType } from "@/lib/agents/state";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  console.log("[ContinueAPI] Starting from approved script...");

  try {
    const body = await request.json();
    const {
      videoScript,
      productData,
      userPreferences = { style: "professional" },
      recordings,
    } = body;

    if (!videoScript) {
      return new Response(
        JSON.stringify({ error: "videoScript is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;
        const send = (type: string, data: any) => {
          if (closed) return;
          controller.enqueue(
            encoder.encode(JSON.stringify({ type, data }) + "\n"),
          );
        };
        const close = () => {
          if (!closed) { closed = true; controller.close(); }
        };

        try {
          // Build initial state
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
            projectId: null,
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
            close();
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
            close();
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
          console.error("[ContinueAPI] Stream error:", error);
          send("error", {
            errors: [error instanceof Error ? error.message : "Unknown error"],
          });
        } finally {
          close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[ContinueAPI] Error:", error);
    return new Response(
      JSON.stringify({
        error: "Continue generation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
