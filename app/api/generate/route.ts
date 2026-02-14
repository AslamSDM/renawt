import { NextRequest, NextResponse } from "next/server";
import { streamVideoGeneration } from "@/lib/agents/graph";
import { prisma } from "@/lib/db/prisma";
import { GenerateRequestSchema } from "@/lib/types";
import { auth } from "@/auth";
import { checkAndDeductCredits } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max for video generation

const FULL_PIPELINE_COST = 5; // 1 script + 4 render

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();

    // Validate request
    const parseResult = GenerateRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { url, description, preferences } = parseResult.data;

    if (!url && !description) {
      return NextResponse.json(
        { error: "Either URL or description is required" },
        { status: 400 }
      );
    }

    // Check and deduct credits
    try {
      await checkAndDeductCredits(session.user.id, FULL_PIPELINE_COST);
    } catch (e) {
      if (e instanceof Error && e.message === "INSUFFICIENT_CREDITS") {
        return NextResponse.json(
          { error: "Insufficient credits", required: FULL_PIPELINE_COST, balance: session.user.creditBalance },
          { status: 402 }
        );
      }
      throw e;
    }

    // Create project in database
    const project = await prisma.project.create({
      data: {
        userId: session.user.id,
        sourceUrl: url,
        description,
        status: "GENERATING",
      },
    });

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial status
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "status",
                data: { step: "scraping", projectId: project.id },
              }) + "\n"
            )
          );

          // Run the LangGraph workflow
          const generator = streamVideoGeneration({
            sourceUrl: url || null,
            description: description || null,
            userPreferences: preferences,
            projectId: project.id,
          });

          for await (const chunk of generator) {
            // Handle scraper node output
            if (chunk.scraper) {
              const state = chunk.scraper;
              if (state.productData) {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: "productData",
                      data: state.productData,
                    }) + "\n"
                  )
                );

                // Update project with product data
                await prisma.project.update({
                  where: { id: project.id },
                  data: { productData: JSON.stringify(state.productData) },
                });
              }
              if (state.currentStep) {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: "status",
                      data: { step: state.currentStep },
                    }) + "\n"
                  )
                );
              }
            }

            // Handle scriptWriter node output
            if (chunk.scriptWriter) {
              const state = chunk.scriptWriter;
              if (state.videoScript) {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: "videoScript",
                      data: state.videoScript,
                    }) + "\n"
                  )
                );

                // Update project with video script
                await prisma.project.update({
                  where: { id: project.id },
                  data: { script: JSON.stringify(state.videoScript) },
                });
              }
              if (state.currentStep) {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: "status",
                      data: { step: state.currentStep },
                    }) + "\n"
                  )
                );
              }
            }

            // Handle demoScriptWriter node output (same as scriptWriter)
            if (chunk.demoScriptWriter) {
              const state = chunk.demoScriptWriter;
              if (state.videoScript) {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: "videoScript",
                      data: state.videoScript,
                    }) + "\n"
                  )
                );

                await prisma.project.update({
                  where: { id: project.id },
                  data: { script: JSON.stringify(state.videoScript) },
                });
              }
              if (state.currentStep) {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: "status",
                      data: { step: state.currentStep },
                    }) + "\n"
                  )
                );
              }
            }

            // Handle reactPageGenerator node output (Step 1 of code gen)
            if (chunk.reactPageGenerator) {
              const state = chunk.reactPageGenerator;
              if (state.reactPageCode) {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: "reactPageCode",
                      data: state.reactPageCode,
                    }) + "\n"
                  )
                );

                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: "status",
                      data: { step: "translating", message: "Translating React to Remotion..." },
                    }) + "\n"
                  )
                );
              }
            }

            // Handle remotionTranslator node output (Step 2 of code gen)
            if (chunk.remotionTranslator) {
              const state = chunk.remotionTranslator;
              if (state.remotionCode) {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: "remotionCode",
                      data: state.remotionCode,
                    }) + "\n"
                  )
                );

                // Update project with remotion code
                await prisma.project.update({
                  where: { id: project.id },
                  data: {
                    composition: state.remotionCode,
                    status: "READY",
                  },
                });
              }
              if (state.currentStep) {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: "status",
                      data: { step: state.currentStep },
                    }) + "\n"
                  )
                );
              }
            }

            // Handle errorHandler node output
            if (chunk.errorHandler) {
              const state = chunk.errorHandler;
              if (state.errors && state.errors.length > 0) {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: "error",
                      data: { errors: state.errors },
                    }) + "\n"
                  )
                );

                await prisma.project.update({
                  where: { id: project.id },
                  data: { status: "DRAFT" },
                });
              }
            }
          }

          // Send completion
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "complete",
                data: { projectId: project.id },
              }) + "\n"
            )
          );
        } catch (error) {
          console.error("Stream error:", error);
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "error",
                data: {
                  errors: [
                    error instanceof Error ? error.message : "Unknown error",
                  ],
                },
              }) + "\n"
            )
          );

          await prisma.project.update({
            where: { id: project.id },
            data: { status: "DRAFT" },
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
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
