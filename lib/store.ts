import { create } from "zustand";
import type {
  GenerationState,
  GenerationStep,
  ProductData,
  VideoScript,
  UserPreferences,
} from "./types";

interface VideoStore {
  // Generation state
  generation: GenerationState;
  setGenerationStep: (step: GenerationStep) => void;
  setGenerationProgress: (progress: number) => void;
  setGenerationMessage: (message: string) => void;
  setProductData: (data: ProductData) => void;
  setVideoScript: (script: VideoScript) => void;
  setRemotionCode: (code: string) => void;
  setProjectId: (id: string) => void;
  addError: (error: string) => void;
  resetGeneration: () => void;

  // User preferences
  preferences: UserPreferences;
  setPreferences: (preferences: Partial<UserPreferences>) => void;

  // Input state
  sourceUrl: string;
  description: string;
  setSourceUrl: (url: string) => void;
  setDescription: (description: string) => void;

  // UI state
  isGenerating: boolean;
  setIsGenerating: (value: boolean) => void;
  activeTab: "url" | "description";
  setActiveTab: (tab: "url" | "description") => void;

  // Generate video action
  generateVideo: () => Promise<void>;
}

const initialGenerationState: GenerationState = {
  step: "idle",
  progress: 0,
  message: "",
  errors: [],
};

const initialPreferences: UserPreferences = {
  style: "professional",
};

export const useVideoStore = create<VideoStore>((set, get) => ({
  // Generation state
  generation: initialGenerationState,
  setGenerationStep: (step) =>
    set((state) => ({
      generation: { ...state.generation, step },
    })),
  setGenerationProgress: (progress) =>
    set((state) => ({
      generation: { ...state.generation, progress },
    })),
  setGenerationMessage: (message) =>
    set((state) => ({
      generation: { ...state.generation, message },
    })),
  setProductData: (productData) =>
    set((state) => ({
      generation: { ...state.generation, productData },
    })),
  setVideoScript: (videoScript) =>
    set((state) => ({
      generation: { ...state.generation, videoScript },
    })),
  setRemotionCode: (remotionCode) =>
    set((state) => ({
      generation: { ...state.generation, remotionCode },
    })),
  setProjectId: (projectId) =>
    set((state) => ({
      generation: { ...state.generation, projectId },
    })),
  addError: (error) =>
    set((state) => ({
      generation: {
        ...state.generation,
        errors: [...state.generation.errors, error],
      },
    })),
  resetGeneration: () =>
    set({
      generation: initialGenerationState,
    }),

  // User preferences
  preferences: initialPreferences,
  setPreferences: (preferences) =>
    set((state) => ({
      preferences: { ...state.preferences, ...preferences },
    })),

  // Input state
  sourceUrl: "",
  description: "",
  setSourceUrl: (sourceUrl) => set({ sourceUrl }),
  setDescription: (description) => set({ description }),

  // UI state
  isGenerating: false,
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  activeTab: "url",
  setActiveTab: (activeTab) => set({ activeTab }),

  // Generate video action
  generateVideo: async () => {
    const { sourceUrl, description, preferences, activeTab } = get();

    const url = activeTab === "url" ? sourceUrl : undefined;
    const desc = activeTab === "description" ? description : undefined;

    if (!url && !desc) {
      get().addError("Please provide a URL or description");
      return;
    }

    set({ isGenerating: true });
    get().resetGeneration();
    get().setGenerationStep("scraping");
    get().setGenerationMessage("Starting video generation...");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          description: desc,
          preferences,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const chunk = JSON.parse(line);

            switch (chunk.type) {
              case "status": {
                const step = chunk.data.step as GenerationStep;
                get().setGenerationStep(step);
                if (chunk.data.projectId) {
                  get().setProjectId(chunk.data.projectId);
                }
                // Update progress based on step
                const progressMap: Record<GenerationStep, number> = {
                  idle: 0,
                  scraping: 20,
                  scripting: 50,
                  generating: 80,
                  complete: 100,
                  error: 0,
                };
                get().setGenerationProgress(progressMap[step] || 0);
                get().setGenerationMessage(getStepMessage(step));
                break;
              }

              case "productData":
                get().setProductData(chunk.data);
                get().setGenerationMessage("Product data extracted");
                break;

              case "videoScript":
                get().setVideoScript(chunk.data);
                get().setGenerationMessage("Video script generated");
                break;

              case "remotionCode":
                get().setRemotionCode(chunk.data);
                get().setGenerationMessage("Video code generated");
                break;

              case "error":
                chunk.data.errors.forEach((error: string) => {
                  get().addError(error);
                });
                get().setGenerationStep("error");
                get().setGenerationMessage("Generation failed");
                break;

              case "complete":
                get().setGenerationStep("complete");
                get().setGenerationProgress(100);
                get().setGenerationMessage("Video ready!");
                break;
            }
          } catch {
            console.warn("Failed to parse chunk:", line);
          }
        }
      }
    } catch (error) {
      console.error("Generation error:", error);
      get().addError(error instanceof Error ? error.message : "Unknown error");
      get().setGenerationStep("error");
      get().setGenerationMessage("Generation failed");
    } finally {
      set({ isGenerating: false });
    }
  },
}));

function getStepMessage(step: GenerationStep): string {
  const messages: Record<GenerationStep, string> = {
    idle: "",
    scraping: "Analyzing website...",
    scripting: "Writing video script...",
    generating: "Generating video code...",
    complete: "Video ready!",
    error: "Generation failed",
  };
  return messages[step];
}
