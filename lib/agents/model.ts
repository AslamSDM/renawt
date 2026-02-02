import OpenAI from "openai";
import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

// Configuration for model provider
// Set USE_OPENROUTER=true in .env to use OpenRouter during development
const USE_OPENROUTER = process.env.USE_OPENROUTER === "true";

// OpenRouter model - using arcee with reasoning
const OPENROUTER_MODEL = "arcee-ai/trinity-large-preview:free";

// OpenRouter client singleton
let openRouterClient: OpenAI | null = null;

function getOpenRouterClient(): OpenAI {
  if (!openRouterClient) {
    openRouterClient = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
        "X-Title": "AI Video Generator",
      },
    });
  }
  return openRouterClient;
}

// Type for OpenRouter response with reasoning_details
type ORChatMessage = OpenAI.Chat.Completions.ChatCompletionMessage & {
  reasoning_details?: unknown;
};

interface ModelConfig {
  temperature?: number;
  maxTokens?: number;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  reasoning_details?: unknown;
}

interface ChatResponse {
  content: string;
  reasoning_details?: unknown;
}

// Direct OpenRouter API call with reasoning support
export async function chatWithOpenRouter(
  messages: ChatMessage[],
  config: ModelConfig = {}
): Promise<ChatResponse> {
  const { temperature = 0.7, maxTokens } = config;
  const client = getOpenRouterClient();

  console.log("[OpenRouter] Calling API with reasoning enabled...");

  const apiResponse = await client.chat.completions.create({
    model: OPENROUTER_MODEL,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.reasoning_details ? { reasoning_details: m.reasoning_details } : {}),
    })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    temperature,
    max_tokens: maxTokens,
    // @ts-expect-error - OpenRouter extension for reasoning
    reasoning: { enabled: true },
  });

  const response = apiResponse.choices[0].message as ORChatMessage;

  console.log("[OpenRouter] Response received");

  return {
    content: response.content || "",
    reasoning_details: response.reasoning_details,
  };
}

// Multi-turn conversation with OpenRouter (preserves reasoning context)
export async function chatWithOpenRouterMultiTurn(
  systemPrompt: string,
  userMessage: string,
  config: ModelConfig = {}
): Promise<string> {
  const response = await chatWithOpenRouter(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    config
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
export function isUsingOpenRouter(): boolean {
  return USE_OPENROUTER;
}

// Pre-configured model configs for different use cases
export const SCRAPER_CONFIG: ModelConfig = { temperature: 0.3 };
export const SCRIPT_WRITER_CONFIG: ModelConfig = { temperature: 0.7 };
export const CODE_GENERATOR_CONFIG: ModelConfig = { temperature: 0.3, maxTokens: 8000 };
