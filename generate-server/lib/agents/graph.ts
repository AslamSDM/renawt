import { createStep, createWorkflow } from "@mastra/core/workflows";
import {
  VideoGenerationStateSchema,
  type VideoGenerationStateType,
} from "./state";
import { scraperNode } from "./scraper";
import { scriptWriterNode } from "./scriptWriter";
import { demoScriptWriterNode } from "./demoScriptWriter";
import { creativeDirectorNode } from "./creativeDirector";
import { jsonComposerNode } from "./jsonComposer";
import { videoRendererNode } from "./videoRenderer";
import { renderErrorFixerNode } from "./renderErrorFixer";

function mergeState(
  prev: VideoGenerationStateType,
  partial: Partial<VideoGenerationStateType>,
): VideoGenerationStateType {
  return {
    ...prev,
    ...partial,
    errors: [...prev.errors, ...(partial.errors ?? [])],
  };
}

function isHalted(state: VideoGenerationStateType): boolean {
  return state.currentStep === "error" || state.errors.length > 0;
}

const scraperStep = createStep({
  id: "scraper",
  inputSchema: VideoGenerationStateSchema,
  outputSchema: VideoGenerationStateSchema,
  execute: async ({ inputData }) => {
    if (isHalted(inputData)) return inputData;
    const partial = await scraperNode(inputData);
    return mergeState(inputData, partial);
  },
});

const scriptStep = createStep({
  id: "script",
  inputSchema: VideoGenerationStateSchema,
  outputSchema: VideoGenerationStateSchema,
  execute: async ({ inputData }) => {
    if (isHalted(inputData)) return inputData;
    const fn =
      inputData.userPreferences.videoType === "demo"
        ? demoScriptWriterNode
        : scriptWriterNode;
    const partial = await fn(inputData);
    return mergeState(inputData, partial);
  },
});

const creativeDirectorStep = createStep({
  id: "creativeDirector",
  inputSchema: VideoGenerationStateSchema,
  outputSchema: VideoGenerationStateSchema,
  execute: async ({ inputData }) => {
    if (isHalted(inputData)) return inputData;
    const partial = await creativeDirectorNode(inputData);
    return mergeState(inputData, partial);
  },
});

const codeGenStep = createStep({
  id: "codeGen",
  inputSchema: VideoGenerationStateSchema,
  outputSchema: VideoGenerationStateSchema,
  execute: async ({ inputData }) => {
    if (isHalted(inputData)) return inputData;
    const partial = await jsonComposerNode(inputData);
    return mergeState(inputData, partial);
  },
});

const renderStep = createStep({
  id: "render",
  inputSchema: VideoGenerationStateSchema,
  outputSchema: VideoGenerationStateSchema,
  execute: async ({ inputData }) => {
    if (inputData.currentStep === "error") return inputData;

    let state = inputData;

    if (
      state.currentStep === "fixing" &&
      state.renderAttempts > 0 &&
      state.renderAttempts < 3
    ) {
      const fixed = await renderErrorFixerNode(state);
      state = mergeState(state, fixed);
      if (state.currentStep === "error") return state;
    }

    const rendered = await videoRendererNode(state);
    return mergeState(state, rendered);
  },
});

export const videoGenerationWorkflow = createWorkflow({
  id: "videoGeneration",
  inputSchema: VideoGenerationStateSchema,
  outputSchema: VideoGenerationStateSchema,
})
  .then(scraperStep)
  .then(scriptStep)
  .then(creativeDirectorStep)
  .then(codeGenStep)
  .dountil(renderStep, async ({ inputData }) => {
    return (
      inputData.currentStep === "complete" ||
      inputData.currentStep === "error" ||
      inputData.renderAttempts >= 3
    );
  })
  .commit();

function buildInitialState(input: {
  sourceUrl?: string | null;
  description?: string | null;
  userPreferences: {
    style: "professional" | "playful" | "minimal" | "bold";
    videoType?: "demo" | "creative" | "fast-paced" | "cinematic";
  };
  recordings?: VideoGenerationStateType["recordings"];
  projectId?: string;
}): VideoGenerationStateType {
  return {
    sourceUrl: input.sourceUrl ?? null,
    description: input.description ?? null,
    userPreferences: input.userPreferences as VideoGenerationStateType["userPreferences"],
    recordings: input.recordings ?? [],
    productData: null,
    videoScript: null,
    reactPageCode: null,
    remotionCode: null,
    videoJson: null,
    beatMap: null,
    currentStep: "scraping",
    errors: [],
    projectId: input.projectId ?? null,
    renderAttempts: 0,
    lastRenderError: null,
    videoUrl: null,
    r2Key: null,
  };
}

export async function runVideoGeneration(input: {
  sourceUrl?: string | null;
  description?: string | null;
  userPreferences: {
    style: "professional" | "playful" | "minimal" | "bold";
    videoType?: "demo" | "creative" | "fast-paced" | "cinematic";
  };
  recordings?: VideoGenerationStateType["recordings"];
  projectId?: string;
}): Promise<VideoGenerationStateType> {
  const initialState = buildInitialState(input);
  const run = await videoGenerationWorkflow.createRun();
  const result = await run.start({ inputData: initialState });

  if (result.status === "success" && result.result) {
    return result.result as VideoGenerationStateType;
  }

  const errMsg =
    result.status === "failed"
      ? result.error?.message || "Workflow failed"
      : `Workflow ended with status: ${result.status}`;
  throw new Error(errMsg);
}

export async function* streamVideoGeneration(input: {
  sourceUrl?: string | null;
  description?: string | null;
  userPreferences: {
    style: "professional" | "playful" | "minimal" | "bold";
    videoType?: "demo" | "creative" | "fast-paced" | "cinematic";
  };
  recordings?: VideoGenerationStateType["recordings"];
  projectId?: string;
}) {
  const initialState = buildInitialState(input);
  const run = await videoGenerationWorkflow.createRun();
  const { stream } = run.stream({ inputData: initialState });

  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}
