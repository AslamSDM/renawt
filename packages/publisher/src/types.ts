import type { Platform as DbPlatform } from "@remawt/db";

/** Platforms the publisher can post to. The DB `Platform` enum also holds radar-only sources (REDDIT, GOOGLE_TRENDS, NEWS). */
export type Platform = Exclude<DbPlatform, "REDDIT" | "GOOGLE_TRENDS" | "NEWS">;


export type Privacy = "public" | "private" | "friends" | "followers" | "unlisted";

export interface ConnectRequest {
  channelId: string;
  userId: string;
  platform: Platform;
  returnUrl: string;
  /** Existing provider profile for this channel (Upload-Post username, dryrun profile). Optional; adapters derive one from channelId. */
  providerProfileId?: string;
}
export interface ConnectResult { url: string; providerProfileId?: string }
export interface PublishTarget { socialAccountId: string; platform: Platform; providerAccountId: string }
export interface PublishMeta {
  title?: string;
  caption?: string;
  hashtags?: string[];
  /** TikTok: MUST be chosen explicitly by the user (audit rule: no default). Adapters reject TikTok posts without it. */
  privacy?: Privacy;
  aiGenerated?: boolean;
  madeForKids?: boolean;
  /** TikTok "Your brand" (brand_organic). */
  commercial?: boolean;
  coverUrl?: string;
  // ── additive (optional) ──
  /** TikTok "Branded content" (paid partnership, brand_content). */
  brandedContent?: boolean;
  /** TikTok interaction toggles. Undefined → provider default (allowed). */
  allowComment?: boolean;
  allowDuet?: boolean;
  allowStitch?: boolean;
  /** Instagram: also show the Reel in the main feed grid. Default true. */
  shareToFeed?: boolean;
  /** YouTube long description; falls back to caption. */
  description?: string;
  /** YouTube tags (not hashtags). */
  tags?: string[];
  /** YouTube category id (e.g. "27" Education). */
  categoryId?: string;
  /** Pinterest board to pin to (required by Pinterest). */
  pinterestBoardId?: string;
}
export interface PublishRequest { publicationId: string; videoUrl: string; target: PublishTarget; scheduledAt?: Date; meta: PublishMeta; idempotencyKey: string }
export interface PublishResult { providerJobId: string; externalPostId?: string; externalUrl?: string; status: "scheduled" | "published" | "pending" | "failed"; error?: string }
export interface PublishStatus { status: "scheduled" | "published" | "pending" | "failed"; externalPostId?: string; externalUrl?: string; error?: string }
export interface Metrics { views: number; likes: number; comments: number; shares: number; saves: number; avgWatchSec?: number; retention?: Array<{ ratio: number; watch: number }>; raw?: unknown }
export interface AccountCaps { dailyLimit: number; remaining?: number; resetAt?: Date }

export interface ConnectedAccount { platform: Platform; providerAccountId: string; handle?: string; avatarUrl?: string; status?: "connected" | "expired" | "error" }

/** Extra context some providers need to read metrics (the provider account the post lives on). */
export interface MetricsContext { providerAccountId?: string; publishedAt?: Date }

/** All providers implement this. Adapters: dryrun (default in dev), postforme, uploadpost, youtube_direct (phase 2). */
export interface Publisher {
  readonly id: string;
  connect(req: ConnectRequest): Promise<ConnectResult>;
  listConnectedAccounts(providerProfileId: string): Promise<ConnectedAccount[]>;
  publish(req: PublishRequest): Promise<PublishResult>;
  status(providerJobId: string): Promise<PublishStatus>;
  metrics(externalPostId: string, platform: Platform, ctx?: MetricsContext): Promise<Metrics | null>;
  caps(target: PublishTarget): Promise<AccountCaps>;
  disconnect(providerAccountId: string): Promise<void>;
  /** Cancel a scheduled post / delete a post at the provider (optional). */
  cancel?(providerJobId: string): Promise<void>;
}

export type PublisherErrorCode = "config" | "validation" | "auth" | "not_found" | "rate_limited" | "provider" | "network";

export class PublisherError extends Error {
  readonly code: PublisherErrorCode;
  readonly status?: number;
  readonly retryable: boolean;
  readonly body?: unknown;
  constructor(code: PublisherErrorCode, message: string, opts: { status?: number; retryable?: boolean; body?: unknown } = {}) {
    super(message);
    this.name = "PublisherError";
    this.code = code;
    this.status = opts.status;
    this.retryable = opts.retryable ?? (code === "rate_limited" || code === "network");
    this.body = opts.body;
  }
}

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
