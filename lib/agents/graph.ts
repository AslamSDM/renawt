import { StateGraph, END } from "@langchain/langgraph";
import { VideoGenerationState, type VideoGenerationStateType } from "./state";
import { scraperNode } from "./scraper";
import { scriptWriterNode } from "./scriptWriter";
import { demoScriptWriterNode } from "./demoScriptWriter";
// Two-step code generation: React page first, then Remotion translation
import { reactPageGeneratorNode } from "./reactPageGenerator";
import { remotionTranslatorNode } from "./remotionTranslator";
// Video rendering with error fixing
import { videoRendererNode } from "./videoRenderer";
import { renderErrorFixerNode } from "./renderErrorFixer";

// Conditional routing based on video type and errors
function shouldContinue(
  state: VideoGenerationStateType,
): "scriptWriter" | "demoScriptWriter" | "error" {
  if (state.currentStep === "error" || state.errors.length > 0) {
    return "error";
  }

  // Route to appropriate script writer based on video type
  const videoType = state.userPreferences.videoType;
  if (videoType === "demo") {
    return "demoScriptWriter";
  }
  return "scriptWriter";
}

function shouldGenerateReactPage(
  state: VideoGenerationStateType,
): "reactPageGenerator" | "error" {
  if (state.currentStep === "error" || state.errors.length > 0) {
    return "error";
  }
  return "reactPageGenerator";
}

function shouldTranslateToRemotion(
  state: VideoGenerationStateType,
): "remotionTranslator" | "error" {
  if (state.currentStep === "error" || state.errors.length > 0) {
    return "error";
  }
  return "remotionTranslator";
}

function shouldRenderVideo(
  state: VideoGenerationStateType,
): "videoRenderer" | "error" {
  if (state.currentStep === "error" || state.errors.length > 0) {
    return "error";
  }
  return "videoRenderer";
}

function shouldContinueAfterRender(
  state: VideoGenerationStateType,
): "renderErrorFixer" | "__end__" | "error" {
  if (state.currentStep === "error" || state.errors.length > 0) {
    return "error";
  }
  
  // If render failed, go to error fixer (up to 3 attempts)
  if (state.currentStep === "fixing" && state.renderAttempts < 3) {
    return "renderErrorFixer";
  }
  
  // If successful or max attempts reached, end
  return "__end__";
}

function shouldContinueAfterFix(
  state: VideoGenerationStateType,
): "videoRenderer" | "error" {
  if (state.currentStep === "error" || state.errors.length > 0) {
    return "error";
  }
  // Go back to rendering with the fixed code
  return "videoRenderer";
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

// Build the graph with video rendering and error fixing
// Flow: scraper → scriptWriter → reactPageGenerator → remotionTranslator → videoRenderer → (error fixer → videoRenderer)* → end
const workflow = new StateGraph(VideoGenerationState)
  // Add nodes
  .addNode("scraper", scraperNode)
  .addNode("scriptWriter", scriptWriterNode)
  .addNode("demoScriptWriter", demoScriptWriterNode)
  .addNode("reactPageGenerator", reactPageGeneratorNode) // Step 1: Generate React page
  .addNode("remotionTranslator", remotionTranslatorNode) // Step 2: Translate to Remotion
  .addNode("videoRenderer", videoRendererNode) // Step 3: Render video
  .addNode("renderErrorFixer", renderErrorFixerNode) // Step 4: Fix render errors
  .addNode("errorHandler", errorHandlerNode)

  // Add edges
  .addEdge("__start__", "scraper")

  // After scraping, go to script writer
  .addConditionalEdges("scraper", shouldContinue, {
    scriptWriter: "scriptWriter",
    demoScriptWriter: "demoScriptWriter",
    error: "errorHandler",
  })

  // After script writing, go to React page generator
  .addConditionalEdges("scriptWriter", shouldGenerateReactPage, {
    reactPageGenerator: "reactPageGenerator",
    error: "errorHandler",
  })
  .addConditionalEdges("demoScriptWriter", shouldGenerateReactPage, {
    reactPageGenerator: "reactPageGenerator",
    error: "errorHandler",
  })

  // After React page generation, translate to Remotion
  .addConditionalEdges("reactPageGenerator", shouldTranslateToRemotion, {
    remotionTranslator: "remotionTranslator",
    error: "errorHandler",
  })

  // After Remotion translation, render the video
  .addConditionalEdges("remotionTranslator", shouldRenderVideo, {
    videoRenderer: "videoRenderer",
    error: "errorHandler",
  })

  // After rendering, either end (success) or fix errors (failure)
  .addConditionalEdges("videoRenderer", shouldContinueAfterRender, {
    renderErrorFixer: "renderErrorFixer",
    __end__: END,
    error: "errorHandler",
  })

  // After fixing errors, try rendering again
  .addConditionalEdges("renderErrorFixer", shouldContinueAfterFix, {
    videoRenderer: "videoRenderer",
    error: "errorHandler",
  })

  .addEdge("errorHandler", END);

// Compile and export the graph
export const videoGenerationGraph = workflow.compile();

// Helper function to run the graph with initial state
export async function runVideoGeneration(input: {
  sourceUrl?: string | null;
  description?: string | null;
  userPreferences: {
    style: "professional" | "playful" | "minimal" | "bold";
    videoType?: "demo" | "creative" | "fast-paced" | "cinematic";
  };
  projectId?: string;
}) {
  const initialState = {
    sourceUrl: input.sourceUrl || null,
    description: input.description || null,
    userPreferences: input.userPreferences,
    productData: null,
    videoScript: null,
    reactPageCode: null,
    remotionCode: null,
    currentStep: "scraping" as const,
    errors: [],
    projectId: input.projectId || null,
    renderAttempts: 0,
    lastRenderError: null,
    videoUrl: null,
  };

  return videoGenerationGraph.invoke(initialState);
}

// Stream version for real-time updates
export async function* streamVideoGeneration(input: {
  sourceUrl?: string | null;
  description?: string | null;
  userPreferences: {
    style: "professional" | "playful" | "minimal" | "bold";
    videoType?: "demo" | "creative" | "fast-paced" | "cinematic";
  };
  projectId?: string;
}) {
  const initialState = {
    sourceUrl: input.sourceUrl || null,
    description: input.description || null,
    userPreferences: input.userPreferences,
    productData: null,
    videoScript: null,
    reactPageCode: null,
    remotionCode: null,
    currentStep: "scraping" as const,
    errors: [],
    projectId: input.projectId || null,
    renderAttempts: 0,
    lastRenderError: null,
    videoUrl: null,
  };

  const stream = await videoGenerationGraph.stream(initialState);

  for await (const chunk of stream) {
    yield chunk;
  }
}
