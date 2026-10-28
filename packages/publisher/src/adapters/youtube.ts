/**
 * YouTube Data API v3 direct adapter (phase 2, EXPERIMENTAL).
 * Docs: https://developers.google.com/youtube/v3/docs/videos/insert, /guides/using_resumable_upload_protocol,
 *       https://developers.google.com/youtube/analytics/reference/reports/query, https://developers.google.com/identity/protocols/oauth2/web-server
 *
 * Model mapping:
 *  - providerProfileId / providerAccountId = YouTube channel id (UC…). Tokens live in an injected TokenStore keyed by it
 *    (engine backs this with SocialAccount.tokens, encrypted).
 *  - providerJobId = `<channelId>:<videoId>`; externalPostId = videoId.
 *  - Scheduling is native: status.privacyStatus=private + status.publishAt; upload happens immediately.
 */
import { z } from "zod";
import { defaultCaps } from "../caps";
import { errorFromResponse } from "../http";
import { metaFor } from "../meta";
import { fetchWithRetry, type RetryOptions } from "../retry";
import type { AccountCaps, ConnectRequest, ConnectResult, ConnectedAccount, FetchLike, Metrics, MetricsContext, Platform, PublishRequest, PublishResult, PublishStatus, PublishTarget, Publisher } from "../types";
import { PublisherError } from "../types";
import { b64urlDecode, b64urlEncode, num } from "../util";
import { validatePublishRequest } from "../validate";

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const API = "https://www.googleapis.com/youtube/v3";
const UPLOAD = "https://www.googleapis.com/upload/youtube/v3/videos";
const ANALYTICS = "https://youtubeanalytics.googleapis.com/v2/reports";

export interface YouTubeTokens { accessToken: string; refreshToken?: string; expiresAt: number; scope?: string }

export interface TokenStore {
  get(key: string): Promise<YouTubeTokens | null>;
  set(key: string, tokens: YouTubeTokens): Promise<void>;
  delete?(key: string): Promise<void>;
}

export interface YouTubeOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenStore: TokenStore;
  fetch?: FetchLike;
  retry?: RetryOptions;
  now?: () => number;
  capOverrides?: Partial<Record<Platform, number>>;
}

export interface OAuthState { channelId: string; userId: string; returnUrl: string; nonce?: string }

