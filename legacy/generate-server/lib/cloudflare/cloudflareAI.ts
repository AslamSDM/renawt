/**
 * Cloudflare Workers AI — TTS + Image generation
 *
 * Uses raw `/ai/run/{model}` endpoint (binary or JSON response).
 * Chat completions live in agents/model.ts (OpenAI-compat /ai/v1).
 */

// Read env lazily so dotenv loads in scripts apply before first use.
const cfAccountId = () => process.env.CLOUDFLARE_ACCOUNT_ID;
const cfApiToken = () => process.env.CLOUDFLARE_API_TOKEN;
const cfTtsModel = () =>
  process.env.CLOUDFLARE_TTS_MODEL || "@cf/deepgram/aura-2-en";
const cfImageModel = () =>
  process.env.CLOUDFLARE_IMAGE_MODEL || "@cf/black-forest-labs/flux-1-schnell";

export function isCloudflareAIConfigured(): boolean {
  return !!(cfAccountId() && cfApiToken());
}

function runUrl(model: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${cfAccountId()}/ai/run/${model}`;
}

// ============================================
// TTS — Deepgram Aura via CF Workers AI
// ============================================

export interface CFTTSResult {
  success: boolean;
  buffer?: Buffer;
  estimatedDurationSec?: number;
  error?: string;
}

export async function generateTTSCloudflare(
  text: string,
  opts: { speaker?: string; encoding?: "mp3" | "linear16" } = {},
): Promise<CFTTSResult> {
  if (!isCloudflareAIConfigured()) {
    return { success: false, error: "Cloudflare AI not configured" };
  }
  if (!text?.trim()) {
    return { success: false, error: "TTS text is empty" };
  }

  const body: Record<string, unknown> = { text };
  if (opts.speaker) body.speaker = opts.speaker;
  if (opts.encoding) body.encoding = opts.encoding;

  console.log(
    `[CFTTS] ${cfTtsModel()} (${text.split(/\s+/).length} words)`,
  );

  try {
    const res = await fetch(runUrl(cfTtsModel()), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfApiToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[CFTTS] API error ${res.status}: ${err}`);
      return { success: false, error: `CF TTS ${res.status}: ${err}` };
    }

    const ct = res.headers.get("content-type") || "";
    let buffer: Buffer;
    if (ct.startsWith("audio/")) {
      buffer = Buffer.from(await res.arrayBuffer());
    } else {
      const j = await res.json();
      const b64 = j?.result?.audio || j?.audio;
      if (!b64) {
        return { success: false, error: "CF TTS returned no audio data" };
      }
      buffer = Buffer.from(b64, "base64");
    }

    const wordCount = text.trim().split(/\s+/).length;
    const estimatedDurationSec = Math.max(1, wordCount / 2.5);

    console.log(`[CFTTS] Generated ${buffer.length} bytes`);
    return { success: true, buffer, estimatedDurationSec };
  } catch (error) {
    console.error("[CFTTS] Fetch error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown CF TTS error",
    };
  }
}

// ============================================
// Image — Flux schnell via CF Workers AI
// ============================================

export interface CFImageResult {
  success: boolean;
  /** JPEG/PNG buffer */
  buffer?: Buffer;
  /** Base64 (no data: prefix) */
  base64?: string;
  mimeType?: string;
  error?: string;
}

export async function generateImageCloudflare(
  prompt: string,
  opts: { steps?: number; width?: number; height?: number } = {},
): Promise<CFImageResult> {
  if (!isCloudflareAIConfigured()) {
    return { success: false, error: "Cloudflare AI not configured" };
  }
  if (!prompt?.trim()) {
    return { success: false, error: "Image prompt is empty" };
  }

  const { steps = 4, width, height } = opts;
  const body: Record<string, unknown> = { prompt, steps };
  if (width) body.width = width;
  if (height) body.height = height;

  console.log(`[CFImage] ${cfImageModel()} steps=${steps}`);

  try {
    const res = await fetch(runUrl(cfImageModel()), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfApiToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[CFImage] API error ${res.status}: ${err}`);
      return { success: false, error: `CF Image ${res.status}: ${err}` };
    }

    const ct = res.headers.get("content-type") || "";
    if (ct.startsWith("image/")) {
      const buffer = Buffer.from(await res.arrayBuffer());
      return {
        success: true,
        buffer,
        base64: buffer.toString("base64"),
        mimeType: ct,
      };
    }

    const j = await res.json();
    const b64 = j?.result?.image || j?.image;
    if (!b64) {
      return { success: false, error: "CF Image returned no image data" };
    }
    const buffer = Buffer.from(b64, "base64");
    return {
      success: true,
      buffer,
      base64: b64,
      mimeType: "image/jpeg",
    };
  } catch (error) {
    console.error("[CFImage] Fetch error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown CF Image error",
    };
  }
}
