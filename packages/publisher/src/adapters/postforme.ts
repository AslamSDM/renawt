/**
 * Post for Me adapter — https://api.postforme.dev
 * Verified 2026-10-28 against the OpenAPI 3.0 spec embedded in https://api.postforme.dev/docs
 * (paths: /v1/social-accounts/auth-url, /v1/social-accounts, /v1/social-accounts/{id}/disconnect,
 *  /v1/social-posts, /v1/social-posts/{id}, /v1/social-post-results, /v1/social-account-feeds/{id}).
 *
 * Model mapping:
 *  - providerProfileId = our channelId, stored as the social account `external_id` at connect time.
 *  - providerAccountId = Post for Me social account id (`spc_…`).
 *  - providerJobId     = Post for Me social post id (`sp_…`). One post per target.
 *  - idempotency       = post `external_id` = idempotencyKey; we look it up before creating.
 */
import { z } from "zod";
import { defaultCaps } from "../caps";
import { createHttp, type HttpClient } from "../http";
import { metaFor } from "../meta";
import { PLATFORM_KEY, platformFromKey } from "../platforms";
import type { RetryOptions } from "../retry";
import type { AccountCaps, ConnectRequest, ConnectResult, ConnectedAccount, FetchLike, Metrics, MetricsContext, Platform, PublishRequest, PublishResult, PublishStatus, PublishTarget, Publisher } from "../types";
import { PublisherError } from "../types";
import { pick } from "../util";
import { validatePublishRequest } from "../validate";

export const POSTFORME_BASE_URL = "https://api.postforme.dev";

export interface PostForMeOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: FetchLike;
  retry?: RetryOptions;
  capOverrides?: Partial<Record<Platform, number>>;
}

const Account = z.looseObject({
  id: z.string(),
  platform: z.string(),
  username: z.string().nullish(),
  profile_photo_url: z.string().nullish(),
  status: z.string().nullish(),
  external_id: z.string().nullish(),
});
const Page = <T extends z.ZodType>(item: T) => z.looseObject({ data: z.array(item), meta: z.looseObject({ next: z.string().nullish() }).optional() });
const Post = z.looseObject({ id: z.string(), status: z.string(), scheduled_at: z.string().nullish(), external_id: z.string().nullish() });
const PostResult = z.looseObject({
  id: z.string(),
  post_id: z.string(),
  social_account_id: z.string().nullish(),
  success: z.boolean().nullish(),
  error: z.unknown().optional(),
  platform_data: z.looseObject({ id: z.string().nullish(), url: z.string().nullish() }).nullish(),
});
const FeedPost = z.looseObject({
  platform_post_id: z.string().nullish(),
  platform_url: z.string().nullish(),
  metrics: z.record(z.string(), z.unknown()).nullish(),
});

/** TikTok/YouTube privacy in Post for Me vocabulary. */
function pfmPrivacy(platform: Platform, p: PublishRequest["meta"]["privacy"]): string | undefined {
  if (!p) return undefined;
  if (platform === "YOUTUBE") return p === "friends" || p === "followers" ? "unlisted" : p;
  if (platform === "TIKTOK") return p === "unlisted" ? undefined : p;
  return undefined;
}

/** Pure: build the POST /v1/social-posts body. Exported for tests and engine previews. */
export function buildPostForMeBody(req: PublishRequest): Record<string, unknown> {
  const { platform } = req.target;
  const m = metaFor(platform, req.meta);
  const key = PLATFORM_KEY[platform];
  const media: Record<string, unknown> = { url: req.videoUrl };
  if (req.meta.coverUrl) media.thumbnail_url = req.meta.coverUrl;

  let config: Record<string, unknown> = {};
  switch (platform) {
    case "TIKTOK":
      config = {
        privacy_status: pfmPrivacy(platform, m.privacy),
        allow_comment: req.meta.allowComment,
        allow_duet: req.meta.allowDuet,
        allow_stitch: req.meta.allowStitch,
        disclose_your_brand: req.meta.commercial ?? false,
        disclose_branded_content: req.meta.brandedContent ?? false,
        is_ai_generated: m.aiGenerated,
      };
      break;
    case "YOUTUBE":
      // Post for Me uploads at top-level scheduled_at, so we don't also use YouTube's native publish_at
      // (a publish_at in the past at upload time fails with invalidPublishAt). Native scheduling lives in youtube_direct.
      config = {
        title: m.title,
        description: m.caption,
        tags: m.tags?.length ? m.tags : undefined,
        category_id: req.meta.categoryId,
        privacy_status: pfmPrivacy(platform, m.privacy) ?? "public",
        made_for_kids: m.madeForKids ?? false,
        contains_synthetic_media: m.aiGenerated,
      };
      break;
    case "INSTAGRAM":
      config = { placement: "reels", share_to_feed: req.meta.shareToFeed ?? true };
      break;
    case "FACEBOOK":
      config = { placement: "reels" };
      break;
    case "THREADS":
      config = { placement: "reels" };
      break;
    case "PINTEREST":
      config = { title: m.title, board_ids: req.meta.pinterestBoardId ? [req.meta.pinterestBoardId] : undefined };
      break;
    case "LINKEDIN":
      config = { title: m.title };
      break;
    case "X":
      config = {};
      break;
  }
  const clean = Object.fromEntries(Object.entries(config).filter(([, v]) => v !== undefined));
  return {
    caption: m.caption,
    social_accounts: [req.target.providerAccountId],
    media: [media],
    platform_configurations: { [key]: clean },
    external_id: req.idempotencyKey,
    ...(req.scheduledAt ? { scheduled_at: req.scheduledAt.toISOString() } : {}),
  };
}

