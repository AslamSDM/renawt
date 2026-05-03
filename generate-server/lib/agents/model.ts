import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import OpenAI from "openai";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// Configuration for model provider
// Set USE_GEMINI=true in .env to use Google AI Studio during development
const USE_GEMINI = process.env.USE_GEMINI === "true";

// Gemini model - using Gemini 2.0 Flash from Google AI Studio
// Available models: gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

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

// Direct Google AI Studio API call
export async function chatWithGemini(
  messages: ChatMessage[],
  config: ModelConfig = {},
): Promise<ChatResponse> {
  const { temperature = 0.7, maxTokens } = config;
  const client = getGeminiClient();

  console.log("[Gemini] Calling Google AI Studio API...");
  console.log("[Gemini] Model:", GEMINI_MODEL);
  console.log("[Gemini] Temperature:", temperature);
  console.log("[Gemini] MaxTokens:", maxTokens);

  const model = client.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  });

  // Convert messages to Gemini format
  // Gemini doesn't have a system role - prepend system message to first user message
  const systemMessage = messages.find((m) => m.role === "system");
  const otherMessages = messages.filter((m) => m.role !== "system");

  // Build the prompt with system context
  let fullPrompt = "";
  if (systemMessage) {
    fullPrompt = `${systemMessage.content}\n\n---\n\n`;
  }

  // Add remaining messages
  for (const msg of otherMessages) {
    if (msg.role === "user") {
      fullPrompt += msg.content;
    } else if (msg.role === "assistant") {
      fullPrompt += `\n\nAssistant: ${msg.content}\n\nUser: `;
    }
  }

  console.log("[Gemini] Full prompt length:", fullPrompt.length);
  console.log(
    "[Gemini] Prompt preview (first 500 chars):",
    fullPrompt.substring(0, 500),
  );

  try {
    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();

    console.log("[Gemini] Response received successfully");
    console.log("[Gemini] Response length:", text?.length || 0);
    console.log(
      "[Gemini] Response preview (first 300 chars):",
      text?.substring(0, 300),
    );

    return {
      content: text || "",
    };
  } catch (error) {
    console.error("[Gemini] API Error:", error);
    throw error;
  }
}

// Multi-turn conversation with Gemini
export async function chatWithGeminiMultiTurn(
  systemPrompt: string,
  userMessage: string,
  config: ModelConfig = {},
): Promise<string> {
  const response = await chatWithGemini(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    config,
  );

  return response.content;
}

// Helper to determine which provider to use
export function isUsingGemini(): boolean {
  return USE_GEMINI;
}

// Legacy alias for backward compatibility
export const isUsingOpenRouter = isUsingGemini;
export const chatWithOpenRouter = chatWithGemini;
export const chatWithOpenRouterMultiTurn = chatWithGeminiMultiTurn;

// Pre-configured model configs for different use cases
export const SCRAPER_CONFIG: ModelConfig = { temperature: 0.3 };
export const SCRIPT_WRITER_CONFIG: ModelConfig = { temperature: 0.7 };
export const CODE_GENERATOR_CONFIG: ModelConfig = {
  temperature: 0.3,
  maxTokens: 8000,
};
export const FAST_FIX_CONFIG: ModelConfig = {
  temperature: 0.2,
  maxTokens: 16000,
};

// ============================================
// Gemini Flash (Google AI SDK) — fast, cheap
// ============================================
const GEMINI_FLASH_MODEL =
  process.env.GEMINI_FLASH_MODEL || "gemini-2.0-flash";

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

  try {
    const result = await model.generateContent(fullPrompt);
    const text = result.response.text();
    console.log("[GeminiFlash] Response length:", text?.length || 0);
    return { content: text || "" };
  } catch (error) {
    console.error("[GeminiFlash] API Error, falling back to Kimi:", error);
    return chatWithKimi(messages, config);
  }
}

// ============================================
// Gemini Pro (Google AI SDK) — smart, for code gen
// ============================================
const GEMINI_PRO_MODEL =
  process.env.GEMINI_PRO_MODEL || "gemini-2.5-pro-preview-05-06";

