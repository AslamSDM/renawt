/**
 * Google Veo 3 Video Generation Service
 *
 * Generates short video clips (2-5 seconds) from text prompts
 * using the Google Veo 3 API via Vertex AI / Google AI Studio.
 *
 * Flow:
 *  1. Submit a generation request with a text prompt (+ optional reference image)
 *  2. Poll for completion
 *  3. Download the generated video clip
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

// Google AI Studio / Vertex AI configuration
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;
const VEO_MODEL = process.env.VEO_MODEL || "veo-3.0-generate-preview";
const VEO_BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${VEO_MODEL}`;

// Output directory for generated clips
const CLIPS_DIR = join(process.cwd(), "tmp", "clips");

export interface VeoGenerateRequest {
  /** Text prompt describing the desired video clip */
  prompt: string;
  /** Reference image URL or base64 (optional — used as the "start frame") */
  referenceImageUrl?: string;
  /** Desired clip duration in seconds (2-5, clamped) */
  durationSec?: number;
  /** Aspect ratio */
  aspectRatio?: "16:9" | "9:16" | "1:1";
  /** Number of clips to generate (1-4) */
  numberOfVideos?: number;
}

export interface VeoClip {
  /** Local file path of the downloaded MP4 clip */
  filePath: string;
  /** Duration in seconds */
  durationSec: number;
  /** The prompt used to generate this clip */
  prompt: string;
}

export interface VeoGenerateResult {
  success: boolean;
  clips?: VeoClip[];
  error?: string;
}

/**
 * Check if Veo is configured
 */
export function isVeoConfigured(): boolean {
  return !!GOOGLE_AI_API_KEY;
}

/**
 * Generate a video clip using Google Veo 3.
 *
 * Uses the generateVideos endpoint from Google AI Studio (Gemini API).
 * The API returns a long-running operation that we poll until complete.
 */
