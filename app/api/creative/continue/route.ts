/**
 * CONTINUE GENERATION API - Project-Based with Persistence
 *
 * POST /api/creative/continue
 * Body: { videoScript, productData, userPreferences, projectId, recordings? }
 *
 * Runs: reactPageGenerator → remotionTranslator → videoRenderer
 * Returns: Streaming events and persists composition and videoUrl to database
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { reactPageGeneratorNode } from "@/lib/agents/reactPageGenerator";
import { remotionTranslatorNode } from "@/lib/agents/remotionTranslator";
import { videoRendererNode } from "@/lib/agents/videoRenderer";
import { renderErrorFixerNode } from "@/lib/agents/renderErrorFixer";
import type { VideoGenerationStateType } from "@/lib/agents/state";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  console.log("[ContinueAPI] Starting from approved script with persistence...");

  try {
    const body = await request.json();
    const {
      videoScript,
      productData,
      userPreferences = { style: "professional" },
      recordings,
      projectId,
    } = body;

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: "projectId is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!videoScript) {
      return new Response(
        JSON.stringify({ error: "videoScript is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Update project status to GENERATING
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "GENERATING" },
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;
        const send = (type: string, data: any) => {
          if (closed) return;
          controller.enqueue(encoder.encode(JSON.stringify({ type, data }) + "\n"));
        };
        const close = () => {
          if (!closed) { closed = true; controller.close(); }
        };

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
            projectId,
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
            await prisma.project.update({
              where: { id: projectId },
              data: { status: "DRAFT" },
            });
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
            
            // Persist composition to database
            try {
              await prisma.project.update({
                where: { id: projectId },
                data: { 
                  composition: translatorResult.remotionCode,
                  status: "GENERATING",
                },
              });
              console.log("[ContinueAPI] Saved composition to database");
            } catch (dbError) {
              console.error("[ContinueAPI] Failed to save composition:", dbError);
            }
          }

          if (state.currentStep === "error") {
            send("error", { errors: state.errors });
            await prisma.project.update({
              where: { id: projectId },
              data: { status: "DRAFT" },
            });
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
              
              // Persist video URL to database
              try {
                await prisma.project.update({
                  where: { id: projectId },
                  data: { 
                    audioUrl: state.videoUrl,
                    status: "READY",
                  },
                });
                console.log("[ContinueAPI] Saved video URL to database");
              } catch (dbError) {
                console.error("[ContinueAPI] Failed to save video URL:", dbError);
              }
              break;
            }

            if (state.currentStep === "fixing" && attempts < maxAttempts) {
              send("status", { step: "fixing", message: `Fixing render errors (attempt ${attempts})...` });
              const fixResult = await renderErrorFixerNode(state as VideoGenerationStateType);
              state = { ...state, ...fixResult };
              if (fixResult.remotionCode) {
                send("remotionCode", fixResult.remotionCode);
                
                // Update composition after fix
                try {
                  await prisma.project.update({
                    where: { id: projectId },
                    data: { composition: fixResult.remotionCode },
                  });
                } catch (dbError) {
                  console.error("[ContinueAPI] Failed to update composition:", dbError);
                }
              }
            } else if (state.currentStep === "error") {
              send("error", { errors: state.errors });
              await prisma.project.update({
                where: { id: projectId },
                data: { status: "DRAFT" },
              });
              break;
            }
          }

          send("complete", { success: true, message: "Video generation complete" });
        } catch (error) {
          console.error("[ContinueAPI] Stream error:", error);
          send("error", {
            errors: [error instanceof Error ? error.message : "Unknown error"],
          });
          
          // Reset project status on error
          try {
            await prisma.project.update({
              where: { id: projectId },
              data: { status: "DRAFT" },
            });
          } catch (dbError) {
            console.error("[ContinueAPI] Failed to reset project status:", dbError);
          }
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

// GET for testing
export async function GET() {
  return new Response(
    JSON.stringify({
      endpoint: "/api/creative/continue",
      method: "POST",
      body: {
        projectId: "string (required) - Project ID to save data to",
        videoScript: "object (required) - The approved video script",
        productData: "object (optional) - Product data from scraper",
        userPreferences: "object (optional) - Style, duration, etc.",
        recordings: "array (optional) - Screen recordings data",
      },
      returns: "Streaming events: remotionCode, videoUrl, status, error, complete",
      persistence: "Composition and video URL are automatically saved to the project",
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}