export function mapPostForMeMetrics(raw: Record<string, unknown>): Metrics {
  const igAvgMs = pick(raw, "ig_reels_avg_watch_time");
  const fbAvgMs = pick(raw, "post_video_avg_time_watched");
  return {
    views: pick(raw, "views", "view_count", "video_views", "impression_count", "blue_reels_play_count") ?? 0,
    likes: pick(raw, "likes", "like_count", "reactions", "favorite_count") ?? 0,
    comments: pick(raw, "comments", "comment_count", "replies", "reply_count") ?? 0,
    shares: pick(raw, "shares", "share_count", "reposts", "retweet_count") ?? 0,
    saves: pick(raw, "saved", "saves", "save_count", "bookmark_count") ?? 0,
    avgWatchSec: igAvgMs !== undefined ? igAvgMs / 1000 : fbAvgMs !== undefined ? fbAvgMs / 1000 : pick(raw, "averageViewDuration", "average_time_watched"),
    raw,
  };
}

export function createPostForMePublisher(opts: PostForMeOptions): Publisher {
  if (!opts.apiKey) throw new PublisherError("config", "POSTFORME_API_KEY is required for the postforme publisher");
  const http: HttpClient = createHttp({
    provider: "postforme",
    baseUrl: opts.baseUrl ?? POSTFORME_BASE_URL,
    headers: { Authorization: `Bearer ${opts.apiKey}` },
    fetch: opts.fetch,
    retry: opts.retry,
  });

  return {
    id: "postforme",

    async connect(req: ConnectRequest): Promise<ConnectResult> {
      const profile = req.providerProfileId ?? req.channelId;
      const res = z.looseObject({ url: z.string() }).parse(
        await http.request("POST", "/v1/social-accounts/auth-url", {
          json: { platform: PLATFORM_KEY[req.platform], external_id: profile, redirect_url_override: req.returnUrl },
        }),
      );
      return { url: res.url, providerProfileId: profile };
    },

    async listConnectedAccounts(providerProfileId: string): Promise<ConnectedAccount[]> {
      const out: ConnectedAccount[] = [];
      for (let offset = 0; offset < 1000; offset += 100) {
        const page = Page(Account).parse(
          await http.request("GET", "/v1/social-accounts", { query: { external_id: providerProfileId, status: "connected", limit: 100, offset } }),
        );
        for (const a of page.data) {
          const platform = platformFromKey(a.platform);
          if (!platform) continue;
          out.push({ platform, providerAccountId: a.id, handle: a.username ?? undefined, avatarUrl: a.profile_photo_url ?? undefined, status: a.status === "disconnected" ? "expired" : "connected" });
        }
        if (page.data.length < 100 || !page.meta?.next) break;
      }
      return out;
    },

    async publish(req: PublishRequest): Promise<PublishResult> {
      validatePublishRequest(req);
      // Idempotency: reuse a post created earlier with the same external_id.
      const existing = Page(Post).parse(await http.request("GET", "/v1/social-posts", { query: { external_id: req.idempotencyKey, limit: 1 } }));
      const post = existing.data[0] ?? Post.parse(await http.request("POST", "/v1/social-posts", { json: buildPostForMeBody(req), idempotencyKey: req.idempotencyKey }));
      if (post.status === "scheduled") return { providerJobId: post.id, status: "scheduled" };
      return { providerJobId: post.id, status: "pending" };
    },

    async status(providerJobId: string): Promise<PublishStatus> {
      const post = await http.request("GET", `/v1/social-posts/${encodeURIComponent(providerJobId)}`, { allow404: true });
      if (!post) return { status: "failed", error: "post not found at Post for Me" };
      const p = Post.parse(post);
      if (p.status === "scheduled") return { status: "scheduled" };
      if (p.status === "draft") return { status: "pending" };
      const results = Page(PostResult).parse(await http.request("GET", "/v1/social-post-results", { query: { post_id: providerJobId, limit: 10 } }));
      const r = results.data[0];
      if (!r) return { status: "pending" };
      if (r.success === false) return { status: "failed", error: typeof r.error === "string" ? r.error : JSON.stringify(r.error ?? "unknown error") };
      if (r.success) return { status: "published", externalPostId: r.platform_data?.id ?? undefined, externalUrl: r.platform_data?.url ?? undefined };
      return { status: "pending" };
    },

    async metrics(externalPostId: string, _platform: Platform, ctx?: MetricsContext): Promise<Metrics | null> {
      if (!ctx?.providerAccountId) return null; // feed endpoint is per social account
      const page = Page(FeedPost).parse(
        await http.request("GET", `/v1/social-account-feeds/${encodeURIComponent(ctx.providerAccountId)}`, {
          query: { platform_post_id: externalPostId, expand: ["metrics"], limit: 1 },
        }),
      );
      const m = page.data[0]?.metrics;
      return m ? mapPostForMeMetrics(m) : null;
    },

    async caps(target: PublishTarget): Promise<AccountCaps> {
      return defaultCaps(target.platform, opts.capOverrides);
    },

    async disconnect(providerAccountId: string): Promise<void> {
      await http.request("POST", `/v1/social-accounts/${encodeURIComponent(providerAccountId)}/disconnect`, { allow404: true });
    },

    async cancel(providerJobId: string): Promise<void> {
      // Deletes the post; for scheduled posts this cancels it. Deleting an already-published post does not remove it from the platform (UNVERIFIED).
      await http.request("DELETE", `/v1/social-posts/${encodeURIComponent(providerJobId)}`, { allow404: true });
    },
  };
}

