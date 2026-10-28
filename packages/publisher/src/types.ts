import type { Platform } from "@remawt/db";

export interface ConnectRequest { channelId: string; userId: string; platform: Platform; returnUrl: string }
export interface ConnectResult { url: string; providerProfileId?: string }
export interface PublishTarget { socialAccountId: string; platform: Platform; providerAccountId: string }
export interface PublishMeta { title?: string; caption?: string; hashtags?: string[]; privacy?: "public" | "private" | "friends"; aiGenerated?: boolean; madeForKids?: boolean; commercial?: boolean; coverUrl?: string }
export interface PublishRequest { publicationId: string; videoUrl: string; target: PublishTarget; scheduledAt?: Date; meta: PublishMeta; idempotencyKey: string }
export interface PublishResult { providerJobId: string; externalPostId?: string; externalUrl?: string; status: "scheduled" | "published" | "pending" | "failed"; error?: string }
export interface PublishStatus { status: "scheduled" | "published" | "pending" | "failed"; externalPostId?: string; externalUrl?: string; error?: string }
export interface Metrics { views: number; likes: number; comments: number; shares: number; saves: number; avgWatchSec?: number; retention?: Array<{ ratio: number; watch: number }>; raw?: unknown }
export interface AccountCaps { dailyLimit: number; remaining?: number; resetAt?: Date }

/** All providers implement this. Adapters: dryrun (default in dev), postforme, uploadpost, youtube_direct (phase 2). */
export interface Publisher {
  readonly id: string;
  connect(req: ConnectRequest): Promise<ConnectResult>;
  listConnectedAccounts(providerProfileId: string): Promise<Array<{ platform: Platform; providerAccountId: string; handle?: string; avatarUrl?: string }>>;
  publish(req: PublishRequest): Promise<PublishResult>;
  status(providerJobId: string): Promise<PublishStatus>;
  metrics(externalPostId: string, platform: Platform): Promise<Metrics | null>;
  caps(target: PublishTarget): Promise<AccountCaps>;
  disconnect(providerAccountId: string): Promise<void>;
}
