import { StateGraph, END } from "@langchain/langgraph";
import { VideoGenerationState, type VideoGenerationStateType } from "./state";
import { scraperNode } from "./scraper";
import { scriptWriterNode } from "./scriptWriter";
// Use template-based generator for guaranteed premium animations (no LLM hallucination)
import { templateCodeGeneratorNode as codeGeneratorNode } from "./templateCodeGenerator";

// Conditional routing based on errors
function shouldContinue(
  state: VideoGenerationStateType,
): "scriptWriter" | "error" {
  if (state.currentStep === "error" || state.errors.length > 0) {
    return "error";
  }
  return "scriptWriter";
}

function shouldGenerateCode(
  state: VideoGenerationStateType,
): "codeGenerator" | "error" {
  if (state.currentStep === "error" || state.errors.length > 0) {
    return "error";
  }
  return "codeGenerator";
}

function shouldEnd(state: VideoGenerationStateType): "__end__" | "error" {
  if (state.currentStep === "error" || state.errors.length > 0) {
    return "error";
  }
  return "__end__";
}

// Error handler node
async function errorHandlerNode(
  state: VideoGenerationStateType,
): Promise<Partial<VideoGenerationStateType>> {
  console.log("[ErrorHandler] Handling errors:", state.errors);
  return {
    currentStep: "error",
  };
}

// Build the graph
const workflow = new StateGraph(VideoGenerationState)
  // Add nodes
  .addNode("scraper", scraperNode)
  .addNode("scriptWriter", scriptWriterNode)
  .addNode("codeGenerator", codeGeneratorNode)
  .addNode("errorHandler", errorHandlerNode)

  // Add edges
  .addEdge("__start__", "scraper")
  .addConditionalEdges("scraper", shouldContinue, {
    scriptWriter: "scriptWriter",
    error: "errorHandler",
  })
  .addConditionalEdges("scriptWriter", shouldGenerateCode, {
    codeGenerator: "codeGenerator",
    error: "errorHandler",
  })
  .addConditionalEdges("codeGenerator", shouldEnd, {
    __end__: END,
    error: "errorHandler",
  })
  .addEdge("errorHandler", END);

// Compile and export the graph
export const videoGenerationGraph = workflow.compile();

// Helper function to run the graph with initial state
export async function runVideoGeneration(input: {
  sourceUrl?: string | null;
  description?: string | null;
  userPreferences: { style: "professional" | "playful" | "minimal" | "bold" };
  projectId?: string;
}) {
  const initialState = {
    sourceUrl: input.sourceUrl || null,
    description: input.description || null,
    userPreferences: input.userPreferences,
    productData: null,
    videoScript: null,
    remotionCode: null,
    currentStep: "scraping" as const,
    errors: [],
    projectId: input.projectId || null,
  };

  return videoGenerationGraph.invoke(initialState);
}

// Stream version for real-time updates
export async function* streamVideoGeneration(input: {
  sourceUrl?: string | null;
  description?: string | null;
  userPreferences: { style: "professional" | "playful" | "minimal" | "bold" };
  projectId?: string;
}) {
  const initialState = {
    sourceUrl: input.sourceUrl || null,
    description: input.description || null,
    userPreferences: input.userPreferences,
    productData: null,
    videoScript: null,
    remotionCode: null,
    currentStep: "scraping" as const,
    errors: [],
    projectId: input.projectId || null,
  };

  const stream = await videoGenerationGraph.stream(initialState);

  for await (const chunk of stream) {
    yield chunk;
  }
}
