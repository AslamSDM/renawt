import { test } from "node:test";
import assert from "node:assert/strict";
import { createPostForMePublisher } from "../adapters/postforme";
import { createUploadPostPublisher } from "../adapters/uploadpost";
import { createYouTubePublisher, type YouTubeTokens } from "../adapters/youtube";
import { fetchWithRetry } from "../retry";
import type { PublishRequest } from "../types";
import { mockFetch, noSleep } from "./helpers";

const base = (platform: PublishRequest["target"]["platform"], providerAccountId: string, over: Partial<PublishRequest> = {}): PublishRequest => ({
  publicationId: "pub_1",
  videoUrl: "https://cdn.example.com/master.mp4",
  target: { socialAccountId: "sa_1", platform, providerAccountId },
  meta: { title: "Why octopuses have 3 hearts", caption: "Biology in 60s", hashtags: ["science", "octopus"], privacy: "public", aiGenerated: true, commercial: false },
  idempotencyKey: "vid_1:publish:hash1",
  ...over,
});

// ───────────── Post for Me ─────────────

test("postforme: connect builds auth-url with external_id=channel", async () => {
  const m = mockFetch({ "POST /v1/social-accounts/auth-url": () => ({ json: { url: "https://auth.example/x", platform: "tiktok" } }) });
  const p = createPostForMePublisher({ apiKey: "pk", fetch: m.fetch, retry: noSleep });
  const r = await p.connect({ channelId: "ch_9", userId: "u", platform: "TIKTOK", returnUrl: "https://app/cb" });
  assert.equal(r.url, "https://auth.example/x");
  assert.equal(m.calls[0].url.toString(), "https://api.postforme.dev/v1/social-accounts/auth-url");
  assert.equal(m.calls[0].headers.get("authorization"), "Bearer pk");
  assert.deepEqual(m.calls[0].body, { platform: "tiktok", external_id: "ch_9", redirect_url_override: "https://app/cb" });
});

test("postforme: list accounts filters by external_id and maps platforms", async () => {
  const m = mockFetch({ "GET /v1/social-accounts": () => ({ json: { data: [
    { id: "spc_1", platform: "tiktok_business", username: "nerdfacts", profile_photo_url: "https://a/1.png", status: "connected", external_id: "ch_9" },
    { id: "spc_2", platform: "bluesky", username: "x", status: "connected" },
  ], meta: { next: null } } }) });
  const p = createPostForMePublisher({ apiKey: "pk", fetch: m.fetch });
  const a = await p.listConnectedAccounts("ch_9");
  assert.deepEqual(a, [{ platform: "TIKTOK", providerAccountId: "spc_1", handle: "nerdfacts", avatarUrl: "https://a/1.png", status: "connected" }]);
  assert.equal(m.calls[0].url.searchParams.get("external_id"), "ch_9");
  assert.equal(m.calls[0].url.searchParams.get("status"), "connected");
});

test("postforme: publish TikTok scheduled — body shape + idempotency lookup", async () => {
  const m = mockFetch({
    "GET /v1/social-posts": () => ({ json: { data: [], meta: {} } }),
    "POST /v1/social-posts": () => ({ status: 201, json: { id: "sp_1", status: "scheduled", scheduled_at: "2026-11-01T18:00:00Z" } }),
  });
  const p = createPostForMePublisher({ apiKey: "pk", fetch: m.fetch });
  const scheduledAt = new Date("2026-11-01T18:00:00Z");
  const r = await p.publish(base("TIKTOK", "spc_1", { scheduledAt }));
  assert.deepEqual(r, { providerJobId: "sp_1", status: "scheduled" });
  assert.equal(m.calls[0].url.searchParams.get("external_id"), "vid_1:publish:hash1");
  const post = m.calls[1];
  assert.equal(post.method, "POST");
  assert.equal(post.url.pathname, "/v1/social-posts");
  assert.equal(post.headers.get("idempotency-key"), "vid_1:publish:hash1");
  assert.deepEqual(post.body, {
    caption: "Biology in 60s\n\n#science #octopus",
    social_accounts: ["spc_1"],
    media: [{ url: "https://cdn.example.com/master.mp4" }],
    platform_configurations: { tiktok: { privacy_status: "public", disclose_your_brand: false, disclose_branded_content: false, is_ai_generated: true } },
    external_id: "vid_1:publish:hash1",
    scheduled_at: "2026-11-01T18:00:00.000Z",
  });
});

