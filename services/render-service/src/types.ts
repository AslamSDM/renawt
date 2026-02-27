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
  status: "queued" | "active" | "rendering" | "uploading" | "completed" | "failed";
  progress?: number;
  videoUrl?: string;
  r2Key?: string;
  error?: string;
  renderTime?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RenderResult {
  success: boolean;
  videoUrl?: string;
  r2Key?: string;
  error?: string;
  renderTime?: number;
}
