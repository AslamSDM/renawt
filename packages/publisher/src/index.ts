import { z } from "zod";
import { createDryRunPublisher, type DryRunOptions } from "./adapters/dryrun";
import { createPostForMePublisher } from "./adapters/postforme";
import { createUploadPostPublisher } from "./adapters/uploadpost";
import { createYouTubePublisher, type TokenStore } from "./adapters/youtube";
import { isPlatform, PLATFORMS } from "./platforms";
import type { FetchLike, Platform, Publisher } from "./types";
import { PublisherError } from "./types";

export * from "./types";
export * from "./meta";
export * from "./caps";
export * from "./scheduler";
export * from "./retry";
export * from "./validate";
export { PLATFORMS, PLATFORM_KEY, isPlatform, platformFromKey } from "./platforms";
export { createDryRunPublisher, dryRunMetrics } from "./adapters/dryrun";
export { createPostForMePublisher, buildPostForMeBody, mapPostForMeMetrics, POSTFORME_BASE_URL } from "./adapters/postforme";
export { createUploadPostPublisher, buildUploadPostForm, mapUploadPostMetrics, uploadPostUsername, parseUploadPostAccount, UPLOADPOST_BASE_URL } from "./adapters/uploadpost";
export { createYouTubePublisher, buildYouTubeAuthUrl, buildYouTubeVideoResource, parseYouTubeState, YOUTUBE_SCOPES } from "./adapters/youtube";
export type { TokenStore, YouTubeTokens, OAuthState } from "./adapters/youtube";

export type PublisherId = "dryrun" | "postforme" | "uploadpost" | "youtube_direct";

export interface PublisherCapability {
  id: PublisherId;
  platforms: Platform[];
  supportsSchedule: boolean;
  supportsMetrics: boolean;
  /** Users connect through the vendor's already-audited TikTok/Meta/Google apps. */
  inheritsAudit: boolean;
  /** Native provider-side scheduling (vs engine sleepUntil + publish now). */
  nativeSchedule: boolean;
  experimental: boolean;
  env: string[];
}

/** Capability matrix. Engine/web read this to decide which platforms to offer per provider. */
export const PUBLISHERS: Record<PublisherId, PublisherCapability> = {
  dryrun: { id: "dryrun", platforms: [...PLATFORMS], supportsSchedule: true, supportsMetrics: true, inheritsAudit: true, nativeSchedule: true, experimental: false, env: [] },
  postforme: {
    id: "postforme",
    platforms: ["TIKTOK", "YOUTUBE", "INSTAGRAM", "FACEBOOK", "THREADS", "LINKEDIN", "X", "PINTEREST"],
    supportsSchedule: true, supportsMetrics: true, inheritsAudit: true, nativeSchedule: true, experimental: false,
    env: ["POSTFORME_API_KEY", "POSTFORME_BASE_URL"],
  },
  uploadpost: {
    id: "uploadpost",
    platforms: ["TIKTOK", "YOUTUBE", "INSTAGRAM", "FACEBOOK", "THREADS", "LINKEDIN", "X", "PINTEREST"],
    supportsSchedule: true, supportsMetrics: true, inheritsAudit: true, nativeSchedule: true, experimental: false,
    env: ["UPLOADPOST_API_KEY", "UPLOADPOST_BASE_URL"],
  },
  youtube_direct: {
    id: "youtube_direct", platforms: ["YOUTUBE"], supportsSchedule: true, supportsMetrics: true, inheritsAudit: false, nativeSchedule: true, experimental: true,
    env: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REDIRECT_URI"],
  },
};

export interface CreatePublisherOptions {
  fetch?: FetchLike;
  /** Required for youtube_direct. */
  tokenStore?: TokenStore;
  dryrun?: DryRunOptions;
}

const PublisherIdSchema = z.enum(["dryrun", "postforme", "uploadpost", "youtube_direct"]);

function capOverridesFromEnv(env: NodeJS.ProcessEnv): Partial<Record<Platform, number>> | undefined {
  // PUBLISHER_CAPS="TIKTOK=10,INSTAGRAM=50"
  if (!env.PUBLISHER_CAPS) return undefined;
  const out: Partial<Record<Platform, number>> = {};
  for (const pair of env.PUBLISHER_CAPS.split(",")) {
    const [k, v] = pair.split("=").map((s) => s.trim());
    const p = k?.toUpperCase();
    if (isPlatform(p) && Number.isFinite(Number(v))) out[p] = Number(v);
  }
  return out;
}

/** Which provider id the env selects: PUBLISHER_PROVIDER, else the first configured key, else dryrun. */
export function resolvePublisherId(env: NodeJS.ProcessEnv): PublisherId {
  if (env.PUBLISHER_PROVIDER) {
    const r = PublisherIdSchema.safeParse(env.PUBLISHER_PROVIDER.trim().toLowerCase());
    if (!r.success) throw new PublisherError("config", `unknown PUBLISHER_PROVIDER "${env.PUBLISHER_PROVIDER}" (dryrun|postforme|uploadpost|youtube_direct)`);
    return r.data;
  }
  if (env.POSTFORME_API_KEY) return "postforme";
  if (env.UPLOADPOST_API_KEY) return "uploadpost";
  return "dryrun";
}

/** Build a specific adapter from env. Throws PublisherError("config") when its credentials are missing. */
export function getPublisher(id: PublisherId | string, env: NodeJS.ProcessEnv = process.env, opts: CreatePublisherOptions = {}): Publisher {
  const capOverrides = capOverridesFromEnv(env);
  switch (id) {
    case "dryrun": {
      const platformsTarget = env.DRYRUN_PLATFORMS?.split(",").map((s) => s.trim().toUpperCase()).filter(isPlatform);
      return createDryRunPublisher({ platformsTarget, capOverrides, ...opts.dryrun });
    }
    case "postforme":
      return createPostForMePublisher({ apiKey: env.POSTFORME_API_KEY ?? "", baseUrl: env.POSTFORME_BASE_URL, fetch: opts.fetch, capOverrides });
    case "uploadpost":
      return createUploadPostPublisher({
        apiKey: env.UPLOADPOST_API_KEY ?? "", baseUrl: env.UPLOADPOST_BASE_URL, fetch: opts.fetch, capOverrides,
        branding: env.UPLOADPOST_CONNECT_LOGO_URL || env.UPLOADPOST_CONNECT_TITLE ? { logoUrl: env.UPLOADPOST_CONNECT_LOGO_URL, title: env.UPLOADPOST_CONNECT_TITLE } : undefined,
      });
    case "youtube_direct":
      if (!opts.tokenStore) throw new PublisherError("config", "youtube_direct requires a tokenStore (engine supplies SocialAccount.tokens)");
      return createYouTubePublisher({
        clientId: env.YOUTUBE_CLIENT_ID ?? "", clientSecret: env.YOUTUBE_CLIENT_SECRET ?? "", redirectUri: env.YOUTUBE_REDIRECT_URI ?? "",
        tokenStore: opts.tokenStore, fetch: opts.fetch, capOverrides,
      });
    default:
      throw new PublisherError("config", `unknown publisher "${id}"`);
  }
}

/** Default publisher for the engine. `dryrun` unless PUBLISHER_PROVIDER or a provider key is set. */
export function createPublisher(env: NodeJS.ProcessEnv = process.env, opts: CreatePublisherOptions = {}): Publisher {
  return getPublisher(resolvePublisherId(env), env, opts);
}
