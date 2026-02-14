/**
 * CREATIVE GENERATION API - Project-Based with Persistence
 *
 * Runs the video generation pipeline and persists data to the database.
 *
 * POST /api/creative/generate
 * Body: { description?: string, url?: string, style?: string, videoType?: string, projectId: string }
 *
 * Returns: Streaming events for each pipeline stage
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { scraperNode } from "@/lib/agents/scraper";
import { scriptWriterNode } from "@/lib/agents/scriptWriter";
import type { VideoGenerationStateType } from "@/lib/agents/state";
import { auth } from "@/auth";
import { checkAndDeductCredits } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 300;

const SCRIPT_GEN_COST = 1;

export async function POST(request: NextRequest) {
  console.log("[CreativeAPI] Starting LangGraph workflow with persistence...");

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const body = await request.json();
    const {
      description,
      url,
      style = "professional",
      templateStyle,
      videoType = "creative",
      duration,
      audio,
      recordings,
      projectId,
    } = body;

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: "projectId is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!description && !url) {
      return new Response(
        JSON.stringify({ error: "URL or description is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Check and deduct credits
    try {
      await checkAndDeductCredits(session.user.id, SCRIPT_GEN_COST);
    } catch (e) {
      if (e instanceof Error && e.message === "INSUFFICIENT_CREDITS") {
        return new Response(
          JSON.stringify({ error: "Insufficient credits", required: SCRIPT_GEN_COST, balance: session.user.creditBalance }),
          { status: 402, headers: { "Content-Type": "application/json" } },
        );
      }
      throw e;
    }

    console.log(`[CreativeAPI] Generating for project ${projectId}: "${description}"`);
    console.log(`[CreativeAPI] Style: ${style}, VideoType: ${videoType}, Duration: ${duration}s`);

    // Update project status to GENERATING
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "GENERATING" },
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (type: string, data: any) => {
          controller.enqueue(encoder.encode(JSON.stringify({ type, data }) + "\n"));
        };

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
            projectId,
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
            
            // Persist productData to database
            try {
              await prisma.project.update({
                where: { id: projectId },
                data: { 
                  productData: JSON.stringify(state.productData),
                  sourceUrl: url || state.sourceUrl,
                },
              });
              console.log("[CreativeAPI] Saved productData to database");
            } catch (dbError) {
              console.error("[CreativeAPI] Failed to save productData:", dbError);
            }
          }

          if (state.currentStep === "error") {
            send("error", { errors: state.errors });
            await prisma.project.update({
              where: { id: projectId },
              data: { status: "DRAFT" },
            });
            send("complete", { success: false });
            controller.close();
            return;
          }

          // Step 2: Script Writer
          send("status", { step: "scripting", message: "Writing video script..." });
          const scriptResult = await scriptWriterNode(state as VideoGenerationStateType);
          state = { ...state, ...scriptResult };

          if (state.videoScript) {
            send("videoScript", state.videoScript);
            
            // Persist script to database
            try {
              await prisma.project.update({
                where: { id: projectId },
                data: { 
                  script: JSON.stringify(state.videoScript),
                  description: description || state.description,
                  status: "DRAFT",
                },
              });
              console.log("[CreativeAPI] Saved script to database");
            } catch (dbError) {
              console.error("[CreativeAPI] Failed to save script:", dbError);
            }
          }

          if (state.currentStep === "error") {
            send("error", { errors: state.errors });
            await prisma.project.update({
              where: { id: projectId },
              data: { status: "DRAFT" },
            });
          }

          send("complete", { success: true, message: "Script ready for review" });
        } catch (error) {
          console.error("[CreativeAPI] Stream error:", error);
          try {
            send("error", {
              errors: [error instanceof Error ? error.message : "Unknown error"],
            });
            send("complete", { success: false });
            
            // Reset project status on error
            await prisma.project.update({
              where: { id: projectId },
              data: { status: "DRAFT" },
            });
          } catch (sendError) {
            console.error("[CreativeAPI] Failed to send error:", sendError);
          }
        } finally {
          try {
            controller.close();
          } catch (closeError) {
            console.error("[CreativeAPI] Controller already closed:", closeError);
          }
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
    console.error("[CreativeAPI] Error:", error);
    return new Response(
      JSON.stringify({
        error: "Creative generation failed",
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
      endpoint: "/api/creative/generate",
      method: "POST",
      body: {
        projectId: "string (required) - Project ID to save data to",
        url: "string (optional) - Product URL to scrape",
        description: "string (optional) - What the video is about (required if no url)",
        style: "string (optional) - professional, playful, minimal, bold",
        templateStyle: "string (optional) - aurora, floating-glass, blue-clean",
        videoType: "string (optional) - demo, creative, fast-paced, cinematic",
        duration: "number (optional) - Video length in seconds (10-120)",
        audio: "object (optional) - { url: string, bpm?: number, duration?: number }",
        recordings: "array (optional) - Screen recordings data",
      },
      returns: "Streaming events: productData, videoScript, status, error, complete",
      persistence: "Product data and script are automatically saved to the project",
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}
