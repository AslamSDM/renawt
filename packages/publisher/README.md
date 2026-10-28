# @remawt/publisher

`Publisher` interface plus adapters for posting faceless videos to TikTok, YouTube Shorts, Instagram Reels, Facebook Reels, Threads, LinkedIn, X and Pinterest. The package is ESM TypeScript. Its only runtime dependency is `zod`, and it uses native `fetch`/`FormData`. It persists nothing: the engine owns `SocialAccount`, `Publication` and `MetricSnapshot`.

```ts
import { createPublisher, buildPlatformMeta, nextSlots, spreadAcrossPlatforms, checkCap } from "@remawt/publisher";
const publisher = createPublisher(process.env); // dryrun unless configured
```

## Switching providers

| `PUBLISHER_PROVIDER` | Needs | Notes |
|---|---|---|
| unset | — | Uses `postforme` if `POSTFORME_API_KEY` is set, otherwise `uploadpost` if `UPLOADPOST_API_KEY` is set, otherwise **`dryrun`** |
| `dryrun` | — | A fake that needs no persistence. `DRYRUN_PLATFORMS=TIKTOK,YOUTUBE` limits which accounts it reports. |
| `postforme` | `POSTFORME_API_KEY` (`POSTFORME_BASE_URL` optional) | Primary aggregator |
| `uploadpost` | `UPLOADPOST_API_KEY` (`UPLOADPOST_BASE_URL`, `UPLOADPOST_CONNECT_LOGO_URL`, `UPLOADPOST_CONNECT_TITLE` optional) | Fallback aggregator with a white-label connect page |
| `youtube_direct` | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI`, plus a `tokenStore` passed in code | **Experimental** (phase 2) |

If a provider is selected but its key is missing, `createPublisher` throws `PublisherError("config")`. It never falls back to dryrun without saying so. `getPublisher(id, env, opts)` builds a specific adapter, for example to keep YouTube direct running next to an aggregator. `PUBLISHERS` is the capability matrix (`platforms`, `supportsSchedule`, `supportsMetrics`, `inheritsAudit`, `nativeSchedule`, `experimental`). `PUBLISHER_CAPS="TIKTOK=10,INSTAGRAM=50"` overrides the default daily caps.

### ID conventions (what the engine stores)

| Adapter | `providerProfileId` (connect) | `providerAccountId` (SocialAccount.externalId) | `providerJobId` |
|---|---|---|---|
| dryrun | `dry_<hash>` | `dry_<platform>_<hash>` | `dryjob_<platform>_<publishMs>_<hash>` (holds everything `status` needs) |
| postforme | our `channelId`, sent as the social account `external_id` | Post for Me social account id (`spc_…`) | Post for Me post id (`sp_…`) |
| uploadpost | profile username `ch_<channelId>` | `<username>:<platformKey>` | `req:<request_id>` / `job:<job_id>` / `sync:<b64>` |
| youtube_direct | YouTube channel id | YouTube channel id | `<channelId>:<videoId>` |

`metrics(externalPostId, platform, { providerAccountId, publishedAt })`: aggregators read metrics per account, so pass the context. Without it they return `null`.

### Interface additions (additive only)
- `PublishMeta`: `brandedContent`, `allowComment`, `allowDuet`, `allowStitch`, `shareToFeed`, `description`, `tags`, `categoryId`, `pinterestBoardId`. `privacy` now also accepts `"followers" | "unlisted"`.
- `ConnectRequest.providerProfileId?`, `ConnectedAccount.status?`, `metrics(..., ctx?)`, `Publisher.cancel?()`, `PublisherError`.

## What is verified and what is not

Both aggregators were checked on 2026-10-28 against their **published OpenAPI specs**. Request shaping for every adapter is covered by mocked-`fetch` tests. **No adapter has been called against a live API yet**, because there are no keys.

**Post for Me** (spec embedded in https://api.postforme.dev/docs)
- Verified paths and fields: `POST /v1/social-accounts/auth-url` (`platform`, `external_id`, `redirect_url_override`) → `{url}`. `GET /v1/social-accounts?external_id&status`. `POST /v1/social-accounts/{id}/disconnect`. `POST /v1/social-posts` (`caption`, `social_accounts[]`, `media[{url,thumbnail_url}]`, `platform_configurations.{tiktok,youtube,instagram,…}`, `external_id`, `scheduled_at`). `GET/DELETE /v1/social-posts/{id}` (status `draft|scheduled|processing|processed`). `GET /v1/social-post-results?post_id` (`success`, `error`, `platform_data.{id,url}`). `GET /v1/social-account-feeds/{account}?platform_post_id&expand=metrics`.
- TikTok config: `privacy_status`, `allow_comment|duet|stitch`, `disclose_your_brand`, `disclose_branded_content`, `is_ai_generated`. YouTube: `title`, `description`, `tags`, `privacy_status`, `made_for_kids`, `contains_synthetic_media`. IG: `placement=reels`, `share_to_feed`.
- UNVERIFIED: whether the post API honours an `Idempotency-Key` header. We dedupe through `external_id` lookup instead. Also unverified: whether `redirect_url_override` appends query params, whether TikTok metrics include retention (the spec shows TikTok Business retention only), and white-label branding of the OAuth screen. Deleting a published post (`cancel`) probably does not remove it from the platform.
- YouTube through Post for Me schedules at the aggregator (`scheduled_at`), not through native `publishAt`.

**Upload-Post** (https://docs.upload-post.com/openapi.json, linked from https://www.upload-post.com/llms-full.txt)
- Verified: header `Authorization: Apikey <key>`. `POST /api/uploadposts/users` (409 means it already exists). `POST /api/uploadposts/users/generate-jwt` (`username`, `redirect_url`, `platforms`, branding) → `access_url`. `GET /api/uploadposts/users/{username}` → `profile.social_accounts`. `POST /api/upload` multipart (`user`, `platform[]`, `video`=URL, `title`, `scheduled_date`, `async_upload`, `privacy_level`, `disable_*`, `brand_*_toggle`, `is_aigc`, `post_mode`, `privacyStatus`, `selfDeclaredMadeForKids`, `containsSyntheticMedia`, `media_type`, `share_to_feed`, …) → `request_id` / `job_id` / `results`. `GET /api/uploadposts/status?request_id|job_id`. `DELETE /api/uploadposts/schedule/{job_id}`. `GET /api/uploadposts/post-analytics/cached?user&platform`. `DELETE /api/uploadposts/users/social`.
- UNVERIFIED: multipart array encoding for YouTube `tags[]`. Also unverified: whether `status?job_id=` 404s before a scheduled job runs (we fall back to `GET /schedule/{job_id}`), the name and shape of the TikTok retention key in cached analytics (parsed best-effort), and whether the `Idempotency-Key` header does anything (POST `/upload` is never retried on 5xx).

**YouTube direct** (experimental): OAuth URL with offline access and `youtube.upload`, `youtube.readonly` and `yt-analytics.readonly` (`youtube.readonly` is needed for `channels.list mine` and to read private video status). Also: token refresh into the injected `TokenStore`, a resumable `videos.insert` (`privacyStatus=private` + `publishAt`, `selfDeclaredMadeForKids`, `containsSyntheticMedia`), `videos.list` for status and statistics, Analytics `audienceWatchRatio` by `elapsedVideoTimeRatio` for retention, and token revoke. Media is buffered in memory, which is fine for Shorts. UNVERIFIED: `cancel` (`videos.delete`) needs the `youtube.force-ssl` scope, which we do not request.

## TikTok audit UX checklist (web UI MUST satisfy, per TikTok Content Sharing Guidelines)

This applies to aggregators too, because the creator's posts still go through the TikTok Direct Post rules.

- [ ] Show the connected creator's **username and avatar** on the post or approval screen (`ConnectedAccount.handle/avatarUrl`).
- [ ] Show a **privacy selector with no default value** (Public / Friends / Followers / Only me). The user must pick one. `publish()` rejects TikTok posts without `meta.privacy`.
- [ ] Show **Comment / Duet / Stitch toggles** → `allowComment/allowDuet/allowStitch`. Disable any toggle the creator's settings disallow.
- [ ] Show a **commercial content disclosure**: a "This content promotes…" switch with **Your brand** (`commercial`) and **Branded content** (`brandedContent`). Show the matching legal notice ("Promotional content" / "Paid partnership"). Branded content cannot be private.
- [ ] Get **explicit consent** before every post or approved batch, for example: "By posting, you agree to TikTok's Music Usage Confirmation" (plus the Branded Content Policy when it applies). Autopilot means the user approves a scheduled batch and picks privacy explicitly. It never means silent auto-posting.
- [ ] Add **no watermark, logo or promotional text** to the video or caption. `buildPlatformMeta` removes our brand and never adds text.
- [ ] Show the AI-generated label state (`aiGenerated` → `is_aigc` / `is_ai_generated`). Default it to true for realistic AI people or scenes.
- [ ] Tell the user that posts can take a few minutes to appear, and show the publish status from `status()`.

## Helpers
- `buildPlatformMeta(platform, {title, caption, hashtags, aiGenerated, madeForKids, commercial, privacy})` enforces these limits: YT title ≤100 and description ≤5000 (no `<>`, tags ≤500 chars), TikTok ≤2200 with ≤5 hashtags, IG ≤2200 with ≤30 hashtags, Threads ≤500 with 1 tag, X ≤280, FB ≤2200, LinkedIn ≤3000, Pinterest ≤500. Hashtags are dropped before the body is cut. Lengths count code points; X's weighted counting is approximate.
- `DEFAULT_CAPS` / `checkCap(platform, publishedLast24h)`.
- `nextSlots(cadence, tz, from, count)` uses Intl only and handles DST gaps and overlaps. `spreadAcrossPlatforms(base, platforms)` staggers posts deterministically by 5–15 minutes. `isWithinCap(platform, existing, candidate)` checks rolling 24h windows.
- `fetchWithRetry` / `withRetry`: full-jitter exponential backoff on 429, 408 and 5xx, and honours `Retry-After`. POST requests are retried on 5xx or network errors only when an idempotency key is passed.

## Scripts
`pnpm --filter @remawt/publisher typecheck` · `pnpm --filter @remawt/publisher test` (`node --test` via tsx)
