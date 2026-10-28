# Distribution, Trends and Analytics for a Faceless Short-Form Video Platform

*Research date: 2026-10-28. Every claim has a source URL. Where vendor or third-party blogs conflict with official docs, the official docs win, and the conflict is noted. Items marked **[verify]** came only from secondary sources.*

---

## 0. TL;DR

- **Publishing: buy first, build later.** TikTok Direct Post needs an app audit (third-party reports say 2–6 weeks). Until then, every post is forced to `SELF_ONLY` and only 5 users can post per 24 h. Meta needs App Review. YouTube quota extensions can take months. An aggregator that has already passed these reviews (Zernio/Late, Ayrshare, Upload-Post, Post for Me) gets you to market in days. Then build direct integrations one platform at a time, in this order: YouTube (now cheap and easy), Instagram/Facebook, TikTok last.
- **The YouTube quota model changed in 2025–2026.** `videos.insert` and `search.list` now each have their own bucket: **1 unit per call, 100 calls/day per project by default**. Every other method shares the 10,000-unit pool ([Google quota calculator](https://developers.google.com/youtube/v3/determine_quota_cost); [revision history](https://developers.google.com/youtube/v3/revision_history)). The old figure of "1,600 units per upload" is out of date. The 100 uploads/day cap per project is now the binding limit, so you need a quota extension once you pass roughly 100 YouTube uploads/day across all users.
- **Instagram's limit is now 100 API-published posts per 24 h**, not 25 (the official doc also contains a stale "50" in one place) ([Meta content publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing)).
- **Trend radar:** use the YouTube Data API (`chart=mostPopular`, plus `search.list` under its new 100/day cap) and Google Trends through DataForSEO. Add Reddit, Apify TikTok/IG scrapers (accepting the legal and ToS risk) and an LLM-grounded search API (Exa/Tavily/Perplexity). Score and cluster everything weekly per niche. Estimated cost at 1,000 users is about $600–1,800/month with niche-level caching (Section 3.4).
- **Policy is the biggest product risk.** YouTube's "inauthentic content" rule (renamed from "repetitious" on 2025-07-15) and the 2026 enforcement against "AI slop" have removed whole clusters of templated faceless channels. The product must vary its templates, add real information value, and set the AI-disclosure flags (`containsSyntheticMedia`, TikTok `is_aigc`).

---

## 1. Direct publishing APIs

### 1.1 TikTok Content Posting API

| Item | Detail | Source |
|---|---|---|
| Modes | **Direct Post** (`video.publish`) publishes straight to the profile. **Upload to inbox** (`video.upload`) sends a draft that the creator finishes in the app. | [TikTok get-started](https://developers.tiktok.com/doc/content-posting-api-get-started), [Postproxy guide](https://postproxy.dev/blog/how-to-post-to-tiktok-via-api/) |
| Unaudited restriction | "All content uploaded via this endpoint will be restricted to private viewing mode" until the client passes an audit. A maximum of **5 users can post per 24 h**, and those accounts must be private. Otherwise the call fails with `unaudited_client_can_only_post_to_private_accounts`. | [TikTok Direct Post reference](https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post), [Postiz TikTok doc](https://docs.postiz.com/providers/tiktok.md) |
| Posting cap | About **15 posts/day per creator account**, shared across *all* API clients that use Direct Post | [TikTok Direct Post reference](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post) |
| Rate limits (per user token) | `creator_info/query` 20/min. Video init 6/min. Status fetch 30/min. | [TikTok creator info ref](https://developers.tiktok.com/doc/content-posting-api-reference-query-creator-info), [Postproxy](https://postproxy.dev/blog/how-to-post-to-tiktok-via-api/) |
| Video spec | MP4/WebM/MOV, at least 3 s, maximum = `max_video_post_duration_sec` from creator_info, at least 360p, up to 4 GB, 9:16 recommended. Source is `FILE_UPLOAD` (chunked) or `PULL_FROM_URL` (from a verified domain). | [Postproxy](https://postproxy.dev/blog/how-to-post-to-tiktok-via-api/) **[verify]** |
| AI label | `is_aigc: true` adds the "Creator labeled as AI-generated" tag | [TikTok Direct Post reference](https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post) |
| Commercial content | `brand_content_toggle` marks a paid partnership. `brand_organic_toggle` marks promotion of your own brand. The UI must show the legal declarations. | [TikTok Direct Post reference](https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post), [Content Sharing Guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines) |
| UX rules checked in the audit | Show the creator's username and avatar. Provide a privacy selector with **no default**, plus comment/duet/stitch toggles. Show the commercial-content disclosure. Get explicit user consent. **Do not add watermarks or promotional branding.** | [Content Sharing Guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines), [Postproxy](https://postproxy.dev/blog/how-to-post-to-tiktok-via-api/) |
| Audit timeline | No official SLA. Third parties report 2–6 weeks, often with several feedback rounds. You must submit a demo video of the full flow. | [bundle.social](https://bundle.social/blog/tiktok-api-approval), [rapidevelopers](https://www.rapidevelopers.com/md/api-automations/how-to-automate-tiktok-video-posting-using-the-api) |

**Implication for this product:** the TikTok rule against "fully automated" posting conflicts with "auto-publish". The UX guidelines expect a person to confirm each post (privacy choice, consent). A compliant pattern: the user approves a scheduled batch in our UI and picks privacy per post (or per batch with an explicit choice), and then we publish on schedule. The fallback for unaudited or high-risk accounts is Upload-to-inbox.

### 1.2 YouTube Data API v3

| Item | Detail | Source |
|---|---|---|
| Upload quota | `videos.insert` costs **1 unit in its own "Video Uploads" bucket, 100 calls/day default**. `search.list` also has its own 100/day bucket. Everything else shares 10,000 units/day. | [videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert), [quota calculator](https://developers.google.com/youtube/v3/determine_quota_cost) |
| History | 2025-12-04: the documented upload cost dropped from about 1,600 to about 100 units. 2026-06-01: granular buckets arrived, starting with `videos.insert` and `search.list`. | [revision history](https://developers.google.com/youtube/v3/revision_history) |
| Unverified projects | The 2020 rule made uploads from unverified projects created after 2020-07-28 private-only. The current `videos.insert` page now says videos from unverified projects "are not restricted to private viewing mode". Test this before relying on it. | [videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert), [revision history](https://developers.google.com/youtube/v3/revision_history) |
| Quota extension | Submit the YouTube API Services Audit & Quota Extension Form. There is no published SLA. Developer reports range from weeks to around 5 months. | [Quota & compliance audits](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits), [form](https://support.google.com/youtube/contact/yt_api_form), [Phyllo](https://www.getphyllo.com/post/is-the-youtube-api-free-in-2026-quota-limits-costs-when-to-pay) |
| OAuth | The `youtube.upload` scope needs Google OAuth app verification (sensitive-scope review: privacy policy, demo video, domain verification) before public users can use it without the "unverified app" screen. | [Google OAuth verification](https://support.google.com/cloud/answer/13463073) |
| Shorts detection | There is no API flag. A video counts as a Short when it is **square or vertical and ≤ 3 minutes** (for uploads after 2024-10-15). | [Tubefilter](https://www.tubefilter.com/2024/10/03/youtube-shorts-three-minutes-max-length-redesign-trends-templates/) |
| Scheduling | Set `status.privacyStatus=private` and `status.publishAt` (ISO 8601). A bad value returns `invalidPublishAt`. | [videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert) |
| Kids | `status.selfDeclaredMadeForKids` is a required COPPA declaration | [videos resource](https://developers.google.com/youtube/v3/docs/videos) |
| AI disclosure | `status.containsSyntheticMedia` (added 2024-10-30) flags realistic altered/synthetic content | [revision history](https://developers.google.com/youtube/v3/revision_history), [Help: altered content](https://support.google.com/youtube/answer/14328491) |
| Cost | Free. Quota can only be raised through the audit. | [Blotato YouTube pricing](https://www.blotato.com/blog/youtube-api-pricing) |

**Throughput math:** 100 uploads/day per GCP project by default. At 1,000 users posting one Short each per day, you need either a quota extension (about 10×) or an aggregator. Do **not** split traffic across multiple projects to get around the quota. The ToS forbids it, and it is a common reason for failing the audit ([compliance audits](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits)).

### 1.3 Instagram (Graph API / Instagram API with Instagram Login)

| Item | Detail | Source |
|---|---|---|
| Account | Instagram **professional account** (Business or Creator) | [Meta content publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing) |
| Permissions | FB Login path: `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`. IG Login path: `instagram_business_basic`, `instagram_business_content_publish`. | same |
| Flow | `POST /<IG_ID>/media` with `media_type=REELS` and `video_url` (or `upload_type=resumable` on the FB Login path), then poll `status_code` until FINISHED, then `POST /media_publish` | same; [IG User Media ref](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media) |
| Public URL | Meta fetches the media with cURL, so it must be publicly reachable at publish time. Presigned R2 URLs with long TTLs work. | [Meta content publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing) |
| Options | `cover_url` (JPEG), `thumb_offset`, `share_to_feed`, `collaborators`, `audio_name`, `trial_params` (Trial Reels: `MANUAL` / `SS_PERFORMANCE`) | same; [IG User Media ref](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media) |
| Rate limit | **100 API-published posts per rolling 24 h** (enforced at `media_publish`). Check `GET /<IG_ID>/content_publishing_limit`. The old limit was 25 ([2021 announcement](https://developers.facebook.com/blog/post/2021/01/26/introducing-instagram-content-publishing-api/)). | [Meta content publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing) |
| Review | Users without a role on the app need App Review approval (Advanced Access) for each permission, plus Business Verification. Typical review takes days to a few weeks, with rejections and resubmission common. **[verify]** | [Meta content publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing) |
| Specs | Third parties give 3 s to 15 min, MP4/MOV H.264, ≤ 300 MB–1 GB. These figures disagree. **[verify]** | [Upload-Post IG guide](https://www.upload-post.com/instagram-api/) |

### 1.4 Facebook, Pinterest, LinkedIn, X, Threads, Snapchat

| Platform | Auth / permissions | Review needed? | Daily limits | Scheduling | Cost | Source |
|---|---|---|---|---|---|---|
| **Facebook Reels** | Page token. `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`. 3-phase upload to `/{page_id}/video_reels`. | Meta App Review | **30 Reels per rolling 24 h** per Page. 3–90 s, 9:16, at least 540×960. | Yes (`scheduled_publish_time`) | Free | [Reels Publishing API](https://developers.facebook.com/docs/video-api/guides/reels-publishing) |
| **Pinterest v5** | OAuth `pins:write`. Register media, upload, then `POST /v5/pins` with `media_source.source_type=video_id`. | Trial → Standard (demo video). In Trial, pins are visible only to you and calls are capped around 1,000/day. | Standard tier raises the limits | No native publish time | Free | [Access tiers](https://developers.pinterest.com/docs/key-concepts/access-tiers/), [community FAQ](https://community.pinterest.biz/t/frequently-asked-questions-pinterest-api/2083) |
| **LinkedIn** | `w_member_social` (self-serve "Share on LinkedIn") for members. Organization pages need the Community Management API (vetted application). Videos API upload, then Posts API. | Yes for org pages | Per-app throttles | No | Free | [LinkedIn Videos API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/videos-api) |
| **X (API v2)** | OAuth 2.0 user context. Chunked media upload, then `POST /2/tweets`. | No review. Pay-per-use credits since 2026-02. | Media upload 500/15 min **[verify]** | No | About $0.015 per post created, $0.20 for a post containing a URL, $0.005 per read **[verify]** | [X API intro](https://docs.x.com/x-api/introduction), [Upload-Post X pricing](https://www.upload-post.com/x-api-pricing/), [Outstand](https://www.outstand.so/blog/x-api-pricing) |
| **Threads** | `threads_basic`, `threads_content_publish`. Container + publish, like IG. | Meta App Review | **250 posts per rolling 24 h** (carousel = 1). Check `threads_publishing_limit`. | No | Free | [Threads overview](https://developers.facebook.com/docs/threads/overview) |
| **Snapchat Spotlight** | Public Profile API (content management) | **Allowlist / partner-only** | Spotlight 5–60 s MP4 ≤ 500 MB **[verify]** | — | Free | [Snap Public Profile API](https://developers.snap.com/api/marketing-api/Public-Profile-API/Introduction), [Zernio docs](https://docs.zernio.com/platforms/snapchat) |

### 1.5 Summary: time to go live on each platform yourself

| Platform | Audit/review | Realistic time to go live | Hard daily cap per account |
|---|---|---|---|
| TikTok | App review + Direct Post audit | 3–8 weeks | ~15 posts |
| YouTube | OAuth verification. Quota audit above 100 uploads/day per project. | 1–4 weeks for OAuth. Weeks to months for quota. | 100 uploads/day **per project** |
| Instagram | App Review + Business Verification | 2–6 weeks | 100 posts |
| Facebook | App Review (same app as IG) | Same as IG | 30 Reels |
| Threads | App Review | Same as IG | 250 |
| Pinterest | Trial → Standard | 1–4 weeks | — |
| LinkedIn | Member posting is self-serve. Org posting needs a vetted application. | Days for members. Weeks for orgs. | — |
| X | None; you pay per call | Same day | — |
| Snapchat | Partner allowlist | Unknown | — |

---

## 2. Aggregator / unified publishing APIs

| Vendor | TikTok Direct / IG Reels / YT Shorts | Pricing (Oct 2026) | Multi-tenant (end users connect their own accounts) | White-label | Analytics | Notes | Source |
|---|---|---|---|---|---|---|---|
| **Ayrshare** | Yes / Yes / Yes (+ FB, X, LinkedIn, Pinterest, Threads, Snapchat, Bluesky, Reddit, GMB; 14+ networks) | Premium $149/mo (1 profile). Launch $299 (10). **Business $599 base for 30 profiles, then $8.99 → $3.49 → $2.49 per profile.** Enterprise from 300. | Yes ("profiles" + JWT hosted linking) | Custom branding on Launch and above | Strong: TikTok `videoViewRetention`, `averageTimeWatched`. IG Reels avg watch time, saves, shares. YT avg view %. | Most mature option and longest track record. TikTok limits 6/min and 15/day. `isAIGenerated` flag. Expensive at small scale. | [pricing](https://www.ayrshare.com/pricing/), [analytics](https://www.ayrshare.com/docs/apis/analytics/post), [TikTok](https://www.ayrshare.com/docs/apis/post/social-networks/tiktok) |
| **Zernio (formerly Late / getlate.dev)** | Yes / Yes / Yes (+ 12 others, Snapchat "coming soon") | **Per connected account: first 2 free, $6 each for 3–10, $3 for 11–100, $1 for 101+.** Unlimited posts. | Yes | Not stated | Included | Renamed from Late, no breaking changes, base URL `zernio.com/api/v1` | [pricing](https://zernio.com/pricing), [rebrand](https://zernio.com/rebrand) |
| **Upload-Post** | Yes / Yes / Yes (22 platforms) | Free (2 profiles, 10 uploads). Basic $24 (5). Pro $50 (25). Advanced $147 (75). **Business $438 (225 profiles), unlimited uploads.** | Yes (branded connect page) | **Included from the $50 plan** | Present. Endpoint details thin. | Cheapest flat white-label option. Says users need no TikTok audit (it uses its own client). | [llms-full](https://www.upload-post.com/llms-full.txt), [pricing](https://www.upload-post.com/pricing) |
| **Post Bridge** | Yes / Yes / Yes (10 platforms) | Marketer $39 (15 accounts, API). Operator $99 (99 accounts, then $1 each). | Partly (team-oriented) | No | Beta | Aimed at creators, not B2B2C | [pricing](https://www.post-bridge.com/pricing) |
| **Post for Me** | Yes on major platforms | Volume tiers: $10/1k posts … $1,000/200k posts. **Unlimited accounts.** | Yes (built for SaaS) | Yes ("your app" branding) **[verify]** | Limited | Cheapest per-post model for B2B2C. No free tier. | [Upload-Post comparison](https://www.upload-post.com/postforme-alternative/), [thatmarketingbuddy](https://thatmarketingbuddy.com/pricing/post-for-me) |
| **Blotato** | Yes / Yes / Yes (9 platforms) | Starter $29 (20 accts). Creator $97 (40). Agency $499 (100). The trial has no API. | Weak (agency model) | No | TikTok/YT/IG | Says it has an audited TikTok app. Starter caps TikTok at 3 accounts. | [pricing](https://www.blotato.com/pricing.md) |
| **Buffer** | Has a new GraphQL API (2026-05-27) | Free on all plans | **No: personal keys only; 3rd-party OAuth not enabled** **[verify]** | No | Basic | Legacy REST API shuts off 2027-02-01. Not suitable for multi-tenant use. | [Buffer API launch](https://buffer.com/resources/buffer-api-is-here/), [Zernio on Buffer](https://zernio.com/blog/buffer-api), [Kompozy](https://kompozy.io/news/buffer-legacy-api-retirement) |
| **Publer / SocialBee / Hootsuite** | UI-first tools. APIs are limited or enterprise-only. | Seat-based | No | No | In-app | Not designed to be embedded in a SaaS | [Buffer roundup](https://buffer.com/resources/best-social-media-apis/) |
| **Zapier / Make / n8n** | Connectors wrap the same platform APIs, and you still need your own approved app or an aggregator behind them | Per task | No | No | No | Good for internal operations, not for an end-user product | — |
| **Postiz (OSS, AGPL-3.0)** | Yes, but **you bring your own developer apps**. TikTok posts stay `SELF_ONLY` until *your* app is audited. | Self-host free. Cloud from $29. | Yes (workspaces) | Self-host | Basic | A useful code reference for building direct integrations. AGPL is a problem if you modify it and offer it as a service. | [Postiz TikTok](https://docs.postiz.com/providers/tiktok.md), [dev.to](https://dev.to/vikasprogrammer/buffer-wanted-100mo-so-i-self-host-postiz-for-15-dfa) |
| **Mixpost (OSS)** | Pro adds all platforms. You bring your own apps. | Lite free. Pro $299 one-time. Enterprise $1,199 one-time. | Enterprise: multi-tenant | Pro+ | Basic | Laravel/PHP | [Blotato Mixpost vs Postiz](https://www.blotato.com/blog/mixpost-vs-postiz) |

**Inheriting approvals.** When end users connect through an aggregator's OAuth app, they authorize *that vendor's* TikTok/Meta/Google client, so you inherit its audit status. That is the main reason to buy. Ayrshare, Zernio, Upload-Post and Blotato all advertise public TikTok posting with no audit needed on your side ([Upload-Post](https://www.upload-post.com/llms-full.txt), [Blotato TikTok](https://www.blotato.com/api/tiktok)). The trade-offs: you depend on the vendor, which can be suspended or rate-limited, and the OAuth consent screen shows the vendor's name unless the plan is white-label. TikTok's ~15 posts/day cap is per creator and **shared across all API clients**, so it applies regardless of vendor.

### 2.1 Cost model at 1,000 users (assume 3 connected accounts each, so 3,000 accounts)

| Vendor | Approximate monthly cost |
|---|---|
| Zernio | 2×0 + 8×$6 + 90×$3 + 2,900×$1 ≈ **$3,220** |
| Ayrshare Business (1,000 profiles, each holding multiple networks) | $599 + 70×8.99 + 400×3.49 + 500×2.49 ≈ **$3,860** (annual billing is cheaper) |
| Upload-Post Business | $438 for 225 profiles plus add-ons. Unlimited profiles "scaled via API" on Business, so **ask for a quote**. |
| Post for Me | 1,000 users × 30 posts/mo = 30k posts → **≈ $150–300** |

### 2.2 Build-vs-buy recommendation (phased)

1. **Phase 0 (weeks 0–2): buy.** Integrate *one* aggregator behind our own `Publisher` interface (`publish(video, targets, schedule)`, `status(id)`, `metrics(id)`). Choose Post for Me or Upload-Post if per-post cost matters most. Choose Ayrshare if you want the best analytics depth (TikTok retention, IG watch time) and the lowest reliability risk. Keep R2 public or presigned URLs as the media source. Put a second aggregator behind a feature flag for failover.
2. **Phase 1 (in parallel, start now): file the reviews**, since these are the long poles. Google OAuth verification + YouTube quota audit. Meta App Review (`instagram_business_content_publish`, `pages_manage_posts`, `threads_content_publish`). TikTok app review + Direct Post audit. Build the TikTok UX to meet the Content Sharing Guidelines from day one, because the audit checks it.
3. **Phase 2 (month 2–3): YouTube direct.** It is the easiest platform (no ToS conflict with scheduling, `publishAt` works natively, it is free) and now cheap in quota. It also gives you first-party YouTube Analytics retention curves, which aggregators only summarize.
4. **Phase 3 (month 3–5): Instagram + Facebook + Threads direct** on a single Meta app.
5. **Phase 4: TikTok direct**, once audited. Leave long-tail platforms (Pinterest, LinkedIn, X, Snapchat) on the aggregator for good. Their volume will not justify maintaining direct integrations.

---

## 3. Trend and idea data sources

### 3.1 Source inventory

| Source | What it gives | Access / legality | Cost | Source |
|---|---|---|---|---|
| **TikTok Creative Center** (trending hashtags, songs, creators, videos by country/industry, 7/30/120 d) | The best TikTok-native trend signal | **No official public API.** Scraping is a ToS gray area. Apify actors exist. | Free UI / scraper cost | [TikTok Creative Center](https://ads.tiktok.com/business/creativecenter/) |
| **TikTok Research API** | Video/comment/user query | **Non-profit academic researchers only, non-commercial.** Not usable for this product. | Free | [about Research API](https://developers.tiktok.com/doc/about-research-api/) |
| **YouTube `videos.list chart=mostPopular`** (+ `regionCode`, `videoCategoryId`) | Trending by region and category | Official. 1 unit/call from the shared 10k pool. | Free | [quota calc](https://developers.google.com/youtube/v3/determine_quota_cost) |
| **YouTube `search.list`** (`publishedAfter`, `order=viewCount`, `videoDuration=short`, `q=<niche>`) | A "breakout Shorts" detector | Official, but **its own bucket is only 100 calls/day**. Use it sparingly and cache per niche. | Free | same |
| **YouTube `videos.batchGetStats`** (new 2026-06) | Cheap bulk view/like snapshots for velocity tracking | 1 unit, own bucket, 10k/day | Free | [revision history](https://developers.google.com/youtube/v3/revision_history) |
| **Google Trends** | Search interest and rising queries | Official API is a gated **alpha** since 2025-07-24. `pytrends` was archived 2025-04-17. | DataForSEO about $0.0027/task (standard queue, 5 keywords). SerpApi from $25/1k. | [webscraping.cc](https://webscraping.cc/blog/google-trends-api/), [socialcrawl](https://www.socialcrawl.dev/blog/best-google-trends-apis-2026) |
| **Reddit Data API** (`/r/<niche>/rising`, `/top?t=week`) | Early topic and story signals | Free 100 QPM (OAuth) for non-commercial use. Commercial use needs approval, about $0.24/1k calls. **[verify]** | Low | [techloy](https://www.techloy.com/reddit-api-pricing-in-2026-complete-guide-for-developers-and-businesses/), [octolens](https://octolens.com/blog/reddit-api-pricing) |
| **X trends** | `GET /2/users/personalized_trends` (user token) | Pay-per-use. Possibly Enterprise. **[verify]** | Credits | [X personalized trends](https://docs.x.com/x-api/trends/personalized-trends/introduction.md) |
| **Exploding Topics API** | Curated, slower-moving topics | Business plan ($249/mo annual) or API packages at $1k/1k requests | High | [ET API](https://explodingtopics.com/feature/et-api) |
| **Apify actors** (TikTok, IG, YT scrapers) | Hashtag/sound/video metrics where no API exists | Scraping public data. Platform ToS forbids it. US case law (hiQ v. LinkedIn; Meta v. Bright Data, 2024) leans toward allowing logged-out public-data scraping, but ToS/contract risk remains. | Clockworks TikTok about $1.70–4/1k results. API Dojo about $0.30/1k. | [socialcrawl](https://www.socialcrawl.dev/blog/best-tiktok-data-apis-2026), [Apify API Dojo](https://apify.com/apidojo/tiktok-scraper) |
| **Search/grounding APIs** | LLM-grounded "what happened this week in X" | Official | Brave/Perplexity Search $5/1k. Exa $4–7/1k (+$1/1k pages). Tavily $5–8/1k. Perplexity Sonar adds token fees. | [beri.net](https://www.beri.net/article/tavily-vs-exa-vs-brave-vs-perplexity-search-api-agent-cost-2026), [devtoollab](https://devtoollab.com/blog/best-ai-search-apis) |
| **vidIQ / TubeBuddy / Semrush / Ahrefs YT keywords** | Keyword volume | No public creator APIs for vidIQ/TubeBuddy. Semrush/Ahrefs APIs are enterprise-priced. | High | — (no public API docs found) |

### 3.2 Trend-radar architecture

```
           ┌──────────── Ingest (per niche, cached & shared across users) ─────────────┐
 Daily  ── │ YT mostPopular (region×category)     YT search.list breakout (≤100/day)  │
           │ YT batchGetStats velocity re-polls    Reddit rising/top-week             │
 2×/wk  ── │ Apify: TikTok Creative Center hashtags/sounds; TikTok/IG hashtag top posts│
 Weekly ── │ DataForSEO Google Trends rising queries   Exa/Tavily news "this week in X"│
           └──────────────────────────────┬────────────────────────────────────────────┘
                                          ▼
   Normalize → item {platform, url, title, transcript/caption, views, age_h, creator_subs}
                                          ▼
   Score: velocity = views/age_h ; outlier = views / creator_median_views (≥5× = breakout)
          z-score vs niche baseline ; cross-platform corroboration bonus
                                          ▼
   LLM pass 1 (cheap model, batch): tag each item {topic, FORMAT, hook_type, length, visual_style}
   Embed + cluster (HDBSCAN) per niche → "trend cards" with exemplars
                                          ▼
   LLM pass 2 (strong model, grounded w/ Exa/Tavily snippets): per user niche+voice →
        10 ideas = {hook line, format template id, beats w/ timings, why-now evidence links,
                    risk flags (copyright, misinformation, YPP originality)}
                                          ▼
   Feedback: our own published-video metrics (Section 4) re-weight format×topic priors per user
```

**Detecting format trends, not just topics.** Classify every exemplar item into the controlled format taxonomy in Section 6 (POV, listicle countdown, X vs Y, story-time, quiz, myth-bust, and so on). Use title regexes ("POV:", "Top \d", " vs ", "Things I wish") plus an LLM label on the caption, the first ~5 s of transcript, and the OCR of the first frame. A *format trend* means a format's share of breakout items in a niche rises week over week (for example, the "X vs Y" share climbs from 4% to 12%). Track format × niche × platform as a time series and surface the top movers.

**Refresh cadence and cost at 1,000 users.** The key saving is that trends are computed **per niche, not per user**. Assume about 150 active niches.

| Item | Volume | Cost/mo |
|---|---|---|
| YouTube API | mostPopular + batchGetStats inside the 10k/100 quota | $0 |
| Apify TikTok/IG | 150 niches × 2/wk × 500 results ≈ 650k results | $200–1,000 |
| DataForSEO Trends | 150 × 20 kw/5 per task × 4.3 ≈ 2.6k tasks | <$20 |
| Reddit | free tier or about $50 | $0–50 |
| Exa/Tavily | 150 × 10 queries × 4.3 ≈ 6.5k | ~$50 |
| LLM tagging (cheap model, ~100k items) + idea generation (1k users × 4 runs × ~8k tokens) | — | $150–600 |
| **Total** | | **≈ $450–1,750/mo** |

---

## 4. Analytics read-back

| Platform | API | Metrics available for API-published content | Source |
|---|---|---|---|
| **YouTube** | YouTube Analytics API (`yt-analytics.readonly`) | views, engagedViews, estimatedMinutesWatched, averageViewDuration, averageViewPercentage, subscribersGained. **Retention curve** via `audienceWatchRatio` and `relativeRetentionPerformance` by `elapsedVideoTimeRatio` (100 points per video). Note: from 2026-08 public view counts start the moment a video plays, while monetization stays tied to engaged views. | [YT Analytics dimensions](https://developers.google.com/youtube/analytics/dimensions), [revision history](https://developers.google.com/youtube/v3/revision_history), [Adverity](https://docs.adverity.com/reference/connectors/connector-youtube-analytics.html) |
| **TikTok** | Display API `video/list`, `video/query` (`video.list` scope) | view_count, like_count, comment_count, share_count only. **No retention data in the Display API.** Content Posting `status/fetch` gives the publish state and post id. | [TikTok video object](https://developers.tiktok.com/doc/tiktok-api-v2-video-object) |
| TikTok via Ayrshare | Business/aggregator access | + reach, averageTimeWatched, fullVideoWatchedRate, **videoViewRetention**, traffic sources, audience. Data can lag 24–48 h, and some fields disappear after 7 days of inactivity. | [Ayrshare analytics](https://www.ayrshare.com/docs/apis/analytics/post) |
| **Instagram** | `/{media-id}/insights` | **views** (replaced plays/impressions on 2025-04-21), reach, likes, comments, shares, saved, total_interactions, ig_reels_avg_watch_time, ig_reels_video_view_total_time | [IG Media Insights](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights/), [v22 changelog](https://developers.facebook.com/blog/post/2025/01/21/introducing-graph-api-v22-and-marketing-api-v22/) |
| **Facebook Reels** | video_insights | blue_reels_play_count, post_video_avg_time_watched, post_video_view_time, reactions, shares | [Ayrshare analytics](https://www.ayrshare.com/docs/apis/analytics/post) |
| **Snapchat** | Public Profile API stats | views, viewers, screenshots, shares | [Zernio Snapchat](https://docs.zernio.com/platforms/snapchat) |

**Closing the loop:** poll at T+1 h, 6 h, 24 h, 72 h and 7 d. Store each snapshot as a time series. Normalize every result against the account's own median (an "outlier score") so that small and large accounts are comparable. Feed (format, hook_type, topic cluster, length, posting hour) → outcome into a per-user Thompson-sampling bandit that sets the mix of formats in the next batch of ideas. Retention curves (YouTube; TikTok through Ayrshare) also tell the generator where viewers drop, for example "the hook loses 40% by second 3, so shorten the intro".

---

## 5. Platform policies that shape the product

| Policy | What it requires / means | Source |
|---|---|---|
| **YouTube altered/synthetic disclosure** | Creators must disclose *realistic* altered or synthetic content (a real person saying something they didn't, altered real events, realistic fake scenes). Stylized animation, motion graphics and clearly unrealistic content do not need it. API field: `containsSyntheticMedia`. | [YT Help 14328491](https://support.google.com/youtube/answer/14328491), [YT blog](https://blog.youtube/news-and-events/disclosing-ai-generated-content) |
| **YouTube "inauthentic content"** (2025-07-15) | "Repetitious" was renamed to "inauthentic" and now covers *mass-produced or repetitive* content. AI use is allowed, but templated slideshows, near-duplicates and unedited prompt-to-upload content earn nothing in YPP. | [Yahoo/TechCrunch](https://finance.yahoo.com/news/youtube-clarifies-changes-monetization-rules-194232823.html), [vidIQ](https://vidiq.com/blog/post/youtube-reused-content-policy-guide/) |
| **2026 "AI slop" enforcement** | In January 2026 Neal Mohan's letter made AI slop a priority. 16 large AI channels were terminated or wiped (35M subscribers). A Google paper describes "S-CTS", which **terminates clusters of channels that share an AI template**: 130k channels in 6 months. | [Dexerto](https://www.dexerto.com/entertainment/youtube-responds-after-deleting-popular-ai-slop-channels-with-millions-of-subscribers-3314829/), [TechTimes](https://www.techtimes.com/articles/320629/20260715/youtube-wiped-35m-subscribers-over-ai-slop-now-its-judging-your-taste.htm), [Fstoppers](https://fstoppers.com/artificial-intelligence/how-google-machine-terminated-130000-ai-slop-youtube-channels-six-months-903645) |
| **TikTok AI label** | Realistic AIGC must be labeled. Content with C2PA Content Credentials is auto-labeled (since 2024-05). Unlabeled realistic AIGC can be removed. API flag: `is_aigc`. | [NBC](https://www.nbcnews.com/tech/tech-news/tiktok-will-automatically-label-ai-generated-content-rcna151446), [Maginative](https://www.maginative.com/article/tiktok-partners-with-c2pa-to-label-ai-generated-content-and-promote-media-literacy/) |
| **TikTok Creator Rewards** | 18+, 10k followers, 100k views in 30 d. Videos must be **original and longer than 1 min**. Qualified views = at least 5 s on FYP. Reports say fully AI-generated content is excluded. **[verify]** | [Metricool](https://metricool.com/tiktok-creator-fund/), [Storrito](https://storrito.com/resources/what-tiktoks-ai-monetization-restrictions-signal-for-creator-income/) |
| **Meta AI labels** | "Made with AI" was renamed "AI info" on 2024-07-01. Detection uses C2PA/IPTC metadata and self-disclosure. | [TechCrunch](https://techcrunch.com/2024/07/01/meta-changes-its-label-from-made-with-ai-to-ai-info-to-indicate-use-of-ai-in-photos/) |
| **Cross-post watermarks** | Instagram said it would make Reels "with logos or watermarks from other apps" (that is, TikTok) and blurry low-res Reels *less discoverable*. Your own logo is fine. In 2026 the rule was extended: accounts that mainly repost unoriginal content are not recommended to non-followers. | [CNN 2021](https://edition.cnn.com/2021/02/09/tech/instagram-reels-update/index.html), [Social Media Today](https://www.socialmediatoday.com/news/instagram-clarifies-including-your-own-logo-on-a-reel-is-ok/730852/), [PetaPixel 2026](https://petapixel.com/2026/04/30/new-instagram-policies-target-reposted-content/) |
| **Posting time/frequency** | Studies disagree: Buffer (7.1M posts) favors weekends, Sprout favors Tue–Thu 2–6 pm, Metricool 2026 (2M TikToks) favors 6–8 pm. Common guidance is 1–3 TikToks/day and about 1 Short/day. **Learn the best times per account from its own data.** | [Metricool](https://metricool.com/best-time-to-post-social-networks/), [breakreach](https://www.breakreach.com/guides/best-time-to-post-on-tiktok), [usefastlane](http://www.usefastlane.ai/blog/best-time-to-post-on-tiktok) |

**Product requirements that follow from these policies:**
1. Always render a **clean, unwatermarked master per platform**. Do not stamp our brand on users' videos, which TikTok's guidelines also forbid.
2. **Vary the templates.** Randomize layouts, palettes, typography, pacing and voice per user, so channels do not share a fingerprint that S-CTS-style clustering could detect.
3. Default `containsSyntheticMedia` / `is_aigc` to **true when realistic AI people or scenes are present**. Stylized motion graphics usually need neither.
4. Generate TikTok cuts longer than 1 min for monetizing users (Creator Rewards), and ≤ 3 min vertical for Shorts.
5. Respect the per-account caps: TikTok about 15/day, FB 30, IG 100, Threads 250.
6. Write C2PA Content Credentials into the output, so labeling is automatic and consistent.

---

## 6. Faceless short-form format taxonomy (2026)

Timings are for a roughly 30–45 s cut unless stated. Monetization risk reflects the YouTube inauthentic-content and TikTok originality rules: **Low** means the format adds clear informational value and varies naturally; **High** means it is easily templated or relies on reused material.

| # | Format | Structure (hook / body / payoff) | Length | Visual style | Niches | Viral examples | Risk |
|---|---|---|---|---|---|---|---|
| 1 | **"Did you know" / what-if explainer** | 0–2 s shocking question → 2–35 s 3D or motion-graphic answer → twist at the end | 30–60 s | 3D animation or kinetic type | Science, body, survival | **Zack D. Films**: ~29M subs, ~79–81B views, ~4,100 videos, almost all Shorts ([taletok](https://taletok.io/blog/best-faceless-youtube-channels/), [autofeed](https://www.autofeed.ai/blog/top-10-most-successful-faceless-youtube-channels)) | Low–Med (clones like NYKentertain 1.5B views risk the template-cluster rule) |
| 2 | **Listicle countdown ("Top 5…")** | Number promise → items in reverse order, ~5 s each → #1 payoff + loop | 30–50 s | Numbered cards, stock/AI B-roll | Facts, travel, tech, history | Facts Verse, Top 5 Unknowns ([outlierkit](https://outlierkit.com/resources/faceless-youtube-channels/)) | Med |
| 3 | **Stickman "every X explained"** | "Every ___ explained in __ sec" → rapid segments → callback | 45–90 s | Hand-drawn stickman | Psychology, history, anatomy | **The Paint Explainer** 2.0M subs / 322M views. EverythingProfessor 677K / 53.7M. ([taletok](https://taletok.io/blog/best-faceless-youtube-channels/)) | Low |
| 4 | **Horror / story-time narration** | Cold open line → escalating story → twist | 45–90 s (TikTok >60 s) | AI or illustrated scenes + narration | Horror, true crime | **Scary Pumpkin** 3.7M subs, 932M views. Horror Shorts Party 1.68M / 356M. ([outlierkit](https://outlierkit.com/resources/faceless-youtube-growth-strategy/), [taletok](https://taletok.io/blog/best-faceless-youtube-channels/)) | Med–High (AI narration over stock footage is a flagged pattern) |
| 5 | **POV text story** | "POV: you…" on-screen text in 1 s → captioned story over B-roll → punchline | 15–40 s | Text over stock/gameplay | Productivity, money, relationships | POV-script channels at 200k–2M subs ([unilink](https://www.unilink.us/blog/tiktok-trends-2026)) | High (low effort, easily templated) |
| 6 | **"X vs Y" comparison** | Split screen + "which wins?" → 3–5 stat rounds → verdict | 30–45 s | Split screen, bars | Tech, cars, animals, history, finance | Common in data/infographic Shorts (category observed) | Low |
| 7 | **Then vs now** | "1995 vs 2026" → paired visuals → surprising stat | 20–40 s | Side-by-side stills, price tickers | Nostalgia, economics, cities | Widely used (category) | Low–Med |
| 8 | **Data-viz "this chart explains"** | Bold claim → animated chart build → takeaway | 30–60 s | Animated charts (our motion-graphics strength) | Finance, economics, sports | Finance/econ essay channels have high RPM ([outlierkit](https://outlierkit.com/resources/faceless-youtube-growth-strategy/)) | Low |
| 9 | **News/headline reaction** | Animated headline → 3 bullet "what it means" → question CTA | 30–60 s | Headline cards, kinetic type | Tech/AI, finance, gaming | Category (time-sensitive) | Med (accuracy and copyright of clips) |
| 10 | **Quiz / guess** | "Only 1% get this" → 3–5 questions with a 3 s countdown → score | 30–60 s | Timer, reveal | Geography, trivia, flags | Category (high comment rate) | Med |
| 11 | **Mythbusting** | "Stop believing ___" → myth → evidence → truth | 30–45 s | Strike-through text, sources on screen | Health, fitness, money, science | Category | Low (needs citations) |
| 12 | **"X things I wish I knew"** | Relatable pain → 3–5 tips → save-CTA | 30–60 s | Text and icons | Careers, finance, study, parenting | Category (high save rate) | Low–Med |
| 13 | **Quote / motivation** | Quote in 1 s → cinematic B-roll + music → attribution | 10–25 s | Cinematic stock + serif type | Self-improvement, stoicism | Pursuit of Wonder 3.5M subs (long-form sibling) ([outlierkit](https://outlierkit.com/resources/faceless-youtube-growth-strategy/)) | **High** (the most saturated and repetitive format) |
| 14 | **Tutorial / screen-recording how-to** | Outcome shown first → steps → result | 30–90 s | Screen capture + zoom/callouts | AI tools, software, Excel | Productivity/AI-tool faceless accounts ([easyviral](https://easyviral.ai/api/blog-md/faceless-content-taking-over-social-media)) | Low |
| 15 | **Animated comedy skit / meme** | Setup → escalation → punchline | 15–40 s | Character animation | Gaming, school, relatable | **Beluga**: 11.2M subs, 2.6B views ([outlierkit](https://outlierkit.com/resources/faceless-youtube-growth-strategy/)) | Med |

Notes on the evidence: subscriber and view counts move daily and come from aggregator blogs that took snapshots from YouTube (taletok dated its snapshot 2026-10-11). Formats marked "category" are widely observed patterns without a single verified exemplar figure. Third-party claims suggest 1–3 minute cuts now beat 15 s clips on retention and distribution ([unilink](https://www.unilink.us/blog/tiktok-trends-2026)), which matches TikTok's rule that Creator Rewards require videos over 1 minute.

**Template design implication:** model each format as a *beat grammar*: hook (0–2 s, text plus motion), N body beats with target durations, payoff, and loop/CTA. Snap these beats to the music BPM, as the existing beat-sync system already does. Randomize the visual skin per user so the platform does not create detectable template clusters.

---

## 7. Open items to verify before committing

- TikTok Direct Post video spec and duration limits on the live docs (developers.tiktok.com returned 503 during this research).
- Instagram rate limit: the docs say 100 in one place and 50 in another. Read `content_publishing_limit` at runtime.
- Whether YouTube really lets unverified projects upload public videos now. Test with a fresh project.
- Upload-Post Business plan with unlimited profiles: get a quote. Also confirm with each aggregator in writing that its TikTok client is audited, and what its SLA is.
- Reddit commercial API terms, and whether X trends needs the Enterprise tier.