export function buildYouTubeAuthUrl(o: { clientId: string; redirectUri: string; state: OAuthState; loginHint?: string }): string {
  const u = new URL(AUTH_URL);
  u.searchParams.set("client_id", o.clientId);
  u.searchParams.set("redirect_uri", o.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", YOUTUBE_SCOPES.join(" "));
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("include_granted_scopes", "true");
  u.searchParams.set("state", b64urlEncode(JSON.stringify(o.state)));
  if (o.loginHint) u.searchParams.set("login_hint", o.loginHint);
  return u.toString();
}

/** Callers MUST verify the state (e.g. sign it or check nonce) before trusting it. */
export function parseYouTubeState(state: string): OAuthState {
  return JSON.parse(b64urlDecode(state)) as OAuthState;
}

const TokenResp = z.looseObject({ access_token: z.string(), expires_in: z.number(), refresh_token: z.string().optional(), scope: z.string().optional() });

/** Pure: the videos.insert resource for a request. */
export function buildYouTubeVideoResource(req: PublishRequest, nowMs = Date.now()): Record<string, unknown> {
  const m = metaFor("YOUTUBE", req.meta);
  const scheduled = req.scheduledAt && req.scheduledAt.getTime() > nowMs;
  const privacy = m.privacy === "friends" || m.privacy === "followers" ? "unlisted" : m.privacy ?? "public";
  return {
    snippet: {
      title: m.title ?? "Untitled",
      description: m.caption,
      ...(m.tags?.length ? { tags: m.tags } : {}),
      ...(req.meta.categoryId ? { categoryId: req.meta.categoryId } : {}),
    },
    status: {
      privacyStatus: scheduled ? "private" : privacy,
      ...(scheduled ? { publishAt: req.scheduledAt!.toISOString() } : {}),
      selfDeclaredMadeForKids: m.madeForKids ?? false,
      containsSyntheticMedia: m.aiGenerated,
    },
  };
}

export function createYouTubePublisher(opts: YouTubeOptions): Publisher & {
  exchangeCode(code: string): Promise<{ channelId: string; handle?: string; tokens: YouTubeTokens }>;
  getAccessToken(channelId: string): Promise<string>;
} {
  if (!opts.clientId || !opts.clientSecret || !opts.redirectUri) throw new PublisherError("config", "YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET and YOUTUBE_REDIRECT_URI are required for youtube_direct");
  const f: FetchLike = opts.fetch ?? ((i, init) => fetch(i, init));
  const now = opts.now ?? (() => Date.now());

  async function call<T>(url: string | URL, init: RequestInit = {}): Promise<{ data: T; res: Response }> {
    const res = await fetchWithRetry(f, url, init, opts.retry);
    const text = await res.text();
    let data: unknown = text;
    try { data = text ? JSON.parse(text) : null; } catch { /* text */ }
    if (!res.ok) throw errorFromResponse("youtube", res.status, data);
    return { data: data as T, res };
  }

  async function tokenRequest(body: Record<string, string>): Promise<YouTubeTokens> {
    const { data } = await call<unknown>(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: opts.clientId, client_secret: opts.clientSecret, ...body }).toString(),
    });
    const t = TokenResp.parse(data);
    return { accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: now() + t.expires_in * 1000, scope: t.scope };
  }

  async function getAccessToken(channelId: string): Promise<string> {
    const t = await opts.tokenStore.get(channelId);
    if (!t) throw new PublisherError("auth", `no YouTube tokens for channel ${channelId}`);
    if (t.expiresAt - 60_000 > now()) return t.accessToken;
    if (!t.refreshToken) throw new PublisherError("auth", `YouTube token expired and no refresh token for ${channelId}`);
    const fresh = await tokenRequest({ grant_type: "refresh_token", refresh_token: t.refreshToken });
    const merged = { ...fresh, refreshToken: fresh.refreshToken ?? t.refreshToken };
    await opts.tokenStore.set(channelId, merged);
    return merged.accessToken;
  }

  const auth = async (channelId: string) => ({ Authorization: `Bearer ${await getAccessToken(channelId)}` });

  async function myChannels(accessToken: string) {
    const u = new URL(`${API}/channels`);
    u.searchParams.set("part", "snippet");
    u.searchParams.set("mine", "true");
    const { data } = await call<{ items?: Array<{ id: string; snippet?: { title?: string; customUrl?: string; thumbnails?: { default?: { url?: string } } } }> }>(u, { headers: { Authorization: `Bearer ${accessToken}` } });
    return data.items ?? [];
  }

  function splitJob(providerJobId: string) {
    const i = providerJobId.indexOf(":");
    if (i <= 0) throw new PublisherError("validation", `bad youtube job id ${providerJobId}`);
    return { channelId: providerJobId.slice(0, i), videoId: providerJobId.slice(i + 1) };
  }

  return {
    id: "youtube_direct",
    getAccessToken,

    async connect(req: ConnectRequest): Promise<ConnectResult> {
      if (req.platform !== "YOUTUBE") throw new PublisherError("validation", "youtube_direct only connects YOUTUBE");
      return { url: buildYouTubeAuthUrl({ clientId: opts.clientId, redirectUri: opts.redirectUri, state: { channelId: req.channelId, userId: req.userId, returnUrl: req.returnUrl } }) };
    },

    /** OAuth callback: exchange code, resolve the YouTube channel, persist tokens keyed by channel id. */
    async exchangeCode(code: string) {
      const tokens = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: opts.redirectUri });
      const ch = (await myChannels(tokens.accessToken))[0];
      if (!ch) throw new PublisherError("validation", "Google account has no YouTube channel");
      await opts.tokenStore.set(ch.id, tokens);
      return { channelId: ch.id, handle: ch.snippet?.customUrl ?? ch.snippet?.title, tokens };
    },

    async listConnectedAccounts(providerProfileId: string): Promise<ConnectedAccount[]> {
      let token: string;
      try { token = await getAccessToken(providerProfileId); } catch (e) {
        if (e instanceof PublisherError && e.code === "auth") return [{ platform: "YOUTUBE", providerAccountId: providerProfileId, status: "expired" }];
        throw e;
      }
      return (await myChannels(token)).map((c) => ({
        platform: "YOUTUBE" as const,
        providerAccountId: c.id,
        handle: c.snippet?.customUrl ?? c.snippet?.title,
        avatarUrl: c.snippet?.thumbnails?.default?.url,
        status: "connected" as const,
      }));
    },

    async publish(req: PublishRequest): Promise<PublishResult> {
      validatePublishRequest(req);
      if (req.target.platform !== "YOUTUBE") throw new PublisherError("validation", "youtube_direct only publishes to YOUTUBE");
      const channelId = req.target.providerAccountId;
      const headers = await auth(channelId);

      // 1) fetch the master (Shorts are small; buffered). 2) open a resumable session. 3) PUT bytes.
      const media = await fetchWithRetry(f, req.videoUrl, {}, opts.retry);
      if (!media.ok) throw new PublisherError("validation", `could not fetch videoUrl (${media.status})`);
      const bytes = new Uint8Array(await media.arrayBuffer());
      const contentType = media.headers.get("content-type")?.startsWith("video/") ? media.headers.get("content-type")! : "video/mp4";

      const init = new URL(UPLOAD);
      init.searchParams.set("uploadType", "resumable");
      init.searchParams.set("part", "snippet,status");
      const { res: session } = await call<unknown>(init, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": contentType, "X-Upload-Content-Length": String(bytes.byteLength) },
        body: JSON.stringify(buildYouTubeVideoResource(req, now())),
      });
      const location = session.headers.get("location");
      if (!location) throw new PublisherError("provider", "YouTube resumable session returned no Location header");

      const { data: video } = await call<{ id: string; status?: { privacyStatus?: string; publishAt?: string } }>(location, {
        method: "PUT",
        headers: { ...headers, "Content-Type": contentType, "Content-Length": String(bytes.byteLength) },
        body: bytes,
      });
      const scheduled = !!video.status?.publishAt && Date.parse(video.status.publishAt) > now();
      return {
        providerJobId: `${channelId}:${video.id}`,
        externalPostId: video.id,
        externalUrl: `https://www.youtube.com/shorts/${video.id}`,
        status: scheduled ? "scheduled" : "pending", // pending until processing finishes; status() resolves it
      };
    },

    async status(providerJobId: string): Promise<PublishStatus> {
      const { channelId, videoId } = splitJob(providerJobId);
      const u = new URL(`${API}/videos`);
      u.searchParams.set("part", "status,processingDetails");
      u.searchParams.set("id", videoId);
      const { data } = await call<{ items?: Array<{ status?: { uploadStatus?: string; privacyStatus?: string; publishAt?: string; failureReason?: string; rejectionReason?: string } }> }>(u, { headers: await auth(channelId) });
      const s = data.items?.[0]?.status;
      const base = { externalPostId: videoId, externalUrl: `https://www.youtube.com/shorts/${videoId}` };
      if (!s) return { status: "failed", error: "video not found (deleted?)" };
      if (s.uploadStatus === "failed" || s.uploadStatus === "rejected" || s.uploadStatus === "deleted") return { status: "failed", error: s.failureReason ?? s.rejectionReason ?? s.uploadStatus };
      if (s.publishAt && Date.parse(s.publishAt) > now()) return { status: "scheduled", ...base };
      if (s.uploadStatus === "processed") return { status: "published", ...base };
      return { status: "pending", ...base };
    },

    async metrics(externalPostId: string, _platform: Platform, ctx?: MetricsContext): Promise<Metrics | null> {
      const channelId = ctx?.providerAccountId;
      if (!channelId) return null;
      const headers = await auth(channelId);
      const v = new URL(`${API}/videos`);
      v.searchParams.set("part", "statistics,contentDetails");
      v.searchParams.set("id", externalPostId);
      const { data: vd } = await call<{ items?: Array<{ statistics?: Record<string, string> }> }>(v, { headers });
      const st = vd.items?.[0]?.statistics;
      if (!st) return null;

      const start = (ctx?.publishedAt ?? new Date(now() - 30 * 86400_000)).toISOString().slice(0, 10);
      const end = new Date(now()).toISOString().slice(0, 10);
      const q = (params: Record<string, string>) => {
        const u = new URL(ANALYTICS);
        for (const [k, val] of Object.entries({ ids: "channel==MINE", startDate: start, endDate: end, filters: `video==${externalPostId}`, ...params })) u.searchParams.set(k, val);
        return u;
      };
      type Report = { columnHeaders?: Array<{ name: string }>; rows?: Array<Array<number | string>> };
      let avgWatchSec: number | undefined;
      let shares: number | undefined;
      let retention: Metrics["retention"];
      let analyticsRaw: unknown;
      try {
        const { data: summary } = await call<Report>(q({ metrics: "views,averageViewDuration,shares,estimatedMinutesWatched" }), { headers });
        const cols = summary.columnHeaders?.map((c) => c.name) ?? [];
        const row = summary.rows?.[0];
        if (row) {
          avgWatchSec = num(row[cols.indexOf("averageViewDuration")]);
          shares = num(row[cols.indexOf("shares")]);
        }
        const { data: ret } = await call<Report>(q({ metrics: "audienceWatchRatio,relativeRetentionPerformance", dimensions: "elapsedVideoTimeRatio" }), { headers });
        const rc = ret.columnHeaders?.map((c) => c.name) ?? [];
        retention = ret.rows?.map((r) => ({ ratio: Number(r[rc.indexOf("elapsedVideoTimeRatio")]), watch: Number(r[rc.indexOf("audienceWatchRatio")]) }));
        analyticsRaw = { summary, retention: ret };
      } catch (e) {
        // Analytics lags ~24-48h and may 403 without yt-analytics scope; statistics still useful.
        analyticsRaw = { error: (e as Error).message };
      }
      return {
        views: num(st.viewCount) ?? 0,
        likes: num(st.likeCount) ?? 0,
        comments: num(st.commentCount) ?? 0,
        shares: shares ?? 0,
        saves: 0,
        avgWatchSec,
        retention: retention?.length ? retention : undefined,
        raw: { statistics: st, analytics: analyticsRaw },
      };
    },

    async caps(target: PublishTarget): Promise<AccountCaps> {
      // Project-wide bucket; engine must count uploads across ALL channels for the day.
      return defaultCaps(target.platform, opts.capOverrides);
    },

    async disconnect(providerAccountId: string): Promise<void> {
      const t = await opts.tokenStore.get(providerAccountId);
      if (t) {
        const u = new URL(REVOKE_URL);
        u.searchParams.set("token", t.refreshToken ?? t.accessToken);
        await fetchWithRetry(f, u, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } }, opts.retry).catch(() => undefined);
      }
      await opts.tokenStore.delete?.(providerAccountId);
    },

    async cancel(providerJobId: string): Promise<void> {
      const { channelId, videoId } = splitJob(providerJobId);
      const u = new URL(`${API}/videos`);
      u.searchParams.set("id", videoId);
      // UNVERIFIED scope: videos.delete needs `youtube` or `youtube.force-ssl`, which we don't request by default.
      await call(u, { method: "DELETE", headers: await auth(channelId) });
    },
  };
}