test("postforme: publish reuses existing post with same external_id", async () => {
  const m = mockFetch({ "GET /v1/social-posts": () => ({ json: { data: [{ id: "sp_old", status: "processed" }] } }) });
  const p = createPostForMePublisher({ apiKey: "pk", fetch: m.fetch });
  const r = await p.publish(base("INSTAGRAM", "spc_ig"));
  assert.equal(r.providerJobId, "sp_old");
  assert.equal(m.calls.length, 1);
});

test("postforme: YouTube + Instagram platform configs", async () => {
  const bodies: unknown[] = [];
  const m = mockFetch({
    "GET /v1/social-posts": () => ({ json: { data: [] } }),
    "POST /v1/social-posts": (c) => { bodies.push(c.body); return { json: { id: "sp_2", status: "processing" } }; },
  });
  const p = createPostForMePublisher({ apiKey: "pk", fetch: m.fetch });
  await p.publish(base("YOUTUBE", "spc_yt", { meta: { ...base("YOUTUBE", "").meta, madeForKids: false, privacy: "unlisted" } }));
  await p.publish(base("INSTAGRAM", "spc_ig", { idempotencyKey: "k2" }));
  const yt = (bodies[0] as { platform_configurations: { youtube: Record<string, unknown> } }).platform_configurations.youtube;
  assert.equal(yt.title, "Why octopuses have 3 hearts");
  assert.equal(yt.privacy_status, "unlisted");
  assert.equal(yt.made_for_kids, false);
  assert.equal(yt.contains_synthetic_media, true);
  assert.deepEqual(yt.tags, ["science", "octopus"]);
  const ig = (bodies[1] as { platform_configurations: { instagram: Record<string, unknown> } }).platform_configurations.instagram;
  assert.deepEqual(ig, { placement: "reels", share_to_feed: true });
});

test("postforme: status → scheduled / published / failed", async () => {
  let postStatus = "scheduled";
  let result: unknown = null;
  const m = mockFetch({
    "GET /v1/social-posts/sp_1": () => ({ json: { id: "sp_1", status: postStatus } }),
    "GET /v1/social-post-results": () => ({ json: { data: result ? [result] : [] } }),
  });
  const p = createPostForMePublisher({ apiKey: "pk", fetch: m.fetch });
  assert.deepEqual(await p.status("sp_1"), { status: "scheduled" });
  postStatus = "processed";
  result = { id: "spr_1", post_id: "sp_1", success: true, platform_data: { id: "7300", url: "https://tiktok.com/@a/video/7300" } };
  assert.deepEqual(await p.status("sp_1"), { status: "published", externalPostId: "7300", externalUrl: "https://tiktok.com/@a/video/7300" });
  assert.equal(m.calls.at(-1)!.url.searchParams.get("post_id"), "sp_1");
  result = { id: "spr_1", post_id: "sp_1", success: false, error: "token expired" };
  assert.deepEqual(await p.status("sp_1"), { status: "failed", error: "token expired" });
});

test("postforme: metrics via account feed with expand=metrics", async () => {
  const m = mockFetch({ "GET /v1/social-account-feeds/spc_1": () => ({ json: { data: [{ platform_post_id: "7300", metrics: { view_count: 1200, like_count: 80, comment_count: 4, share_count: 9 } }] } }) });
  const p = createPostForMePublisher({ apiKey: "pk", fetch: m.fetch });
  const met = await p.metrics("7300", "TIKTOK", { providerAccountId: "spc_1" });
  assert.equal(met?.views, 1200);
  assert.equal(met?.likes, 80);
  assert.equal(m.calls[0].url.searchParams.get("expand"), "metrics");
  assert.equal(m.calls[0].url.searchParams.get("platform_post_id"), "7300");
  assert.equal(await p.metrics("7300", "TIKTOK"), null);
});

// ───────────── Upload-Post ─────────────

