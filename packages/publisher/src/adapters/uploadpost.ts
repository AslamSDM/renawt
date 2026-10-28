/**
 * Upload-Post adapter — https://api.upload-post.com/api
 * Verified 2026-10-28 against https://docs.upload-post.com/openapi.json (linked from https://www.upload-post.com/llms-full.txt).
 * Auth header: `Authorization: Apikey <UPLOADPOST_API_KEY>`.
 *
 * Model mapping:
 *  - providerProfileId = Upload-Post profile `username` (we use `ch_<channelId>`).
 *  - providerAccountId = `<username>:<platformKey>` (Upload-Post posts by user + platform; one account per platform per profile).
 *  - providerJobId     = `req:<request_id>` (async upload), `job:<job_id>` (scheduled), or `sync:<b64 json>` (completed synchronously).
 */
import { z } from "zod";
import { defaultCaps } from "../caps";
import { createHttp, type HttpClient } from "../http";
import { metaFor } from "../meta";
import { PLATFORM_KEY, platformFromKey } from "../platforms";
import type { RetryOptions } from "../retry";
import type { AccountCaps, ConnectRequest, ConnectResult, ConnectedAccount, FetchLike, Metrics, MetricsContext, Platform, PublishRequest, PublishResult, PublishStatus, PublishTarget, Publisher } from "../types";
import { PublisherError } from "../types";
import { b64urlDecode, b64urlEncode, num, pick } from "../util";
import { validatePublishRequest } from "../validate";

export const UPLOADPOST_BASE_URL = "https://api.upload-post.com/api";

export interface UploadPostOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: FetchLike;
  retry?: RetryOptions;
  capOverrides?: Partial<Record<Platform, number>>;
  /** White-label connect page (Pro plan+). */
  branding?: { logoUrl?: string; title?: string; description?: string; buttonText?: string };
}

export function uploadPostUsername(channelId: string): string {
  return `ch_${channelId}`.replace(/[^A-Za-z0-9_-]/g, "_");
}

export function parseUploadPostAccount(providerAccountId: string): { user: string; platformKey: string } {
  const i = providerAccountId.lastIndexOf(":");
  if (i <= 0) throw new PublisherError("validation", `bad upload-post account id ${providerAccountId} (expected <username>:<platform>)`);
  return { user: providerAccountId.slice(0, i), platformKey: providerAccountId.slice(i + 1) };
}

const TIKTOK_PRIVACY: Record<string, string> = {
  public: "PUBLIC_TO_EVERYONE",
  friends: "MUTUAL_FOLLOW_FRIENDS",
  followers: "FOLLOWER_OF_CREATOR",
  private: "SELF_ONLY",
};

/** Pure: multipart form for POST /upload. Exported for tests. */
export function buildUploadPostForm(req: PublishRequest): FormData {
  const { platform } = req.target;
  const { user, platformKey } = parseUploadPostAccount(req.target.providerAccountId);
  const m = metaFor(platform, req.meta);
  const f = new FormData();
  const set = (k: string, v: string | number | boolean | undefined) => { if (v !== undefined && v !== "") f.append(k, String(v)); };

  set("user", user);
  f.append("platform[]", platformKey);
  set("video", req.videoUrl); // public URL accepted in place of a binary
  set("async_upload", true);
  if (req.scheduledAt) set("scheduled_date", req.scheduledAt.toISOString());
  if (m.aiGenerated) set("is_ai_generated", true);

  switch (platform) {
    case "TIKTOK":
      set("title", m.caption);
      set("post_mode", "DIRECT_POST");
      set("privacy_level", m.privacy ? TIKTOK_PRIVACY[m.privacy] : undefined);
      set("disable_comment", req.meta.allowComment === false ? true : undefined);
      set("disable_duet", req.meta.allowDuet === false ? true : undefined);
      set("disable_stitch", req.meta.allowStitch === false ? true : undefined);
      set("brand_organic_toggle", req.meta.commercial ?? false);
      set("brand_content_toggle", req.meta.brandedContent ?? false);
      set("is_aigc", m.aiGenerated);
      break;
    case "YOUTUBE":
      set("title", m.title);
      set("youtube_title", m.title);
      set("youtube_description", m.caption);
      set("privacyStatus", m.privacy === "friends" || m.privacy === "followers" ? "unlisted" : m.privacy ?? "public");
      set("selfDeclaredMadeForKids", m.madeForKids ?? false);
      set("containsSyntheticMedia", m.aiGenerated);
      set("categoryId", req.meta.categoryId);
      // UNVERIFIED: array encoding of `tags` in multipart (spec types it as array; we mirror the `platform[]` convention).
      for (const t of m.tags ?? []) f.append("tags[]", t);
      if (req.meta.coverUrl) set("thumbnail_url", req.meta.coverUrl);
      break;
    case "INSTAGRAM":
      set("title", m.caption);
      set("media_type", "REELS");
      set("share_to_feed", req.meta.shareToFeed ?? true);
      set("cover_url", req.meta.coverUrl);
      break;
    case "FACEBOOK":
      set("title", m.caption);
      set("facebook_media_type", "REELS");
      set("facebook_description", m.caption);
      break;
    case "THREADS":
      set("title", m.caption);
      set("threads_title", m.caption);
      break;
    case "X":
      set("title", m.caption);
      set("x_title", m.caption);
      break;
    case "LINKEDIN":
      set("title", m.title ?? m.caption);
      set("linkedin_description", m.caption);
      set("visibility", "PUBLIC");
      break;
    case "PINTEREST":
      set("title", m.title ?? m.caption);
      set("pinterest_title", m.title);
      set("pinterest_description", m.caption);
      set("pinterest_board_id", req.meta.pinterestBoardId);
      set("pinterest_cover_image_url", req.meta.coverUrl);
      break;
  }
  return f;
}

