import { NextRequest } from "next/server";
import { renderVideo } from "@/lib/render/ssrRenderer";

/**
 * POST /api/creative/render
 * Render a video from Remotion code
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: any) => {
        controller.enqueue(encoder.encode(JSON.stringify({ type, data }) + "\n"));
      };

      try {
        const body = await request.json();
        const { remotionCode, projectId, audio, durationInFrames } = body;

        if (!remotionCode) {
          send("error", { errors: ["Video composition is required"] });
          controller.close();
          return;
        }

        send("status", { step: "rendering", message: "Starting video render...", progress: 10 });

        // Render the video
        const result = await renderVideo({
          remotionCode,
          durationInFrames: durationInFrames || 300,
          outputFormat: "mp4",
          width: 1920,
          height: 1080,
          fps: 30,
        });

        if (result.success && result.videoUrl) {
          send("videoUrl", result.videoUrl);
          send("status", { step: "complete", message: "Video rendered successfully!", progress: 100 });
          send("complete", { success: true });
        } else {
          send("error", { errors: [result.error || "Rendering failed"] });
          send("complete", { success: false });
        }

      } catch (error) {
        console.error("[Render API] Error:", error);
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