export async function generateVideoClip(
  request: VeoGenerateRequest,
): Promise<VeoGenerateResult> {
  if (!GOOGLE_AI_API_KEY) {
    return {
      success: false,
      error: "GOOGLE_AI_API_KEY environment variable is not set",
    };
  }

  const {
    prompt,
    referenceImageUrl,
    durationSec = 4,
    aspectRatio = "16:9",
    numberOfVideos = 1,
  } = request;

  // Clamp duration to 2-8 seconds (Veo 3 supports up to 8s)
  const clampedDuration = Math.min(8, Math.max(2, durationSec));

  console.log(
    `[Veo3] Generating clip: "${prompt.substring(0, 80)}..." (${clampedDuration}s, ${aspectRatio})`,
  );

  try {
    // Build the request body for Veo 3
    const requestBody: any = {
      instances: [
        {
          prompt,
        },
      ],
      parameters: {
        aspectRatio,
        durationSeconds: clampedDuration,
        numberOfVideos,
        personGeneration: "allow_all",
      },
    };

    // If a reference image is provided, include it as the start frame
    if (referenceImageUrl) {
      if (referenceImageUrl.startsWith("data:")) {
        // Already base64
        const match = referenceImageUrl.match(/data:([^;]+);base64,(.+)/);
        if (match) {
          requestBody.instances[0].image = {
            bytesBase64Encoded: match[2],
            mimeType: match[1],
          };
        }
      } else if (referenceImageUrl.startsWith("http")) {
        // Fetch and convert to base64
        const imgResponse = await fetch(referenceImageUrl);
        if (imgResponse.ok) {
          const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
          const contentType = imgResponse.headers.get("content-type") || "image/png";
          requestBody.instances[0].image = {
            bytesBase64Encoded: imgBuffer.toString("base64"),
            mimeType: contentType,
          };
        }
      }
    }

    // Step 1: Submit generation request
    const submitUrl = `${VEO_BASE_URL}:predictLongRunning?key=${GOOGLE_AI_API_KEY}`;
    const submitResponse = await fetch(submitUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!submitResponse.ok) {
      const errorBody = await submitResponse.text();
      console.error(`[Veo3] Submit failed ${submitResponse.status}: ${errorBody}`);

      // Fallback: try the generateVideos endpoint (newer API format)
      return await generateVideoClipViaGenerateAPI(request);
    }

    const operation = await submitResponse.json();
    const operationName = operation.name;

    if (!operationName) {
      // Response might be immediate (newer API)
      if (operation.videos || operation.generatedVideos) {
        return await processVeoResponse(operation, prompt, clampedDuration);
      }
      console.error("[Veo3] No operation name in response:", JSON.stringify(operation).substring(0, 500));
      return { success: false, error: "No operation name returned from Veo API" };
    }

    console.log(`[Veo3] Operation started: ${operationName}`);

    // Step 2: Poll for completion (max 5 minutes)
    const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${GOOGLE_AI_API_KEY}`;
    const maxPolls = 60; // 60 × 5s = 5 minutes
    const pollIntervalMs = 5000;

    for (let i = 0; i < maxPolls; i++) {
      await sleep(pollIntervalMs);

      const pollResponse = await fetch(pollUrl);
      if (!pollResponse.ok) {
        console.warn(`[Veo3] Poll attempt ${i + 1} failed: ${pollResponse.status}`);
        continue;
      }

      const pollResult = await pollResponse.json();

      if (pollResult.done) {
        if (pollResult.error) {
          console.error("[Veo3] Generation failed:", pollResult.error);
          return {
            success: false,
            error: `Veo generation failed: ${pollResult.error.message || JSON.stringify(pollResult.error)}`,
          };
        }

        console.log(`[Veo3] Generation complete after ${(i + 1) * 5}s`);
        return await processVeoResponse(pollResult.response || pollResult, prompt, clampedDuration);
      }

      if (i % 6 === 0) {
        console.log(`[Veo3] Still generating... (${(i + 1) * 5}s elapsed)`);
      }
    }

    return { success: false, error: "Veo generation timed out after 5 minutes" };
  } catch (error) {
    console.error("[Veo3] Generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown Veo error",
    };
  }
}

/**
 * Alternative API format: uses the generateVideos endpoint
 * (Google AI Studio / Gemini API style)
 */
async function generateVideoClipViaGenerateAPI(
  request: VeoGenerateRequest,
): Promise<VeoGenerateResult> {
  const {
    prompt,
    referenceImageUrl,
    durationSec = 4,
    aspectRatio = "16:9",
    numberOfVideos = 1,
  } = request;

  const clampedDuration = Math.min(8, Math.max(2, durationSec));

  console.log("[Veo3] Trying generateVideos endpoint...");

  const generateUrl = `${VEO_BASE_URL}:generateVideos?key=${GOOGLE_AI_API_KEY}`;

  const requestBody: any = {
    prompt,
    generationConfig: {
      numberOfVideos,
      durationSeconds: clampedDuration,
      aspectRatio,
      personGeneration: "allow_all",
    },
  };

  // Add reference image if provided
  if (referenceImageUrl && referenceImageUrl.startsWith("http")) {
    try {
      const imgResponse = await fetch(referenceImageUrl);
      if (imgResponse.ok) {
        const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
        const contentType = imgResponse.headers.get("content-type") || "image/png";
        requestBody.image = {
          imageBytes: imgBuffer.toString("base64"),
          mimeType: contentType,
        };
      }
    } catch (e) {
      console.warn("[Veo3] Failed to fetch reference image:", e);
    }
  }

  const response = await fetch(generateUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[Veo3] generateVideos failed ${response.status}: ${errorBody}`);
    return {
      success: false,
      error: `Veo3 API error: ${response.status} ${errorBody.substring(0, 200)}`,
    };
  }

  const result = await response.json();

  // If it returns an operation, poll it
  if (result.name && !result.done) {
    const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${result.name}?key=${GOOGLE_AI_API_KEY}`;
    const maxPolls = 60;

    for (let i = 0; i < maxPolls; i++) {
      await sleep(5000);
      const pollResponse = await fetch(pollUrl);
      if (!pollResponse.ok) continue;

      const pollResult = await pollResponse.json();
      if (pollResult.done) {
        if (pollResult.error) {
          return { success: false, error: pollResult.error.message };
        }
        return await processVeoResponse(pollResult.response || pollResult, prompt, clampedDuration);
      }
    }
    return { success: false, error: "Veo generation timed out" };
  }

  return await processVeoResponse(result, prompt, clampedDuration);
}

/**
 * Process the Veo API response — download video data and save to disk.
 */
async function processVeoResponse(
  response: any,
  prompt: string,
  durationSec: number,
): Promise<VeoGenerateResult> {
  // Ensure output directory exists
  if (!existsSync(CLIPS_DIR)) {
    mkdirSync(CLIPS_DIR, { recursive: true });
  }

  // Extract video data from response (API format may vary)
  const videos =
    response.videos ||
    response.generatedVideos ||
    response.predictions ||
    [];

  if (!videos || videos.length === 0) {
    console.error("[Veo3] No videos in response:", JSON.stringify(response).substring(0, 500));
    return { success: false, error: "No video clips returned from Veo API" };
  }

  const clips: VeoClip[] = [];

  for (const video of videos) {
    try {
      let videoBuffer: Buffer;

      if (video.video?.bytesBase64Encoded || video.bytesBase64Encoded) {
        // Video data is inline as base64
        const b64 = video.video?.bytesBase64Encoded || video.bytesBase64Encoded;
        videoBuffer = Buffer.from(b64, "base64");
      } else if (video.video?.uri || video.uri) {
        // Video data is at a URI — download it
        const uri = video.video?.uri || video.uri;
        const downloadResponse = await fetch(uri);
        if (!downloadResponse.ok) {
          console.warn(`[Veo3] Failed to download clip from ${uri}`);
          continue;
        }
        videoBuffer = Buffer.from(await downloadResponse.arrayBuffer());
      } else {
        console.warn("[Veo3] Unknown video format:", JSON.stringify(video).substring(0, 200));
        continue;
      }

      const fileName = `veo-clip-${randomUUID()}.mp4`;
      const filePath = join(CLIPS_DIR, fileName);
      writeFileSync(filePath, videoBuffer);

      clips.push({
        filePath,
        durationSec,
        prompt,
      });

      console.log(`[Veo3] Clip saved: ${filePath} (${videoBuffer.length} bytes)`);
    } catch (err) {
      console.error("[Veo3] Failed to process video clip:", err);
    }
  }

  if (clips.length === 0) {
    return { success: false, error: "Failed to download any video clips" };
  }

  return { success: true, clips };
}

/**
 * Generate multiple video clips in parallel (for all scenes).
 * Includes rate limiting to avoid API throttling.
 */
export async function generateVideoClips(
  requests: VeoGenerateRequest[],
  concurrency: number = 2,
): Promise<VeoGenerateResult[]> {
  console.log(
    `[Veo3] Generating ${requests.length} clips (concurrency: ${concurrency})...`,
  );

  const results: VeoGenerateResult[] = [];

  // Process in batches to respect rate limits
  for (let i = 0; i < requests.length; i += concurrency) {
    const batch = requests.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((req) => generateVideoClip(req)),
    );
    results.push(...batchResults);

    // Small delay between batches to avoid rate limiting
    if (i + concurrency < requests.length) {
      await sleep(2000);
    }
  }

  const successCount = results.filter((r) => r.success).length;
  console.log(
    `[Veo3] Generated ${successCount}/${requests.length} clips successfully`,
  );

  return results;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
