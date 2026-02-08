/**
 * CREATIVE GENERATION API - Uses LangGraph Workflow (No DB)
 *
 * Runs the full video generation pipeline without database persistence.
 *
 * POST /api/creative/generate
 * Body: { description?: string, url?: string, style?: string, videoType?: string }
 *
 * Returns: Streaming events for each pipeline stage
 */

import { NextRequest } from "next/server";
import { scraperNode } from "@/lib/agents/scraper";
import { scriptWriterNode } from "@/lib/agents/scriptWriter";
import type { VideoGenerationStateType } from "@/lib/agents/state";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  console.log("[CreativeAPI] Starting LangGraph workflow...");

  try {
    const body = await request.json();
    const {
      description,
      url,
      style = "professional",
      videoType = "creative",
      duration,
      audio,
      recordings,
    } = body;

    if (!description && !url) {
      return new Response(
        JSON.stringify({ error: "URL or description is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    console.log(`[CreativeAPI] Generating for: "${description}"`);
    console.log(`[CreativeAPI] Style: ${style}, VideoType: ${videoType}, Duration: ${duration}s`);

    // Create a streaming response — runs scraper + scriptWriter only, stops for review
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (type: string, data: any) => {
          controller.enqueue(encoder.encode(JSON.stringify({ type, data }) + "\n"));
        };

        try {
          // Build initial state for direct node calls
          let state: Partial<VideoGenerationStateType> = {
            sourceUrl: url || null,
            description: description || null,
            userPreferences: {
              style: style as any,
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
            projectId: null,
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
            controller.close();
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

          // Stop here — UI will review and then call /api/creative/continue
          send("complete", { success: true, message: "Script ready for review" });
        } catch (error) {
          console.error("[CreativeAPI] Stream error:", error);
          send("error", {
            errors: [error instanceof Error ? error.message : "Unknown error"],
          });
        } finally {
          controller.close();
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
        url: "string (optional) - Product URL to scrape",
        description: "string (optional) - What the video is about (required if no url)",
        style: "string (optional) - professional, playful, minimal, bold",
        videoType: "string (optional) - demo, creative, fast-paced, cinematic",
        duration: "number (optional) - Video length in seconds (10-120)",
        audio: "object (optional) - { url: string, bpm?: number, duration?: number }",
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
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}
