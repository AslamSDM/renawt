import type { VoiceTrack } from "@remawt/shared";

export interface SynthesizeRequest {
  text: string;
  voiceId: string;
  speed?: number;
  stability?: number;
  /** "premium" picks the flagship model where a provider has one. */
  quality?: "draft" | "standard" | "premium";
  /** R2 key prefix (without extension), e.g. `narration/{videoId}`. Required for persistence/idempotency. */
  storageKey?: string;
}

export interface SynthesizeResult extends VoiceTrack {
  model: string;
  chars: number;
  usd: number;
  cached: boolean;
}

export interface TtsProvider {
  readonly id: "elevenlabs" | "kokoro";
  isConfigured(): boolean;
  synthesize(req: SynthesizeRequest): Promise<SynthesizeResult>;
  /** Raw audio without persistence (voice samples). */
  sample?(req: SynthesizeRequest): Promise<{ audio: Buffer; contentType: string }>;
}

export interface VoiceInfo { voiceId: string; name: string; provider: string; previewUrl?: string; tags: string[] }
