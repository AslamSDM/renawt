import { StateGraph, END } from "@langchain/langgraph";
import { VideoGenerationState, type VideoGenerationStateType } from "./state";
import { scraperNode } from "./scraper";
import { scriptWriterNode } from "./scriptWriter";
import { demoScriptWriterNode } from "./demoScriptWriter";
// Two-step code generation: React page first, then Remotion translation
import { reactPageGeneratorNode } from "./reactPageGenerator";
import { remotionTranslatorNode, generateFallbackComposition } from "./remotionTranslator";
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

/**
 * Template short-circuit: if video type is "creative" or "fast-paced" and
 * we have product data, skip LLM-based reactPageGenerator + remotionTranslator
 * and use the deterministic fallback composition directly.
 * This saves 20-35s by eliminating 2-3 LLM calls.
 */
function shouldGenerateReactPage(
  state: VideoGenerationStateType,
): "reactPageGenerator" | "templateShortCircuit" | "error" {
  if (state.currentStep === "error" || state.errors.length > 0) {
    return "error";
  }

  // Use template short-circuit for creative/fast-paced videos with product data
  const videoType = state.userPreferences.videoType;
  const useTemplate = process.env.ENABLE_TEMPLATE_SHORTCIRCUIT === "true";

  if (useTemplate && state.productData && (videoType === "creative" || videoType === "fast-paced")) {
    console.log("[Graph] Template short-circuit: skipping reactPageGenerator + remotionTranslator");
    return "templateShortCircuit";
  }

  return "reactPageGenerator";
}

/**
 * Template short-circuit node: generates Remotion code directly from product data
 * without going through reactPageGenerator + remotionTranslator LLM calls.
 */
async function templateShortCircuitNode(
  state: VideoGenerationStateType,
): Promise<Partial<VideoGenerationStateType>> {
  console.log("[TemplateShortCircuit] Generating composition from template...");

  const productName = state.productData?.name || "Product";
  const audio = state.userPreferences.audio;
  const audioUrl = audio?.url || "audio/audio1.mp3";
  const audioBpm = audio?.bpm || 120;

  const remotionCode = generateFallbackComposition(
    productName,
    audioUrl,
    audioBpm,
    state.recordings,
  );

  console.log(`[TemplateShortCircuit] Generated ${remotionCode.length} chars of Remotion code`);

  return {
    remotionCode,
    currentStep: "complete",
  };
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
  // If render failed, go to error fixer (up to 3 attempts)
  // Check this BEFORE errors — a failed render always adds to errors array
  if (state.currentStep === "fixing" && state.renderAttempts < 3) {
    return "renderErrorFixer";
  }

  if (state.currentStep === "error") {
    return "error";
  }

  // If successful or max attempts reached, end
  return "__end__";
}

function shouldContinueAfterFix(
  state: VideoGenerationStateType,
): "videoRenderer" | "error" {
  if (state.currentStep === "error") {
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
  .addNode("templateShortCircuit", templateShortCircuitNode) // Template path (skips LLM)
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

  // After script writing, go to React page generator OR template short-circuit
  .addConditionalEdges("scriptWriter", shouldGenerateReactPage, {
    reactPageGenerator: "reactPageGenerator",
    templateShortCircuit: "templateShortCircuit",
    error: "errorHandler",
  })
  .addConditionalEdges("demoScriptWriter", shouldGenerateReactPage, {
    reactPageGenerator: "reactPageGenerator",
    templateShortCircuit: "templateShortCircuit",
    error: "errorHandler",
  })

  // Template short-circuit goes directly to video renderer
  .addConditionalEdges("templateShortCircuit", shouldRenderVideo, {
    videoRenderer: "videoRenderer",
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
  recordings?: Array<{
    id: string;
    videoUrl: string;
    duration: number;
    featureName: string;
    description: string;
    trimStart: number;
    trimEnd: number;
    mockupFrame?: "browser" | "macbook" | "minimal";
  }>;
  projectId?: string;
}) {
  const initialState = {
    sourceUrl: input.sourceUrl || null,
    description: input.description || null,
    userPreferences: input.userPreferences,
    recordings: input.recordings || [],
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
  recordings?: Array<{
    id: string;
    videoUrl: string;
    duration: number;
    featureName: string;
    description: string;
    trimStart: number;
    trimEnd: number;
    mockupFrame?: "browser" | "macbook" | "minimal";
  }>;
  projectId?: string;
}) {
  const initialState = {
    sourceUrl: input.sourceUrl || null,
    description: input.description || null,
    userPreferences: input.userPreferences,
    recordings: input.recordings || [],
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