test("uploadpost: connect creates profile (409 ok) + generate-jwt", async () => {
  const m = mockFetch({
    "POST /api/uploadposts/users": () => ({ status: 409, json: { success: false, message: "exists" } }),
    "POST /api/uploadposts/users/generate-jwt": () => ({ json: { success: true, access_url: "https://connect.upload-post.com/?t=jwt", duration: "48h" } }),
  });
  const p = createUploadPostPublisher({ apiKey: "uk", fetch: m.fetch });
  const r = await p.connect({ channelId: "ch_9", userId: "u", platform: "INSTAGRAM", returnUrl: "https://app/cb" });
  assert.deepEqual(r, { url: "https://connect.upload-post.com/?t=jwt", providerProfileId: "ch_ch_9" });
  assert.equal(m.calls[0].headers.get("authorization"), "Apikey uk");
  assert.deepEqual(m.calls[0].body, { username: "ch_ch_9" });
  assert.equal(m.calls[1].url.toString(), "https://api.upload-post.com/api/uploadposts/users/generate-jwt");
  assert.deepEqual(m.calls[1].body, { username: "ch_ch_9", redirect_url: "https://app/cb", platforms: ["instagram"] });
});

test("uploadpost: list accounts from profile.social_accounts", async () => {
  const m = mockFetch({ "GET /api/uploadposts/users/ch_ch_9": () => ({ json: { success: true, profile: { username: "ch_ch_9", social_accounts: {
    tiktok: { handle: "nerdfacts", social_images: "https://img/t.png" }, youtube: { display_name: "Nerd Facts", reauth_required: true }, instagram: "", facebook: null,
  } } } }) });
  const p = createUploadPostPublisher({ apiKey: "uk", fetch: m.fetch });
  assert.deepEqual(await p.listConnectedAccounts("ch_ch_9"), [
    { platform: "TIKTOK", providerAccountId: "ch_ch_9:tiktok", handle: "nerdfacts", avatarUrl: "https://img/t.png", status: "connected" },
    { platform: "YOUTUBE", providerAccountId: "ch_ch_9:youtube", handle: "Nerd Facts", avatarUrl: undefined, status: "expired" },
  ]);
});

test("uploadpost: publish TikTok scheduled — multipart fields", async () => {
  const m = mockFetch({ "POST /api/upload": () => ({ status: 202, json: { success: true, job_id: "job_42", scheduled_date: "2026-11-01T18:00:00Z" } }) });
  const p = createUploadPostPublisher({ apiKey: "uk", fetch: m.fetch });
  const r = await p.publish(base("TIKTOK", "ch_ch_9:tiktok", { scheduledAt: new Date("2026-11-01T18:00:00Z"), meta: { ...base("TIKTOK", "").meta, privacy: "friends", allowDuet: false } }));
  assert.deepEqual(r, { providerJobId: "job:job_42", status: "scheduled" });
  const c = m.calls[0];
  assert.equal(c.method, "POST");
  assert.equal(c.url.toString(), "https://api.upload-post.com/api/upload");
  const f = c.body as FormData;
  assert.ok(f instanceof FormData);
  assert.equal(f.get("user"), "ch_ch_9");
  assert.deepEqual(f.getAll("platform[]"), ["tiktok"]);
  assert.equal(f.get("video"), "https://cdn.example.com/master.mp4");
  assert.equal(f.get("scheduled_date"), "2026-11-01T18:00:00.000Z");
  assert.equal(f.get("privacy_level"), "MUTUAL_FOLLOW_FRIENDS");
  assert.equal(f.get("disable_duet"), "true");
  assert.equal(f.get("disable_comment"), null);
  assert.equal(f.get("is_aigc"), "true");
  assert.equal(f.get("brand_organic_toggle"), "false");
  assert.equal(f.get("brand_content_toggle"), "false");
  assert.equal(f.get("post_mode"), "DIRECT_POST");
  assert.equal(f.get("title"), "Biology in 60s\n\n#science #octopus");
});

