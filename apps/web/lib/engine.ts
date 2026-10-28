/**
 * Server-side client for the remawt engine (apps/engine). See docs/BUILD.md "Engine HTTP API".
 * Every call returns a result union and never throws, so the UI can show a toast instead of crashing
 * when the engine is down or ENGINE_URL is unset.
 */
import type { z } from "zod";
import type {
  StartVideoRequest,
  StartVideoResponse,
  KitPreviewRequest,
  KitPreviewResponse,
  GenerateIdeasRequest,
  GenerateIdeasResponse,
  RefreshRadarRequest,
  SchedulePublicationRequest,
  SchedulePublicationResponse,
  RerenderRequest,
  ProgressEvent,
} from "@remawt/shared";

export type EngineResult<T> = { ok: true; data: T } | { ok: false; reason: string; status?: number };

export interface EngineVoice {
  voiceId: string;
  name: string;
  provider: "elevenlabs" | "kokoro" | "inworld";
  previewUrl?: string | null;
  tags?: string[];
}

export interface EngineTrendCard {
  id: string;
  niche: string;
  weekKey: string;
  topic: string;
  format: string;
  hookType?: string | null;
  score: number;
  summary: string;
  exemplars: unknown;
  evidence?: unknown;
}

const TIMEOUT_MS = 20_000;

export function isEngineConfigured(): boolean {
  return !!process.env.ENGINE_URL;
}

async function request<T>(method: "GET" | "POST", path: string, userId: string, body?: unknown): Promise<EngineResult<T>> {
  const base = process.env.ENGINE_URL?.replace(/\/+$/, "");
  if (!base) return { ok: false, reason: "The video engine is not connected yet (ENGINE_URL is not set)." };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.API_KEY ?? ""}`,
        "x-user-id": userId,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      const msg = json && typeof json === "object" && "error" in json && typeof json.error === "string" ? json.error : null;
      return { ok: false, status: res.status, reason: msg ?? `The engine returned ${res.status}.` };
    }
    return { ok: true, data: json as T };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    console.error(`[engine] ${method} ${path}`, e);
    return { ok: false, reason: aborted ? "The engine took too long to answer. Try again." : "Couldn’t reach the video engine. Try again." };
  } finally {
    clearTimeout(timer);
  }
}

type In<S extends z.ZodType> = z.input<S>;
type Out<S extends z.ZodType> = z.output<S>;

export const engine = {
  get: <T>(path: string, userId: string) => request<T>("GET", path, userId),
  post: <T>(path: string, body: unknown, userId: string) => request<T>("POST", path, userId, body),

  startVideo: (userId: string, body: In<typeof StartVideoRequest>) =>
    request<Out<typeof StartVideoResponse>>("POST", "/v1/videos/start", userId, body),
  rerender: (userId: string, body: In<typeof RerenderRequest>) => request<{ runId: string }>("POST", "/v1/videos/rerender", userId, body),
  progress: (userId: string, videoId: string) =>
    request<{ status: string; progress: ProgressEvent[] }>("GET", `/v1/videos/${encodeURIComponent(videoId)}/progress`, userId),

  kitPreviews: (userId: string, body: In<typeof KitPreviewRequest>) =>
    request<Out<typeof KitPreviewResponse>>("POST", "/v1/kit/previews", userId, body),
  voiceSample: (userId: string, body: { voiceId: string; provider: string; text: string }) =>
    request<{ audioUrl: string }>("POST", "/v1/kit/voice-sample", userId, body),
  voices: (userId: string) => request<EngineVoice[]>("GET", "/v1/voices", userId),

  radarRefresh: (userId: string, body: In<typeof RefreshRadarRequest>) =>
    request<{ queued: string[] }>("POST", "/v1/radar/refresh", userId, body),
  radar: (userId: string, niche: string, week?: string) =>
    request<{ cards: EngineTrendCard[] }>(
      "GET",
      `/v1/radar/${encodeURIComponent(niche)}${week ? `?week=${encodeURIComponent(week)}` : ""}`,
      userId,
    ),
  generateIdeas: (userId: string, body: In<typeof GenerateIdeasRequest>) =>
    request<Out<typeof GenerateIdeasResponse>>("POST", "/v1/ideas/generate", userId, body),

  schedulePublication: (userId: string, body: In<typeof SchedulePublicationRequest>) =>
    request<Out<typeof SchedulePublicationResponse>>("POST", "/v1/publications/schedule", userId, body),
  cancelPublication: (userId: string, publicationId: string) =>
    request<{ ok: boolean }>("POST", `/v1/publications/${encodeURIComponent(publicationId)}/cancel`, userId, {}),

  socialConnect: (userId: string, body: { channelId: string; platform: string; returnUrl: string }) =>
    request<{ url: string }>("POST", "/v1/social/connect", userId, body),
  socialSync: (userId: string, body: { channelId: string }) => request<{ ok?: boolean; accounts?: number }>("POST", "/v1/social/sync", userId, body),

  health: (userId: string) => request<{ ok: boolean }>("GET", "/health", userId),
};
