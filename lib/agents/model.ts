import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

// Configuration for model provider
// Set USE_OPENROUTER=true in .env to use OpenRouter during development
const USE_OPENROUTER = process.env.USE_OPENROUTER === "true";

// OpenRouter model mapping
// See https://openrouter.ai/models for available models
const OPENROUTER_MODELS = {
  // Use Claude via OpenRouter
  sonnet: "anthropic/claude-sonnet-4",
  arcee: "arcee-ai/trinity-large-preview",
  // Alternative models you can try:
  // "openai/gpt-4o",
  // "google/gemini-2.0-flash-001",
  // "meta-llama/llama-3.3-70b-instruct",
};

interface ModelConfig {
  temperature?: number;
  maxTokens?: number;
}

export function getModel(config: ModelConfig = {}): BaseChatModel {
  const { temperature = 0.7, maxTokens } = config;

  if (USE_OPENROUTER) {
    console.log("[Model] Using OpenRouter API");
    return new ChatOpenAI({
      modelName: OPENROUTER_MODELS.arcee,
      temperature,
      maxTokens,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
          "X-Title": "AI Video Generator",
        },
      },
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }

  // Default: Use Anthropic Claude directly
  console.log("[Model] Using Anthropic Claude API");
  return new ChatAnthropic({
    model: "claude-sonnet-4-20250514",
    temperature,
    maxTokens,
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

// Pre-configured models for different use cases
export const scraperModel = () => getModel({ temperature: 0.3 });

export const scriptWriterModel = () => getModel({ temperature: 0.7 });

export const codeGeneratorModel = () =>
  getModel({ temperature: 0.3, maxTokens: 8000 });