test("uploadpost: publish YouTube + IG fields; async request id", async () => {
  const forms: FormData[] = [];
  const m = mockFetch({ "POST /api/upload": (c) => { forms.push(c.body as FormData); return { json: { success: true, request_id: "req_7", total_platforms: 1 } }; } });
  const p = createUploadPostPublisher({ apiKey: "uk", fetch: m.fetch });
  const r = await p.publish(base("YOUTUBE", "ch_ch_9:youtube"));
  assert.deepEqual(r, { providerJobId: "req:req_7", status: "pending" });
  await p.publish(base("INSTAGRAM", "ch_ch_9:instagram"));
  const [yt, ig] = forms;
  assert.equal(yt.get("youtube_title"), "Why octopuses have 3 hearts");
  assert.equal(yt.get("privacyStatus"), "public");
  assert.equal(yt.get("selfDeclaredMadeForKids"), "false");
  assert.equal(yt.get("containsSyntheticMedia"), "true");
  assert.deepEqual(yt.getAll("tags[]"), ["science", "octopus"]);
  assert.equal(ig.get("media_type"), "REELS");
  assert.equal(ig.get("share_to_feed"), "true");
});

test("uploadpost: status for request / job, cancel, metrics", async () => {
  let state: Record<string, unknown> = { status: "pending", results: [] };
  const m = mockFetch({
    "GET /api/uploadposts/status": () => ({ json: state }),
    "DELETE /api/uploadposts/schedule/job_42": () => ({ json: { success: true } }),
    "GET /api/uploadposts/post-analytics/cached": () => ({ json: { success: true, posts: [
      { post_id: "7300", date: "2026-10-29", metrics: { views: 50, likes: 2 } },
      { post_id: "7300", date: "2026-10-30", metrics: { views: 900, likes: 40, comments: 3, shares: 5, favorites: 7, average_time_watched: 11.5, video_view_retention: [100, 70, 40] } },
    ], has_more: false } }),
  });
  const p = createUploadPostPublisher({ apiKey: "uk", fetch: m.fetch });
  assert.deepEqual(await p.status("req:req_7"), { status: "pending" });
  assert.equal(m.calls[0].url.searchParams.get("request_id"), "req_7");
  assert.deepEqual(await p.status("job:job_42"), { status: "scheduled" });
  assert.equal(m.calls[1].url.searchParams.get("job_id"), "job_42");
  state = { status: "completed", results: [{ platform: "tiktok", success: true, platform_post_id: "7300", post_url: "https://tiktok.com/v/7300" }] };
  assert.deepEqual(await p.status("req:req_7"), { status: "published", externalPostId: "7300", externalUrl: "https://tiktok.com/v/7300" });
  state = { status: "completed", results: [{ platform: "tiktok", success: false, message: "spam" }] };
  assert.deepEqual(await p.status("req:req_7"), { status: "failed", error: "spam" });

  await p.cancel!("job:job_42");
  assert.equal(m.calls.at(-1)!.method, "DELETE");

  const met = await p.metrics("7300", "TIKTOK", { providerAccountId: "ch_ch_9:tiktok" });
  assert.equal(met?.views, 900);
  assert.equal(met?.saves, 7);
  assert.equal(met?.avgWatchSec, 11.5);
  assert.deepEqual(met?.retention, [{ ratio: 0, watch: 1 }, { ratio: 0.5, watch: 0.7 }, { ratio: 1, watch: 0.4 }]);
  const q = m.calls.at(-1)!.url.searchParams;
  assert.equal(q.get("user"), "ch_ch_9");
  assert.equal(q.get("platform"), "tiktok");
});

// ───────────── YouTube direct ─────────────

