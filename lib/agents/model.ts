import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

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

interface ChatMessage {
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