const StatusResp = z.looseObject({
  status: z.string().nullish(),
  results: z.array(z.looseObject({
    platform: z.string().nullish(),
    success: z.boolean().nullish(),
    message: z.string().nullish(),
    platform_post_id: z.string().nullish(),
    post_url: z.string().nullish(),
  })).nullish(),
});

const UploadResp = z.looseObject({
  success: z.boolean().nullish(),
  request_id: z.string().nullish(),
  job_id: z.string().nullish(),
  results: z.record(z.string(), z.looseObject({ success: z.boolean().nullish(), url: z.string().nullish(), post_id: z.string().nullish(), error: z.string().nullish() })).nullish(),
});

/** Best-effort retention extraction from Upload-Post's free-form metrics (UNVERIFIED key names). */
export function extractRetention(metrics: Record<string, unknown>): Array<{ ratio: number; watch: number }> | undefined {
  const key = Object.keys(metrics).find((k) => /retention/i.test(k) && Array.isArray(metrics[k]));
  if (!key) return undefined;
  const arr = metrics[key] as unknown[];
  if (arr.length < 2) return undefined;
  const vals = arr.map((v) => (typeof v === "object" && v !== null ? Object.values(v as Record<string, unknown>).map(num).filter((x): x is number => x !== undefined).pop() : num(v)));
  if (vals.some((v) => v === undefined)) return undefined;
  const scale = Math.max(...(vals as number[])) > 1.5 ? 100 : 1;
  return (vals as number[]).map((v, i) => ({ ratio: i / (vals.length - 1), watch: v / scale }));
}

export function mapUploadPostMetrics(raw: Record<string, unknown>): Metrics {
  return {
    views: pick(raw, "views", "view_count", "plays", "video_views", "impressions") ?? 0,
    likes: pick(raw, "likes", "like_count", "reactions") ?? 0,
    comments: pick(raw, "comments", "comment_count", "replies") ?? 0,
    shares: pick(raw, "shares", "share_count", "reposts") ?? 0,
    saves: pick(raw, "saves", "saved", "favorites", "save_count") ?? 0,
    avgWatchSec: pick(raw, "average_time_watched", "avg_watch_time", "averageViewDuration"),
    retention: extractRetention(raw),
    raw,
  };
}

