import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import OpenAI from "openai";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { logLlmCall, type TokenUsage } from "../llm/tokenLogger";

function geminiUsageFromResult(result: any): TokenUsage | undefined {
  const u = result?.response?.usageMetadata;
  if (!u) return undefined;
  return {
    inputTokens: u.promptTokenCount ?? 0,
    outputTokens: u.candidatesTokenCount ?? 0,
    totalTokens: u.totalTokenCount ?? 0,
  };
}

function openAiUsage(completion: any): TokenUsage | undefined {
  const u = completion?.usage;
  if (!u) return undefined;
  return {
    inputTokens: u.prompt_tokens ?? 0,
    outputTokens: u.completion_tokens ?? 0,
    totalTokens: u.total_tokens ?? 0,
  };
}

// Gemini model — configurable via env. Default to 2.5-pro for code-gen quality.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";

// Google AI client singleton
let geminiClient: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_AI_API_KEY environment variable is required");
    }
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return geminiClient;
}

interface ModelConfig {
  temperature?: number;
  maxTokens?: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatResponse {
  content: string;
}

// Pre-configured model configs for different use cases
export const SCRAPER_CONFIG: ModelConfig = { temperature: 0.3 };
export const SCRIPT_WRITER_CONFIG: ModelConfig = { temperature: 0.7 };
export const CODE_GENERATOR_CONFIG: ModelConfig = {
  temperature: 0.3,
  maxTokens: 8000,
};

// ============================================
// Ollama (local) — OpenAI-compatible endpoint
// ============================================
// Set LLM_PROVIDER=ollama to short-circuit Gemini Pro / Pro-Vision to local Ollama.
const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma4:e4b";

let ollamaClient: OpenAI | null = null;
function getOllamaClient(): OpenAI {
  if (!ollamaClient) {
    ollamaClient = new OpenAI({
      baseURL: OLLAMA_BASE_URL,
      apiKey: process.env.OLLAMA_API_KEY || "ollama",
    });
  }
  return ollamaClient;
}

function useOllama(): boolean {
  return process.env.LLM_PROVIDER === "ollama";
}

// ============================================
// Gemini Flash (Google AI SDK) — fast, cheap
// ============================================
const GEMINI_FLASH_MODEL = process.env.GEMINI_FLASH_MODEL || "gemini-2.0-flash";

export async function chatWithGeminiFlash(
  messages: ChatMessage[],
  config: ModelConfig = {},
): Promise<ChatResponse> {
  const { temperature = 0.7, maxTokens } = config;
  const client = getGeminiClient();

  console.log("[GeminiFlash] Calling Google AI Studio...");
  console.log("[GeminiFlash] Model:", GEMINI_FLASH_MODEL);

  const model = client.getGenerativeModel({
    model: GEMINI_FLASH_MODEL,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  });

  const systemMessage = messages.find((m) => m.role === "system");
  const otherMessages = messages.filter((m) => m.role !== "system");

  let fullPrompt = "";
  if (systemMessage) {
    fullPrompt = `${systemMessage.content}\n\n---\n\n`;
  }
  for (const msg of otherMessages) {
    if (msg.role === "user") {
      fullPrompt += msg.content;
    } else if (msg.role === "assistant") {
      fullPrompt += `\n\nAssistant: ${msg.content}\n\nUser: `;
    }
  }

  const started = Date.now();
  try {
    const result = await model.generateContent(fullPrompt);
    const text = result.response.text();
    console.log("[GeminiFlash] Response length:", text?.length || 0);
    logLlmCall({
      provider: "gemini-flash",
      model: GEMINI_FLASH_MODEL,
      usage: geminiUsageFromResult(result),
      latencyMs: Date.now() - started,
      ok: true,
    });
    return { content: text || "" };
  } catch (error) {
    logLlmCall({
      provider: "gemini-flash",
      model: GEMINI_FLASH_MODEL,
      latencyMs: Date.now() - started,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error("[GeminiFlash] API Error, falling back to CF Kimi:", error);
    try {
      return await chatWithCloudflareAI(messages, config);
    } catch {
      return chatWithKimi(messages, config);
    }
  }
}

// ============================================
// Gemini Pro (Google AI SDK) — smart, for code gen
// ============================================

export async function chatWithGeminiPro(
  messages: ChatMessage[],
  config: ModelConfig = {},
): Promise<ChatResponse> {
  if (useOllama()) return chatWithOllama(messages, config);
  const { temperature = 0.7, maxTokens } = config;
  const client = getGeminiClient();

  console.log("[GeminiPro] Calling Google AI Studio...");
  console.log("[GeminiPro] Model:", GEMINI_MODEL);

  const model = client.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  });

  const systemMessage = messages.find((m) => m.role === "system");
  const otherMessages = messages.filter((m) => m.role !== "system");

  let fullPrompt = "";
  if (systemMessage) {
    fullPrompt = `${systemMessage.content}\n\n---\n\n`;
  }
  for (const msg of otherMessages) {
    if (msg.role === "user") {
      fullPrompt += msg.content;
    } else if (msg.role === "assistant") {
      fullPrompt += `\n\nAssistant: ${msg.content}\n\nUser: `;
    }
  }

  const started = Date.now();
  try {
    const result = await model.generateContent(fullPrompt);
    const text = result.response.text();
    console.log("[GeminiPro] Response length:", text?.length || 0);
    logLlmCall({
      provider: "gemini-pro",
      model: GEMINI_MODEL,
      usage: geminiUsageFromResult(result),
      latencyMs: Date.now() - started,
      ok: true,
    });
    return { content: text || "" };
  } catch (error) {
    logLlmCall({
      provider: "gemini-pro",
      model: GEMINI_MODEL,
      latencyMs: Date.now() - started,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error("[GeminiPro] API Error, falling back to CF Kimi:", error);
    try {
      return await chatWithCloudflareAI(messages, config);
    } catch {
      return chatWithKimi(messages, config);
    }
  }
}

// ============================================
// OpenRouter Integration (fallback provider)
// ============================================

const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-exp";

// OpenRouter client singleton
let openRouterClient: OpenAI | null = null;

function getOpenRouterClient(): OpenAI {
  if (!openRouterClient) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY environment variable is required");
    }
    openRouterClient = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.SITE_URL || "http://localhost:3000",
        "X-Title": "Remawt Video Generator",
      },
    });
  }
  return openRouterClient;
}