export async function chatWithGeminiPro(
  messages: ChatMessage[],
  config: ModelConfig = {},
): Promise<ChatResponse> {
  const { temperature = 0.7, maxTokens } = config;
  const client = getGeminiClient();

  console.log("[GeminiPro] Calling Google AI Studio...");
  console.log("[GeminiPro] Model:", GEMINI_PRO_MODEL);

  const model = client.getGenerativeModel({
    model: GEMINI_PRO_MODEL,
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

  try {
    const result = await model.generateContent(fullPrompt);
    const text = result.response.text();
    console.log("[GeminiPro] Response length:", text?.length || 0);
    return { content: text || "" };
  } catch (error) {
    console.error("[GeminiPro] API Error, falling back to Kimi:", error);
    return chatWithKimi(messages, config);
  }
}

// ============================================
// Fast Model (Gemini 2.0 Flash via OpenRouter)
// ============================================

const FAST_MODEL = process.env.FAST_MODEL || "google/gemini-2.0-flash-001";

/**
 * Fast model for quick fixes (syntax errors, render error fixing).
 * Uses Gemini 2.0 Flash via OpenRouter for ~3-5x faster responses than Kimi K2.5.
 */
export async function chatWithFastModel(
  messages: ChatMessage[],
  config: ModelConfig = {},
): Promise<ChatResponse> {
  const { temperature = 0.2, maxTokens } = config;
  const client = getOpenRouterClient();

  console.log("[FastModel] Calling API...");
  console.log("[FastModel] Model:", FAST_MODEL);

  try {
    const completion = await client.chat.completions.create({
      model: FAST_MODEL,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature,
      max_tokens: maxTokens,
    });

    const content = completion.choices[0]?.message?.content || "";
    console.log("[FastModel] Response received, length:", content.length);

    return { content };
  } catch (error) {
    console.error("[FastModel] API Error, falling back to Kimi:", error);
    // Fallback to Kimi K2.5 if fast model fails
    return chatWithKimi(messages, config);
  }
}

// ============================================
// OpenRouter Integration (Gemini Flash via OpenRouter)
// ============================================

// Use Gemini Flash for all agents (text and vision)
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-exp";

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

    return { content };
  } catch (error) {
    console.error("[OpenRouter] API Error:", error);
    throw error;
  }
}

// Media type for Kimi vision/video
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
    if (!apiKey) throw new Error("GOOGLE_AI_API_KEY environment variable is required");
    fileManager = new GoogleAIFileManager(apiKey);
  }
  return fileManager;
}

/**
 * Prepare media for Gemini API — uses inline data for small files,
 * File API for large files (>15MB) to avoid 413 errors.
 * Returns the content part and an optional cleanup function.
 */
async function prepareMediaForGemini(
  media: MediaInput,
): Promise<{
  part: { inlineData: { data: string; mimeType: string } } | { fileData: { fileUri: string; mimeType: string } };
  cleanup: (() => Promise<void>) | null;
}> {
  const getMimeType = (ext: string, type: MediaType) =>
    `${type === "image" ? "image" : "video"}/${ext}`;

  // Case 1: Already have base64 data
  if (media.base64 && media.mimeType) {
    const sizeBytes = Math.ceil(media.base64.length * 3 / 4);
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
    const ext = path.extname(new URL(media.path).pathname).slice(1) || (media.type === "image" ? "png" : "mp4");
    const mimeType = getMimeType(ext, media.type);

    if (buffer.length < INLINE_SIZE_LIMIT) {
      return {
        part: { inlineData: { data: buffer.toString("base64"), mimeType } },
        cleanup: null,
      };
    }

    // Large file — save to temp and use File API
    const tmpPath = path.join(os.tmpdir(), `gemini-upload-${Date.now()}.${ext}`);
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
    try { fs.unlinkSync(filePath); } catch {}
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

  try {
    const result = await model.generateContent([fullPrompt, mediaPart]);
    const text = result.response.text();
    console.log("[GeminiFlashVision] Response length:", text?.length || 0);
    return { content: text || "" };
  } catch (error) {
    console.error("[GeminiFlashVision] API Error, falling back to Kimi vision:", error);
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
  const { temperature = 0.7, maxTokens } = config;
  const client = getGeminiClient();

  console.log("[GeminiProVision] Calling Google AI Studio with media...");
  console.log("[GeminiProVision] Media type:", media.type);
  console.log("[GeminiProVision] Model:", GEMINI_PRO_MODEL);

  const model = client.getGenerativeModel({
    model: GEMINI_PRO_MODEL,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  });

  const fullPrompt = systemPrompt
    ? `${systemPrompt}\n\n---\n\n${textPrompt}`
    : textPrompt;

  const { part: mediaPart, cleanup } = await prepareMediaForGemini(media);

  try {
    const result = await model.generateContent([fullPrompt, mediaPart]);
    const text = result.response.text();
    console.log("[GeminiProVision] Response length:", text?.length || 0);
    return { content: text || "" };
  } catch (error) {
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

    return { content };
  } catch (error) {
    console.error("[OpenRouter Vision] API Error:", error);
    throw error;
  }
}

// Public vision function — routes to Gemini Flash first, falls back to Kimi
export async function chatWithKimiVision(
  media: MediaInput,
  textPrompt: string,
  systemPrompt?: string,
  config: ModelConfig = {},
): Promise<ChatResponse> {
  return chatWithGeminiFlashVision(media, textPrompt, systemPrompt, config);
}

// Convenience function for image analysis
export async function analyzeImageWithKimi(
  imagePath: string,
  prompt: string,
  systemPrompt?: string,
  config: ModelConfig = {},
): Promise<string> {
  const response = await chatWithKimiVision(
    { type: "image", path: imagePath },
    prompt,
    systemPrompt,
    config,
  );
  return response.content;
}

// Convenience function for video analysis
export async function analyzeVideoWithKimi(
  videoPath: string,
  prompt: string,
  systemPrompt?: string,
  config: ModelConfig = {},
): Promise<string> {
  const response = await chatWithKimiVision(
    { type: "video", path: videoPath },
    prompt,
    systemPrompt,
    config,
  );
  return response.content;
}
