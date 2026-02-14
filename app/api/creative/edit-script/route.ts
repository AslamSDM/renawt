/**
 * EDIT SCRIPT API - Chat-based script editing via LLM
 *
 * POST /api/creative/edit-script
 * Body: { message, videoScript, productData? }
 *
 * Sends the current script + user's edit instruction to the LLM.
 * Returns the updated VideoScript JSON.
 */

import { NextRequest, NextResponse } from "next/server";
import { chatWithKimi } from "@/lib/agents/model";
import { auth } from "@/auth";
import { checkAndDeductCredits } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

const EDIT_SCRIPT_COST = 1;

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

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Check and deduct credits
    try {
      await checkAndDeductCredits(session.user.id, EDIT_SCRIPT_COST);
    } catch (e) {
      if (e instanceof Error && e.message === "INSUFFICIENT_CREDITS") {
        return NextResponse.json(
          { error: "Insufficient credits", required: EDIT_SCRIPT_COST, balance: session.user.creditBalance },
          { status: 402 },
        );
      }
      throw e;
    }

    const body = await request.json();
    const { message, videoScript, productData } = body;

    if (!message || !videoScript) {
      return NextResponse.json(
        { error: "message and videoScript are required" },
        { status: 400 },
      );
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

    // Extract JSON from response
    const content = response.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[EditScript] Failed to extract JSON from response");
      return NextResponse.json(
        { error: "Failed to parse edited script" },
        { status: 500 },
      );
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

    return NextResponse.json({ success: true, videoScript: updatedScript });
  } catch (error) {
    console.error("[EditScript] Error:", error);
    return NextResponse.json(
      {
        error: "Script editing failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