// Text chat via OpenRouter
export async function chatWithKimi(
  messages: ChatMessage[],
  config: ModelConfig = {},
): Promise<ChatResponse> {
  const { temperature = 0.7, maxTokens } = config;
  const client = getOpenRouterClient();

  console.log("[OpenRouter] Calling API...");
  console.log("[OpenRouter] Model:", OPENROUTER_MODEL);
  console.log("[OpenRouter] Temperature:", temperature);

  const started = Date.now();
  try {
    const completion = await client.chat.completions.create({
      model: OPENROUTER_MODEL,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature,
      max_tokens: maxTokens,
    });

    const content = completion.choices[0]?.message?.content || "";
    console.log("[OpenRouter] Response received successfully");
    console.log("[OpenRouter] Response length:", content.length);

    logLlmCall({
      provider: "openrouter",
      model: OPENROUTER_MODEL,
      usage: openAiUsage(completion),
      latencyMs: Date.now() - started,
      ok: true,
    });
    return { content };
  } catch (error) {
    logLlmCall({
      provider: "openrouter",
      model: OPENROUTER_MODEL,
      latencyMs: Date.now() - started,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error("[OpenRouter] API Error:", error);
    throw error;
  }
}

// ============================================
// Cloudflare Workers AI (Kimi K2.6) — OpenAI-compatible endpoint
// ============================================

const CLOUDFLARE_AI_MODEL =
  process.env.CLOUDFLARE_AI_MODEL || "@cf/moonshotai/kimi-k2.6";

let cloudflareClient: OpenAI | null = null;

function getCloudflareClient(): OpenAI {
  if (!cloudflareClient) {
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    if (!apiToken) {
      throw new Error("CLOUDFLARE_API_TOKEN environment variable is required");
    }
    if (!accountId) {
      throw new Error("CLOUDFLARE_ACCOUNT_ID environment variable is required");
    }
    cloudflareClient = new OpenAI({
      apiKey: apiToken,
      baseURL: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`,
    });
  }
  return cloudflareClient;
}

// Reasoning effort: "low" cuts thinking tokens ~3x for Kimi K2.6 reasoning models.
// Override via CLOUDFLARE_REASONING_EFFORT=medium|high if higher quality needed.
const CLOUDFLARE_REASONING_EFFORT = (process.env.CLOUDFLARE_REASONING_EFFORT ||
  "low") as "low" | "medium" | "high";

export async function chatWithCloudflareAI(
  messages: ChatMessage[],
  config: ModelConfig = {},
): Promise<ChatResponse> {
  const { temperature = 0.7, maxTokens } = config;
  const client = getCloudflareClient();

  console.log("[CloudflareAI] Calling Workers AI...");
  console.log("[CloudflareAI] Model:", CLOUDFLARE_AI_MODEL);
  console.log(
    `[CloudflareAI] Temperature: ${temperature} | reasoning_effort: ${CLOUDFLARE_REASONING_EFFORT}`,
  );

  // Retry with exponential backoff on 429 / transient errors.
  const MAX_RETRIES = 4;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const started = Date.now();
    try {
      const completion = await client.chat.completions.create({
        model: CLOUDFLARE_AI_MODEL,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature,
        max_tokens: maxTokens,
        // @ts-expect-error — supported by CF Workers AI for reasoning models
        reasoning_effort: CLOUDFLARE_REASONING_EFFORT,
      });

      const msg = completion.choices[0]?.message as
        | { content?: string | null; reasoning_content?: string | null }
        | undefined;
      let content = msg?.content || "";
      if (!content && msg?.reasoning_content) {
        const reasoning = msg.reasoning_content;
        const fenceMatch = reasoning.match(/```[\s\S]*?```/g);
        content = fenceMatch ? fenceMatch[fenceMatch.length - 1] : reasoning;
        console.warn(
          "[CloudflareAI] content was empty — extracted from reasoning_content",
        );
      }
      console.log("[CloudflareAI] Response length:", content.length);

      logLlmCall({
        provider: "cloudflare",
        model: CLOUDFLARE_AI_MODEL,
        usage: openAiUsage(completion),
        latencyMs: Date.now() - started,
        ok: true,
      });
      return { content };
    } catch (error) {
      lastErr = error;
      const status = (error as any)?.status;
      const isRetryable =
        status === 429 || status === 502 || status === 503 || status === 504;
      if (!isRetryable || attempt === MAX_RETRIES - 1) {
        logLlmCall({
          provider: "cloudflare",
          model: CLOUDFLARE_AI_MODEL,
          latencyMs: Date.now() - started,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
        console.error("[CloudflareAI] API Error (no more retries):", error);
        throw error;
      }
      const backoff = Math.min(8000, 500 * Math.pow(2, attempt));
      console.warn(
        `[CloudflareAI] ${status} — retry ${attempt + 1}/${MAX_RETRIES} after ${backoff}ms`,
      );
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

// Media type for vision/video
type MediaType = "image" | "video";

interface MediaInput {
  type: MediaType;
  path?: string; // File path
  base64?: string; // Already encoded base64
  mimeType?: string; // e.g., "image/png", "video/mp4"
}

// Helper to encode file to base64 data URL
function encodeMediaToDataUrl(filePath: string, type: MediaType): string {
  const data = fs.readFileSync(filePath);
  const ext = path.extname(filePath).slice(1); // Remove the dot
  const mimePrefix = type === "image" ? "image" : "video";
  return `data:${mimePrefix}/${ext};base64,${data.toString("base64")}`;
}

// Threshold for inline vs File API (15MB)
const INLINE_SIZE_LIMIT = 15 * 1024 * 1024;

// File API manager singleton
let fileManager: GoogleAIFileManager | null = null;
function getFileManager(): GoogleAIFileManager {
  if (!fileManager) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey)
      throw new Error("GOOGLE_AI_API_KEY environment variable is required");
    fileManager = new GoogleAIFileManager(apiKey);
  }
  return fileManager;
}

/**
 * Prepare media for Gemini API — uses inline data for small files,
 * File API for large files (>15MB) to avoid 413 errors.
 * Returns the content part and an optional cleanup function.
 */
async function prepareMediaForGemini(media: MediaInput): Promise<{
  part:
    | { inlineData: { data: string; mimeType: string } }
    | { fileData: { fileUri: string; mimeType: string } };
  cleanup: (() => Promise<void>) | null;
}> {
  const getMimeType = (ext: string, type: MediaType) =>
    `${type === "image" ? "image" : "video"}/${ext}`;

  // Case 1: Already have base64 data
  if (media.base64 && media.mimeType) {
    const sizeBytes = Math.ceil((media.base64.length * 3) / 4);
    if (sizeBytes < INLINE_SIZE_LIMIT) {
      return {
        part: { inlineData: { data: media.base64, mimeType: media.mimeType } },
        cleanup: null,
      };
    }
    // Too large for inline — write to temp file and use File API
    const tmpPath = path.join(os.tmpdir(), `gemini-upload-${Date.now()}`);
    fs.writeFileSync(tmpPath, Buffer.from(media.base64, "base64"));
    return uploadViaFileAPI(tmpPath, media.mimeType, true);
  }

  if (!media.path) {
    throw new Error("Media input must have either path or base64+mimeType");
  }

  // Case 2: URL — download first
  if (media.path.startsWith("http")) {
    const response = await fetch(media.path);
    const buffer = Buffer.from(await response.arrayBuffer());
    const ext =
      path.extname(new URL(media.path).pathname).slice(1) ||
      (media.type === "image" ? "png" : "mp4");
    const mimeType = getMimeType(ext, media.type);

    if (buffer.length < INLINE_SIZE_LIMIT) {
      return {
        part: { inlineData: { data: buffer.toString("base64"), mimeType } },
        cleanup: null,
      };
    }

    // Large file — save to temp and use File API
    const tmpPath = path.join(
      os.tmpdir(),
      `gemini-upload-${Date.now()}.${ext}`,
    );
    fs.writeFileSync(tmpPath, buffer);
    return uploadViaFileAPI(tmpPath, mimeType, true);
  }

  // Case 3: Local file path
  const stats = fs.statSync(media.path);
  const ext = path.extname(media.path).slice(1);
  const mimeType = getMimeType(ext, media.type);

  if (stats.size < INLINE_SIZE_LIMIT) {
    const data = fs.readFileSync(media.path);
    return {
      part: { inlineData: { data: data.toString("base64"), mimeType } },
      cleanup: null,
    };
  }

  return uploadViaFileAPI(media.path, mimeType, false);
}

/**
 * Upload a file via Gemini File API, wait for it to become ACTIVE.
 */
async function uploadViaFileAPI(
  filePath: string,
  mimeType: string,
  deleteTmpAfter: boolean,
): Promise<{
  part: { fileData: { fileUri: string; mimeType: string } };
  cleanup: () => Promise<void>;
}> {
  const fm = getFileManager();
  console.log(`[GeminiFileAPI] Uploading ${filePath} (${mimeType})...`);

  const uploadResult = await fm.uploadFile(filePath, {
    mimeType,
    displayName: path.basename(filePath),
  });

  // Wait for processing
  let file = uploadResult.file;
  while (file.state === FileState.PROCESSING) {
    console.log("[GeminiFileAPI] Waiting for file processing...");
    await new Promise((r) => setTimeout(r, 2000));
    file = await fm.getFile(file.name);
  }

  if (file.state === FileState.FAILED) {
    throw new Error(`[GeminiFileAPI] File processing failed: ${file.name}`);
  }

  console.log(`[GeminiFileAPI] File ready: ${file.uri}`);

  if (deleteTmpAfter) {
    try {
      fs.unlinkSync(filePath);
    } catch {}
  }

  const fileName = file.name;
  return {
    part: { fileData: { fileUri: file.uri, mimeType } },
    cleanup: async () => {
      try {
        await fm.deleteFile(fileName);
        console.log(`[GeminiFileAPI] Cleaned up file: ${fileName}`);
      } catch {}
    },
  };
}

// Vision via Gemini Flash (Google AI SDK) — primary vision model
export async function chatWithGeminiFlashVision(
  media: MediaInput,
  textPrompt: string,
  systemPrompt?: string,
  config: ModelConfig = {},
): Promise<ChatResponse> {
  const { temperature = 0.7, maxTokens } = config;
  const client = getGeminiClient();

  console.log("[GeminiFlashVision] Calling Google AI Studio with media...");
  console.log("[GeminiFlashVision] Media type:", media.type);
  console.log("[GeminiFlashVision] Model:", GEMINI_FLASH_MODEL);

  const model = client.getGenerativeModel({
    model: GEMINI_FLASH_MODEL,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  });

  const fullPrompt = systemPrompt
    ? `${systemPrompt}\n\n---\n\n${textPrompt}`
    : textPrompt;

  const { part: mediaPart, cleanup } = await prepareMediaForGemini(media);
  const started = Date.now();

  try {
    const result = await model.generateContent([fullPrompt, mediaPart]);
    const text = result.response.text();
    console.log("[GeminiFlashVision] Response length:", text?.length || 0);
    logLlmCall({
      provider: "gemini-flash-vision",
      model: GEMINI_FLASH_MODEL,
      usage: geminiUsageFromResult(result),
      latencyMs: Date.now() - started,
      ok: true,
    });
    return { content: text || "" };
  } catch (error) {
    logLlmCall({
      provider: "gemini-flash-vision",
      model: GEMINI_FLASH_MODEL,
      latencyMs: Date.now() - started,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(
      "[GeminiFlashVision] API Error, falling back to Kimi vision:",
      error,
    );
    return chatWithKimiVisionDirect(media, textPrompt, systemPrompt, config);
  } finally {
    if (cleanup) await cleanup();
  }
}

// Vision via Gemini Pro (Google AI SDK) — for complex video analysis
export async function chatWithGeminiProVision(
  media: MediaInput,
  textPrompt: string,
  systemPrompt?: string,
  config: ModelConfig = {},
): Promise<ChatResponse> {
  if (useOllama())
    return chatWithOllamaVision(media, textPrompt, systemPrompt, config);
  const { temperature = 0.7, maxTokens } = config;
  const client = getGeminiClient();

  console.log("[GeminiProVision] Calling Google AI Studio with media...");
  console.log("[GeminiProVision] Media type:", media.type);
  console.log("[GeminiProVision] Model:", GEMINI_MODEL);

  const model = client.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  });

  const fullPrompt = systemPrompt
    ? `${systemPrompt}\n\n---\n\n${textPrompt}`
    : textPrompt;

  const { part: mediaPart, cleanup } = await prepareMediaForGemini(media);
  const started = Date.now();

  try {
    const result = await model.generateContent([fullPrompt, mediaPart]);
    const text = result.response.text();
    console.log("[GeminiProVision] Response length:", text?.length || 0);
    logLlmCall({
      provider: "gemini-pro-vision",
      model: GEMINI_MODEL,
      usage: geminiUsageFromResult(result),
      latencyMs: Date.now() - started,
      ok: true,
    });
    return { content: text || "" };
  } catch (error) {
    logLlmCall({
      provider: "gemini-pro-vision",
      model: GEMINI_MODEL,
      latencyMs: Date.now() - started,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error("[GeminiProVision] API Error:", error);
    return chatWithGeminiFlashVision(media, textPrompt, systemPrompt, config);
  } finally {
    if (cleanup) await cleanup();
  }
}

// Kimi vision fallback (OpenRouter)
async function chatWithKimiVisionDirect(
  media: MediaInput,
  textPrompt: string,
  systemPrompt?: string,
  config: ModelConfig = {},
): Promise<ChatResponse> {
  const { temperature = 0.7, maxTokens } = config;
  const client = getOpenRouterClient();

  console.log("[OpenRouter Vision] Fallback — Calling API with media...");
  console.log("[OpenRouter Vision] Media type:", media.type);
  console.log("[OpenRouter Vision] Model:", OPENROUTER_MODEL);

  // Get the data URL
  let dataUrl: string;
  if (media.base64 && media.mimeType) {
    dataUrl = `data:${media.mimeType};base64,${media.base64}`;
  } else if (media.path) {
    if (media.path.startsWith("http")) {
      // For URLs, fetch and convert to base64
      const resp = await fetch(media.path);
      const buffer = Buffer.from(await resp.arrayBuffer());
      const ext = path.extname(new URL(media.path).pathname).slice(1) || "png";
      const mimePrefix = media.type === "image" ? "image" : "video";
      dataUrl = `data:${mimePrefix}/${ext};base64,${buffer.toString("base64")}`;
    } else {
      dataUrl = encodeMediaToDataUrl(media.path, media.type);
    }
  } else {
    throw new Error("Media input must have either path or base64+mimeType");
  }

  // Build the content parts based on media type
  const contentType = media.type === "image" ? "image_url" : "video_url";
  const urlKey = media.type === "image" ? "image_url" : "video_url";

  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
    | { type: "video_url"; video_url: { url: string } }
  > = [
    {
      type: contentType,
      [urlKey]: { url: dataUrl },
    } as
      | { type: "image_url"; image_url: { url: string } }
      | { type: "video_url"; video_url: { url: string } },
    {
      type: "text",
      text: textPrompt,
    },
  ];

  const messages: Array<{
    role: "system" | "user" | "assistant";
    content: string | typeof userContent;
  }> = [];

  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  messages.push({ role: "user", content: userContent });

  const started = Date.now();
  try {
    const completion = await client.chat.completions.create({
      model: OPENROUTER_MODEL,
      messages:
        messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      temperature,
      max_tokens: maxTokens,
    });

    const content = completion.choices[0]?.message?.content || "";
    console.log("[OpenRouter Vision] Response received successfully");
    console.log("[OpenRouter Vision] Response length:", content.length);

    logLlmCall({
      provider: "openrouter-vision",
      model: OPENROUTER_MODEL,
      usage: openAiUsage(completion),
      latencyMs: Date.now() - started,
      ok: true,
    });
    return { content };
  } catch (error) {
    logLlmCall({
      provider: "openrouter-vision",
      model: OPENROUTER_MODEL,
      latencyMs: Date.now() - started,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error("[OpenRouter Vision] API Error:", error);
    throw error;
  }
}

// ============================================
// Ollama text + vision impls
// ============================================

// Gemma 4 turn-marker template (per ai.google.dev/gemma/docs/core/prompt-formatting-gemma4).
// `<|think|>` in system enables internal reasoning emitted in <|channel>thought ... <channel|>.
function buildGemma4Prompt(messages: ChatMessage[], think: boolean): string {
  const parts: string[] = [];
  const sysMsgs = messages.filter((m) => m.role === "system");
  const otherMsgs = messages.filter((m) => m.role !== "system");
  const sysText = sysMsgs.map((m) => m.content).join("\n\n");
  if (sysText || think) {
    parts.push(
      `<|turn>system\n${think ? "<|think|>\n" : ""}${sysText}<turn|>`,
    );
  }
  for (const m of otherMsgs) {
    const role = m.role === "assistant" ? "model" : "user";
    parts.push(`<|turn>${role}\n${m.content}<turn|>`);
  }
  parts.push("<|turn>model\n");
  return parts.join("\n");
}

function stripGemma4Thought(text: string): string {
  // Remove <|channel>thought ... <channel|> blocks the model emits when thinking.
  return text.replace(/<\|channel>thought[\s\S]*?<channel\|>/g, "").trim();
}

async function chatWithOllamaGemma4(
  messages: ChatMessage[],
  config: ModelConfig,
): Promise<ChatResponse> {
  const { temperature = 0.7, maxTokens } = config;
  const think = process.env.OLLAMA_THINK !== "0";
  const wantsJson =
    process.env.OLLAMA_JSON_MODE !== "0" &&
    messages.some((m) => /\bJSON\b/i.test(m.content));
  const numCtx = Number(process.env.OLLAMA_NUM_CTX || 16384);

  const prompt = buildGemma4Prompt(messages, think);
  const body = {
    model: OLLAMA_MODEL,
    prompt,
    raw: true,
    stream: true,
    ...(wantsJson ? { format: "json" as const } : {}),
    options: {
      temperature,
      num_ctx: numCtx,
      ...(maxTokens ? { num_predict: maxTokens } : {}),
      stop: ["<turn|>"],
    },
  };
  const baseRoot = OLLAMA_BASE_URL.replace(/\/v1\/?$/, "");
  const resp = await fetch(`${baseRoot}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok || !resp.body) {
    throw new Error(
      `Ollama /api/generate ${resp.status}: ${await resp.text().catch(() => "")}`,
    );
  }
  // Stream NDJSON — accumulate `response` chunks; capture final usage on last line.
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  let buf = "";
  let promptEval = 0;
  let evalCount = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        if (typeof obj.response === "string") raw += obj.response;
        if (obj.done) {
          promptEval = obj.prompt_eval_count ?? promptEval;
          evalCount = obj.eval_count ?? evalCount;
        }
      } catch {
        // skip malformed line
      }
    }
  }
  const content = stripGemma4Thought(raw);
  return {
    content,
    // attach raw for logging
    // @ts-expect-error — extra debug field
    _raw: raw,
    // @ts-expect-error
    _usage: {
      inputTokens: promptEval,
      outputTokens: evalCount,
      totalTokens: promptEval + evalCount,
    },
  };
}

export async function chatWithOllama(
  messages: ChatMessage[],
  config: ModelConfig = {},
): Promise<ChatResponse> {
  const { temperature = 0.7, maxTokens } = config;

  console.log("[Ollama] Calling local Ollama...");
  console.log("[Ollama] Base:", OLLAMA_BASE_URL, "| Model:", OLLAMA_MODEL);

  // Gemma 4 uses a specific turn-marker template; auto-detect by model name.
  const isGemma4 =
    /^gemma4(:|$)/i.test(OLLAMA_MODEL) ||
    process.env.OLLAMA_GEMMA4_FORMAT === "1";

  const started = Date.now();
  try {
    if (isGemma4) {
      const out = (await chatWithOllamaGemma4(messages, {
        temperature,
        maxTokens,
      })) as ChatResponse & { _usage?: TokenUsage };
      console.log(
        "[Ollama] (gemma4 turn-marker) Response length:",
        out.content.length,
      );
      logLlmCall({
        provider: "ollama",
        model: OLLAMA_MODEL,
        usage: out._usage,
        latencyMs: Date.now() - started,
        ok: true,
      });
      return { content: out.content };
    }

    // Non-Gemma-4 fallback: OpenAI-compat /v1/chat/completions
    const client = getOllamaClient();
    const wantsJson =
      process.env.OLLAMA_JSON_MODE !== "0" &&
      messages.some((m) => /\bJSON\b/i.test(m.content));
    const numCtx = Number(process.env.OLLAMA_NUM_CTX || 16384);
    const completion = await client.chat.completions.create({
      model: OLLAMA_MODEL,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature,
      max_tokens: maxTokens,
      ...(wantsJson ? { response_format: { type: "json_object" } } : {}),
      // @ts-expect-error — Ollama accepts arbitrary extra fields
      options: { num_ctx: numCtx },
    });
    const content = completion.choices[0]?.message?.content || "";
    console.log("[Ollama] Response length:", content.length);
    logLlmCall({
      provider: "ollama",
      model: OLLAMA_MODEL,
      usage: openAiUsage(completion),
      latencyMs: Date.now() - started,
      ok: true,
    });
    return { content };
  } catch (error) {
    logLlmCall({
      provider: "ollama",
      model: OLLAMA_MODEL,
      latencyMs: Date.now() - started,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error("[Ollama] API Error:", error);
    throw error;
  }
}

export async function chatWithOllamaVision(
  media: MediaInput,
  textPrompt: string,
  systemPrompt?: string,
  config: ModelConfig = {},
): Promise<ChatResponse> {
  const { temperature = 0.7, maxTokens } = config;
  const client = getOllamaClient();

  console.log("[OllamaVision] Calling local Ollama with media...");
  console.log(
    "[OllamaVision] Media type:",
    media.type,
    "| Model:",
    OLLAMA_MODEL,
  );

  let dataUrl: string;
  if (media.base64 && media.mimeType) {
    dataUrl = `data:${media.mimeType};base64,${media.base64}`;
  } else if (media.path) {
    if (media.path.startsWith("http")) {
      const resp = await fetch(media.path);
      const buffer = Buffer.from(await resp.arrayBuffer());
      const ext = path.extname(new URL(media.path).pathname).slice(1) || "png";
      const mimePrefix = media.type === "image" ? "image" : "video";
      dataUrl = `data:${mimePrefix}/${ext};base64,${buffer.toString("base64")}`;
    } else {
      dataUrl = encodeMediaToDataUrl(media.path, media.type);
    }
  } else {
    throw new Error("Media input must have either path or base64+mimeType");
  }

  const messages: Array<{
    role: "system" | "user" | "assistant";
    content:
      | string
      | Array<
          | { type: "text"; text: string }
          | { type: "image_url"; image_url: { url: string } }
        >;
  }> = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({
    role: "user",
    content: [
      { type: "image_url", image_url: { url: dataUrl } },
      { type: "text", text: textPrompt },
    ],
  });

  const started = Date.now();
  try {
    const completion = await client.chat.completions.create({
      model: OLLAMA_MODEL,
      messages:
        messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      temperature,
      max_tokens: maxTokens,
    });
    const content = completion.choices[0]?.message?.content || "";
    console.log("[OllamaVision] Response length:", content.length);
    logLlmCall({
      provider: "ollama-vision",
      model: OLLAMA_MODEL,
      usage: openAiUsage(completion),
      latencyMs: Date.now() - started,
      ok: true,
    });
    return { content };
  } catch (error) {
    logLlmCall({
      provider: "ollama-vision",
      model: OLLAMA_MODEL,
      latencyMs: Date.now() - started,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error("[OllamaVision] API Error:", error);
    throw error;
  }
}