export function createUploadPostPublisher(opts: UploadPostOptions): Publisher {
  if (!opts.apiKey) throw new PublisherError("config", "UPLOADPOST_API_KEY is required for the uploadpost publisher");
  const http: HttpClient = createHttp({
    provider: "uploadpost",
    baseUrl: opts.baseUrl ?? UPLOADPOST_BASE_URL,
    headers: { Authorization: `Apikey ${opts.apiKey}` },
    fetch: opts.fetch,
    retry: opts.retry,
  });

  async function ensureProfile(username: string) {
    try {
      await http.request("POST", "/uploadposts/users", { json: { username } });
    } catch (e) {
      if (e instanceof PublisherError && e.status === 409) return; // already exists
      throw e;
    }
  }

  function statusFrom(r: z.infer<typeof StatusResp>, isJob: boolean): PublishStatus {
    const res = r.results?.[0];
    if (r.status === "completed" || (res && res.success !== null && res.success !== undefined)) {
      if (!res) return { status: "failed", error: "no result returned" };
      if (res.success) return { status: "published", externalPostId: res.platform_post_id ?? undefined, externalUrl: res.post_url ?? undefined };
      return { status: "failed", error: res.message ?? "upload failed" };
    }
    if (r.status === "in_progress") return { status: "pending" };
    return { status: isJob ? "scheduled" : "pending" };
  }

  return {
    id: "uploadpost",

    async connect(req: ConnectRequest): Promise<ConnectResult> {
      const username = req.providerProfileId ?? uploadPostUsername(req.channelId);
      await ensureProfile(username);
      const b = opts.branding ?? {};
      const res = z.looseObject({ access_url: z.string() }).parse(
        await http.request("POST", "/uploadposts/users/generate-jwt", {
          json: {
            username,
            redirect_url: req.returnUrl,
            platforms: [PLATFORM_KEY[req.platform]],
            logo_image: b.logoUrl,
            connect_title: b.title,
            connect_description: b.description,
            redirect_button_text: b.buttonText,
          },
        }),
      );
      return { url: res.access_url, providerProfileId: username };
    },

    async listConnectedAccounts(providerProfileId: string): Promise<ConnectedAccount[]> {
      const res = await http.request<{ profile?: { social_accounts?: Record<string, unknown> } } | null>("GET", `/uploadposts/users/${encodeURIComponent(providerProfileId)}`, { allow404: true });
      const accounts = res?.profile?.social_accounts ?? {};
      const out: ConnectedAccount[] = [];
      for (const [key, v] of Object.entries(accounts)) {
        const platform = platformFromKey(key);
        if (!platform || !v) continue; // null / "" = not connected
        const o = typeof v === "object" ? (v as Record<string, unknown>) : {};
        out.push({
          platform,
          providerAccountId: `${providerProfileId}:${key}`,
          handle: (o.handle as string) ?? (o.display_name as string) ?? (typeof v === "string" ? v : undefined),
          avatarUrl: (o.social_images as string) ?? undefined,
          status: o.reauth_required ? "expired" : "connected",
        });
      }
      return out;
    },

    async publish(req: PublishRequest): Promise<PublishResult> {
      validatePublishRequest(req);
      // Upload-Post documents no idempotency key; we still send one (ignored if unsupported) and only retry POST on 429.
      const raw = await http.request("POST", "/upload", { form: buildUploadPostForm(req), headers: { "Idempotency-Key": req.idempotencyKey } });
      const r = UploadResp.parse(raw);
      if (r.job_id) return { providerJobId: `job:${r.job_id}`, status: "scheduled" };
      if (r.request_id) return { providerJobId: `req:${r.request_id}`, status: "pending" };
      const key = parseUploadPostAccount(req.target.providerAccountId).platformKey;
      const res = r.results?.[key];
      if (!res) throw new PublisherError("provider", "upload-post returned neither request_id, job_id nor results", { body: raw });
      const st: PublishStatus = res.success
        ? { status: "published", externalPostId: res.post_id ?? undefined, externalUrl: res.url ?? undefined }
        : { status: "failed", error: res.error ?? "upload failed" };
      return { providerJobId: `sync:${b64urlEncode(JSON.stringify(st))}`, ...st };
    },

    async status(providerJobId: string): Promise<PublishStatus> {
      const [kind, ...rest] = providerJobId.split(":");
      const id = rest.join(":");
      if (kind === "sync") return JSON.parse(b64urlDecode(id)) as PublishStatus;
      if (kind === "req") return statusFrom(StatusResp.parse(await http.request("GET", "/uploadposts/status", { query: { request_id: id } })), false);
      if (kind === "job") {
        const s = await http.request("GET", "/uploadposts/status", { query: { job_id: id }, allow404: true });
        if (s) return statusFrom(StatusResp.parse(s), true);
        // UNVERIFIED: status may 404 before the job runs; fall back to the schedule record.
        const job = await http.request("GET", `/uploadposts/schedule/${encodeURIComponent(id)}`, { allow404: true });
        return job ? { status: "scheduled" } : { status: "failed", error: "scheduled job not found (cancelled?)" };
      }
      throw new PublisherError("validation", `unknown upload-post job id ${providerJobId}`);
    },

    async metrics(externalPostId: string, platform: Platform, ctx?: MetricsContext): Promise<Metrics | null> {
      if (!ctx?.providerAccountId) return null;
      const { user } = parseUploadPostAccount(ctx.providerAccountId);
      const since = ctx.publishedAt ? ctx.publishedAt.toISOString().slice(0, 10) : undefined;
      let cursor: string | undefined;
      type Row = { post_id?: string; date?: string; metrics?: Record<string, unknown> };
      let best: Row | undefined;
      for (let page = 0; page < 5; page++) {
        const r = await http.request<{ posts?: Row[]; next_cursor?: string | null; has_more?: boolean }>("GET", "/uploadposts/post-analytics/cached", {
          query: { user, platform: PLATFORM_KEY[platform], limit: 200, cursor, since },
        });
        for (const row of r.posts ?? []) if (row.post_id === externalPostId && (!best || (row.date ?? "") > (best.date ?? ""))) best = row;
        if (!r.has_more || !r.next_cursor) break;
        cursor = r.next_cursor;
      }
      return best?.metrics ? mapUploadPostMetrics(best.metrics) : null;
    },

    async caps(target: PublishTarget): Promise<AccountCaps> {
      return defaultCaps(target.platform, opts.capOverrides);
    },

    async disconnect(providerAccountId: string): Promise<void> {
      const { user, platformKey } = parseUploadPostAccount(providerAccountId);
      await http.request("DELETE", "/uploadposts/users/social", { json: { profile_username: user, social_platform: platformKey }, allow404: true });
    },

    async cancel(providerJobId: string): Promise<void> {
      const [kind, id] = providerJobId.split(":");
      if (kind !== "job") throw new PublisherError("validation", "only scheduled upload-post jobs can be cancelled");
      await http.request("DELETE", `/uploadposts/schedule/${encodeURIComponent(id)}`, { allow404: true });
    },
  };
}
