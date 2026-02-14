import { NextRequest } from "next/server";
import { chatWithKimi } from "@/lib/agents/model";
import { hasBasicSyntaxErrors, validateAndFixCode } from "@/lib/agents/remotionTranslator";
import { auth } from "@/auth";
import { checkAndDeductCredits } from "@/lib/db";

const EDIT_VIDEO_COST = 1;

/**
 * POST /api/creative/edit-video
 * Edit a rendered video via chat and re-render
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(
      JSON.stringify({ error: "Authentication required" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  // Check and deduct credits before starting stream
  try {
    await checkAndDeductCredits(session.user.id, EDIT_VIDEO_COST);
  } catch (e) {
    if (e instanceof Error && e.message === "INSUFFICIENT_CREDITS") {
      return new Response(
        JSON.stringify({ error: "Insufficient credits", required: EDIT_VIDEO_COST, balance: session.user.creditBalance }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      );
    }
    throw e;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: any) => {
        controller.enqueue(encoder.encode(JSON.stringify({ type, data }) + "\n"));
      };

      try {
        const body = await request.json();
        const {
          message,
          remotionCode,
          videoScript,
          productData,
          userPreferences,
          recordings
        } = body;

        if (!message || !remotionCode) {
          send("error", { errors: ["Message and video composition are required"] });
          controller.close();
          return;
        }

        send("status", { step: "editing", message: "Analyzing your request..." });

        // Step 1: Apply chat-based edits to the video composition
        const editPrompt = `You are a video editor. The user wants to modify their video via chat.

USER REQUEST: "${message}"

CURRENT VIDEO COMPOSITION:
\`\`\`tsx
${remotionCode}
\`\`\`

VIDEO SCRIPT CONTEXT:
${JSON.stringify(videoScript, null, 2)}

INSTRUCTIONS:
1. Analyze the user's request and determine what changes to make
2. Modify the video composition to implement the requested changes
3. Keep all existing imports, types, and helper functions
4. Only change what's necessary to fulfill the request
5. Ensure the composition remains valid TypeScript/React
6. Maintain the same structure: imports → components → scenes → composition

COMMON EDITS:
- "make it faster" → Reduce scene durations by 30%
- "change colors" → Update the COLORS constant
- "add more text" → Add additional text elements to scenes
- "zoom in on X" → Add zoom effects to specific timestamps
- "make text bigger" → Increase font sizes
- "add background" → Add gradient/aurora backgrounds
- "change music" → Just acknowledge (music is handled separately)

Return ONLY the complete modified video composition as a TypeScript code block.
Do not include explanations or markdown outside the code block.`;

        send("status", { step: "generating", message: "Applying your edits..." });

        const editResponse = await chatWithKimi([{ role: "user", content: editPrompt }], {
          temperature: 0.3,
          maxTokens: 16000,
        });

        let editedCode = editResponse.content;
        
        // Extract code from markdown if present
        const codeBlockMatch = editedCode.match(/```(?:tsx?|typescript)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
          editedCode = codeBlockMatch[1].trim();
        }

        send("status", { step: "validating", message: "Validating composition..." });

        // Step 2: Validate and fix syntax errors
        const { code: validatedCode, issues } = validateAndFixCode(editedCode);
        
        if (issues.length > 0) {
          console.log("[EditVideo] Fixed issues:", issues);
        }

        // Check for remaining syntax errors
        let finalCode = validatedCode;
        const syntaxErrors = hasBasicSyntaxErrors(validatedCode);
        
        if (syntaxErrors.length > 0) {
          console.warn("[EditVideo] Syntax errors found:", syntaxErrors);
          send("status", { step: "fixing", message: "Fixing syntax errors..." });

          // Try to fix with LLM
          const fixPrompt = `Fix these syntax errors in the video composition:

ERRORS:
${syntaxErrors.join("\n")}

CODE:
\`\`\`tsx
${validatedCode}
\`\`\`

Return ONLY the fixed code. Ensure it's valid TypeScript/React with no syntax errors.`;

          const fixResponse = await chatWithKimi([{ role: "user", content: fixPrompt }], {
            temperature: 0.2,
            maxTokens: 16000,
          });

          const fixedCodeMatch = fixResponse.content.match(/```(?:tsx?|typescript)?\s*([\s\S]*?)```/);
          const fixedCode = fixedCodeMatch ? fixedCodeMatch[1].trim() : fixResponse.content;
          
          // Validate again
          const finalCheck = hasBasicSyntaxErrors(fixedCode);
          if (finalCheck.length === 0) {
            finalCode = fixedCode;
            send("status", { step: "fixed", message: "Syntax errors fixed!" });
          } else {
            console.warn("[EditVideo] Could not fix all errors, using best attempt");
            finalCode = fixedCode;
          }
        }

        send("remotionCode", finalCode);
        send("status", { step: "complete", message: "Video composition updated!" });
        send("complete", { success: true });

      } catch (error) {
        console.error("[EditVideo] Error:", error);
        send("error", { 
          errors: [error instanceof Error ? error.message : "Unknown error"] 
        });
        send("complete", { success: false });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
