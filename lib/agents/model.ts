import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import OpenAI from "openai";
import * as fs from "fs";
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

// LangChain model for direct Anthropic usage (production)
export function getAnthropicModel(config: ModelConfig = {}): BaseChatModel {
  const { temperature = 0.7, maxTokens } = config;

  console.log("[Model] Using Anthropic Claude API");
  return new ChatAnthropic({
    model: "claude-sonnet-4-20250514",
    temperature,
    maxTokens,
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
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

// ============================================
// OpenRouter Integration (Kimi K2.5 via OpenRouter)
// ============================================

// Use Kimi K2.5 for all agents (text and vision)
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "moonshotai/kimi-k2.5";

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

// Chat with vision model using video or image input
export async function chatWithKimiVision(
  media: MediaInput,
  textPrompt: string,
  systemPrompt?: string,
  config: ModelConfig = {},
): Promise<ChatResponse> {
  const { temperature = 0.7, maxTokens } = config;
  const client = getOpenRouterClient();

  console.log("[OpenRouter Vision] Calling API with media...");
  console.log("[OpenRouter Vision] Media type:", media.type);
  console.log("[OpenRouter Vision] Model:", OPENROUTER_MODEL);

  // Get the data URL
  let dataUrl: string;
  if (media.base64 && media.mimeType) {
    dataUrl = `data:${media.mimeType};base64,${media.base64}`;
  } else if (media.path) {
    dataUrl = encodeMediaToDataUrl(media.path, media.type);
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
      messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
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