test("youtube: resumable upload with native scheduling + status", async () => {
  const store = new Map<string, YouTubeTokens>([["UC1", { accessToken: "old", refreshToken: "rt", expiresAt: 0 }]]);
  const now = Date.parse("2026-10-28T12:00:00Z");
  const m = mockFetch({
    "POST /token": () => ({ json: { access_token: "fresh", expires_in: 3600 } }),
    "GET /master.mp4": () => ({ body: new Uint8Array([1, 2, 3, 4]), headers: { "content-type": "video/mp4" } }),
    "POST /upload/youtube/v3/videos": () => ({ headers: { location: "https://www.googleapis.com/upload/youtube/v3/videos?upload_id=abc" }, json: {} }),
    "PUT /upload/youtube/v3/videos": () => ({ json: { id: "vid123", status: { privacyStatus: "private", publishAt: "2026-11-01T18:00:00Z" } } }),
    "GET /youtube/v3/videos": () => ({ json: { items: [{ status: { uploadStatus: "processed", privacyStatus: "private", publishAt: "2026-11-01T18:00:00Z" } }] } }),
  });
  const yt = createYouTubePublisher({
    clientId: "cid", clientSecret: "sec", redirectUri: "https://app/yt/cb", fetch: m.fetch, now: () => now,
    tokenStore: { get: async (k) => store.get(k) ?? null, set: async (k, t) => void store.set(k, t) },
  });
  const r = await yt.publish(base("YOUTUBE", "UC1", { scheduledAt: new Date("2026-11-01T18:00:00Z") }));
  assert.deepEqual(r, { providerJobId: "UC1:vid123", externalPostId: "vid123", externalUrl: "https://www.youtube.com/shorts/vid123", status: "scheduled" });
  assert.equal(store.get("UC1")!.accessToken, "fresh");
  assert.equal(store.get("UC1")!.refreshToken, "rt", "refresh token kept");

  const tok = m.calls.find((c) => c.url.pathname === "/token")!;
  assert.match(String(tok.body), /grant_type=refresh_token/);
  const init = m.calls.find((c) => c.method === "POST" && c.url.pathname === "/upload/youtube/v3/videos")!;
  assert.equal(init.url.searchParams.get("uploadType"), "resumable");
  assert.equal(init.url.searchParams.get("part"), "snippet,status");
  assert.equal(init.headers.get("authorization"), "Bearer fresh");
  assert.equal(init.headers.get("x-upload-content-length"), "4");
  assert.deepEqual(init.body, {
    snippet: { title: "Why octopuses have 3 hearts", description: "Biology in 60s\n\n#science #octopus", tags: ["science", "octopus"] },
    status: { privacyStatus: "private", publishAt: "2026-11-01T18:00:00.000Z", selfDeclaredMadeForKids: false, containsSyntheticMedia: true },
  });
  const put = m.calls.find((c) => c.method === "PUT")!;
  assert.equal(put.url.searchParams.get("upload_id"), "abc");

  const s = await yt.status("UC1:vid123");
  assert.equal(s.status, "scheduled");
  const sc = m.calls.at(-1)!;
  assert.equal(sc.url.searchParams.get("id"), "vid123");
  assert.equal(sc.url.searchParams.get("part"), "status,processingDetails");
});

test("youtube: auth URL scopes + offline access", async () => {
  const yt = createYouTubePublisher({ clientId: "cid", clientSecret: "s", redirectUri: "https://app/yt/cb", tokenStore: { get: async () => null, set: async () => {} } });
  const { url } = await yt.connect({ channelId: "ch", userId: "u", platform: "YOUTUBE", returnUrl: "https://app/done" });
  const u = new URL(url);
  assert.equal(u.host, "accounts.google.com");
  assert.match(u.searchParams.get("scope")!, /youtube\.upload/);
  assert.match(u.searchParams.get("scope")!, /yt-analytics\.readonly/);
  assert.equal(u.searchParams.get("access_type"), "offline");
});

// ───────────── retry ─────────────

test("retry: 429/5xx retried with backoff; POST 5xx only with idempotency key", async () => {
  let n = 0;
  const flaky = mockFetch({ "GET /x": () => (++n < 3 ? { status: n === 1 ? 429 : 503, json: {} } : { json: { ok: true } }) });
  const res = await fetchWithRetry(flaky.fetch, "https://h.test/x", {}, noSleep);
  assert.equal(res.status, 200);
  assert.equal(flaky.calls.length, 3);

  const post = mockFetch({ "POST /x": () => ({ status: 502, json: {} }) });
  assert.equal((await fetchWithRetry(post.fetch, "https://h.test/x", { method: "POST" }, noSleep)).status, 502);
  assert.equal(post.calls.length, 1, "unsafe POST not retried on 5xx");
  const post2 = mockFetch({ "POST /x": () => ({ status: 502, json: {} }) });
  await fetchWithRetry(post2.fetch, "https://h.test/x", { method: "POST" }, { ...noSleep, idempotencyKey: "k" });
  assert.equal(post2.calls.length, 4);
  assert.equal(post2.calls[0].headers.get("idempotency-key"), "k");
});
