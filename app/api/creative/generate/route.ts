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
import { streamVideoGeneration } from "@/lib/agents/graph";

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
    } = body;

    if (!description && !url) {
      return new Response(
        JSON.stringify({ error: "URL or description is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    console.log(`[CreativeAPI] Generating for: "${description}"`);
    console.log(`[CreativeAPI] Style: ${style}, VideoType: ${videoType}, Duration: ${duration}s`);

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Run the LangGraph workflow (no projectId = no DB persistence)
          const generator = streamVideoGeneration({
            sourceUrl: url || null,
            description,
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
            // No projectId - skip DB persistence
          });

          for await (const chunk of generator) {
            // Handle scraper output
            if (chunk.scraper) {
              const state = chunk.scraper;
              if (state.productData) {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: "productData",
                      data: state.productData,
                    }) + "\n",
                  ),
                );
              }
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: "status",
                    data: { step: "scraping", message: "Analyzing product..." },
                  }) + "\n",
                ),
              );
            }

            // Handle scriptWriter output
            if (chunk.scriptWriter) {
              const state = chunk.scriptWriter;
              if (state.videoScript) {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: "videoScript",
                      data: state.videoScript,
                    }) + "\n",
                  ),
                );
              }
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: "status",
                    data: {
                      step: "scripting",
                      message: "Writing video script...",
                    },
                  }) + "\n",
                ),
              );
            }

            // // Handle demoScriptWriter output
            // if (chunk.demoScriptWriter) {
            //   const state = chunk.demoScriptWriter;
            //   if (state.videoScript) {
            //     controller.enqueue(
            //       encoder.encode(
            //         JSON.stringify({
            //           type: "videoScript",
            //           data: state.videoScript,
            //         }) + "\n",
            //       ),
            //     );
            //   }
            //   controller.enqueue(
            //     encoder.encode(
            //       JSON.stringify({
            //         type: "status",
            //         data: {
            //           step: "scripting",
            //           message: "Writing demo script...",
            //         },
            //       }) + "\n",
            //     ),
            //   );
            // }

            // Handle reactPageGenerator output (Step 1)
            if (chunk.reactPageGenerator) {
              const state = chunk.reactPageGenerator;
              if (state.reactPageCode) {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: "reactPageCode",
                      data: state.reactPageCode,
                    }) + "\n",
                  ),
                );
              }
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: "status",
                    data: {
                      step: "generating",
                      message: "Generating React page...",
                    },
                  }) + "\n",
                ),
              );
            }

            // Handle remotionTranslator output (Step 2)
            if (chunk.remotionTranslator) {
              const state = chunk.remotionTranslator;
              if (state.remotionCode) {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: "remotionCode",
                      data: state.remotionCode,
                    }) + "\n",
                  ),
                );
              }
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: "status",
                    data: {
                      step: "translating",
                      message: "Translating to Remotion...",
                    },
                  }) + "\n",
                ),
              );
            }

            // Handle videoRenderer output (Step 3 - with retry loop)
            if (chunk.videoRenderer) {
              const state = chunk.videoRenderer;

              // If video URL is available, rendering succeeded
              if (state.videoUrl) {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: "videoUrl",
                      data: state.videoUrl,
                    }) + "\n",
                  ),
                );
              }

              // Report render status
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: "status",
                    data: {
                      step: "rendering",
                      message: state.videoUrl
                        ? "Video rendered successfully!"
                        : `Rendering video (attempt ${state.renderAttempts})...`,
                      attempts: state.renderAttempts,
                    },
                  }) + "\n",
                ),
              );
            }

            // Handle renderErrorFixer output (Step 4 - fixes render errors)
            if (chunk.renderErrorFixer) {
              const state = chunk.renderErrorFixer;

              // If fixed code is available
              if (state.remotionCode) {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: "remotionCode",
                      data: state.remotionCode,
                    }) + "\n",
                  ),
                );
              }

              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: "status",
                    data: {
                      step: "fixing",
                      message: `Fixing render errors (attempt ${state.renderAttempts})...`,
                      attempts: state.renderAttempts,
                    },
                  }) + "\n",
                ),
              );
            }

            // Handle errors
            if (chunk.errorHandler) {
              const state = chunk.errorHandler;
              if (state.errors && state.errors.length > 0) {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: "error",
                      data: { errors: state.errors },
                    }) + "\n",
                  ),
                );
              }
            }
          }

          // Send completion with video URL if available
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "complete",
                data: {
                  success: true,
                  message: "Video generation complete",
                },
              }) + "\n",
            ),
          );
        } catch (error) {
          console.error("[CreativeAPI] Stream error:", error);
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "error",
                data: {
                  errors: [
                    error instanceof Error ? error.message : "Unknown error",
                  ],
                },
              }) + "\n",
            ),
          );
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
