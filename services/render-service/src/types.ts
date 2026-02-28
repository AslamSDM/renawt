export interface RenderRequest {
  jobId?: string;
  remotionCode: string;
  durationInFrames: number;
  outputFormat?: "mp4" | "webm";
  width?: number;
  height?: number;
  fps?: number;
  projectId?: string;
  callbackUrl?: string;
  assets?: {
    audioUrls?: string[];
    imageUrls?: string[];
  };
}

export interface RenderJobStatus {
  jobId: string;
  status: "queued" | "active" | "rendering" | "completed" | "failed";
  progress?: number;
  localFilePath?: string;
  videoUrl?: string;
  error?: string;
  renderTime?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RenderResult {
  success: boolean;
  localFilePath?: string;
  error?: string;
  renderTime?: number;
}
