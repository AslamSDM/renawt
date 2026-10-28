import { basicAuth, requestJson } from "../http";
import type { NicheInput, RawTrendItem, RadarEnv, SourceContext } from "../types";

/**
 * Reddit: public JSON listings by default; OAuth (client_credentials, app-only) when
 * REDDIT_CLIENT_ID/SECRET are set — higher limits (100 QPM). Commercial use of the Data
 * API needs Reddit's approval; keep volume low. Reddit has no public view counts, so
 * `views` = post score (upvotes) — scoring is per-platform so the scales never mix.
 */
export const REDDIT_USER_AGENT = "web:remawt-radar:2.0 (by /u/remawt)";

interface RedditPost { data?: { name?: string; id?: string; title?: string; selftext?: string; author?: string; score?: number; ups?: number; num_comments?: number; created_utc?: number; permalink?: string; url?: string; over_18?: boolean; stickied?: boolean; thumbnail?: string; subreddit?: string; is_video?: boolean } }

export function parseRedditListing(json: unknown, opts: { sourceId?: string; query?: string } = {}): RawTrendItem[] {
  const children = ((json as { data?: { children?: RedditPost[] } })?.data?.children ?? []) as RedditPost[];
  const out: RawTrendItem[] = [];
  for (const c of children) {
    const d = c.data;
    if (!d?.title || !d.permalink || d.over_18 || d.stickied) continue;
    out.push({
      platform: "REDDIT",
      kind: "signal",
      url: `https://www.reddit.com${d.permalink}`,
      externalId: d.name ?? d.id,
      title: d.title,
      caption: d.selftext ? d.selftext.slice(0, 500) : undefined,
      creator: d.author,
      views: Number(d.score ?? d.ups ?? 0),
      comments: d.num_comments,
      publishedAt: d.created_utc ? new Date(d.created_utc * 1000) : undefined,
      thumbnailUrl: d.thumbnail && /^https?:/.test(d.thumbnail) ? d.thumbnail : undefined,
      sourceId: opts.sourceId ?? "reddit",
      query: opts.query ?? (d.subreddit ? `r/${d.subreddit}` : undefined),
    });
  }
  return out;
}

export function redditConfigured(_env: RadarEnv): boolean { return true; } // public JSON needs no key

let tokenCache: { token: string; expiresAt: number; clientId: string } | undefined;

async function redditToken(env: RadarEnv, f?: typeof fetch): Promise<string | undefined> {
  const id = env.REDDIT_CLIENT_ID, secret = env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return undefined;
  if (tokenCache && tokenCache.clientId === id && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;
  const json = await requestJson<{ access_token?: string; expires_in?: number }>("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    fetch: f,
    headers: { authorization: basicAuth(id, secret), "content-type": "application/x-www-form-urlencoded", "user-agent": REDDIT_USER_AGENT },
    body: "grant_type=client_credentials",
  });
  if (!json.access_token) return undefined;
  tokenCache = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000, clientId: id };
  return json.access_token;
}

export async function redditTrends(niche: NicheInput, ctx: SourceContext = {}, opts: { limit?: number } = {}): Promise<RawTrendItem[]> {
  const env = ctx.env ?? process.env;
  const token = await redditToken(env, ctx.fetch).catch(() => undefined);
  const base = token ? "https://oauth.reddit.com" : "https://www.reddit.com";
  const headers: Record<string, string> = { "user-agent": REDDIT_USER_AGENT };
  if (token) headers.authorization = `Bearer ${token}`;
  const limit = opts.limit ?? 25;
  const out: RawTrendItem[] = [];
  for (const sub of niche.subreddits) {
    for (const [listing, sourceId] of [[`rising${token ? "" : ".json"}?limit=${limit}`, "reddit-rising"], [`top${token ? "" : ".json"}?t=week&limit=${limit}`, "reddit-top-week"]] as const) {
      try {
        const json = await requestJson(`${base}/r/${encodeURIComponent(sub)}/${listing}`, { headers, fetch: ctx.fetch });
        out.push(...parseRedditListing(json, { sourceId, query: `r/${sub}` }));
      } catch {
        // private/banned/rate-limited subreddit — skip
      }
    }
  }
  return out;
}
