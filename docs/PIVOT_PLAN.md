# remawt v2 — Faceless Content Platform: Pivot Plan

*Date: 2026-10-28. Supporting research (every claim cited): `docs/research/2026-10-28-market-competitors.md`, `docs/research/2026-10-28-tech-stack.md`, `docs/research/2026-10-28-distribution-trends.md`.*

---

## 1. Thesis

**Who:** camera-shy aspiring creators (18–35) who know a niche (tech/AI, finance, history, psychology, science) and cannot film or animate. Secondary: solo founders needing explainer shorts (remawt's existing URL→video DNA).

**What:** pick a niche → build a persistent **Channel Identity Kit** (look, voice, persona, mascot) → AI turns trend-driven ideas into **real motion-graphics shorts** (HyperFrames HTML, not image slideshows) → schedule + publish to TikTok / Shorts / Reels → performance feeds back into the idea queue.

**Why now:** the category is proven ($19–99/mo, Crayo ~$600K/mo, AutoShorts/Revid ~$1M ARR) but commoditized around "AI image slideshow + TTS + captions". YouTube's July-2025 "inauthentic content" rule and the 2026 AI-slop purge (16 channels / 35M subs wiped; Google's S-CTS clustering terminated ~130k channels sharing an AI template) hit exactly that default output. Nobody leads with designed motion graphics + persistent channel identity + niche trend→idea loop + monetization-safe guardrails. We already own the hard part (HyperFrames pipeline, render Lambda, TTS, music, billing).

**Tagline candidates:** "Faceless, not soulless." / "Explainer videos that look designed, not generated." / "Your channel's look, voice and ideas, on autopilot."

**Five differentiators**
1. Real motion graphics (kinetic type, animated charts, maps, diagrams, UI animation) rendered from HTML. Fully editable.
2. Channel Identity Kit: palette, type, mascot/recurring character, intro sting, voice, script persona, applied to every video while content varies.
3. Niche Radar → Idea Queue: weekly outliers + format trends per niche, ranked angles, one-click into the series queue. Included in plan, not per-idea credits (Syllaby charges 15 credits/idea).
4. Monetization-safe by design: originality/variation score over last 30 uploads, no "AI advisor persona" in finance/health, AI labels auto-set, 60s+ TikTok Rewards mode, unwatermarked masters.
5. Honest pricing: meter videos not opaque credits, free re-renders, rollover, real refund window (top complaints at InVideo/Revid/AutoShorts/Crayo).

---

## 2. Competitive landscape (summary)

| Tool | Entry $ | Visuals | Motion graphics | Autopilot | Persistent identity | Trend/idea | Originality guard |
|---|---|---|---|---|---|---|---|
| faceless.so | $29 (~25 videos) | AI images / AI video | ◐ | ● 7 platforms | ◐ per-series | ○ | ○ |
| AutoShorts | $19 (3/wk, 1 series cap) | AI images | ○ | ● | ○ | ○ | ○ |
| faceless.video | $20 (15 videos) | AI images / stock | ○ | ● | ○ | ○ | ○ |
| Revid | $39 (credits) | AI image/video, avatars | ○ | ● Auto-Mode | ◐ | ◐ viral remix lib | ○ |
| Crayo | $29 | gameplay/stock, Reddit stories | ○ | ○ | ○ | ◐ | ○ |
| Syllaby | $9 | AI/stock, avatars | ○ | ◐ calendar | ◐ | ● (15 credits/idea) | ○ |
| Fastlane (usefastlane.ai) | $29 | AI UGC avatars | ○ | ● agent | ● learns brand from URL | ◐ | ○ |
| Fliki | — | stock + kinetic text | ◐ | ○ | ○ | ○ | ○ |
| **remawt v2** | $24 | **HTML motion graphics** + AI image/stock | **●** | ● | **●** | **●** | **●** |

Notes: "Fastlane" = usefastlane.ai, an AI-ads/UGC-influencer platform for brands, adjacent not direct. Fliki's kinetic text is the closest feature-level threat. AutoShorts traffic is declining (~228K/mo, −16% MoM) → commodity segment saturating. Common complaints to exploit: static output, credit opacity, paying to regenerate, refund hostility, uneditable captions/audio.

---

## 3. Product scope

### 3.1 Core objects
- **Channel** (= brand kit + niche + connected accounts + cadence). Plans gate on channels, not series.
- **Identity Kit** (JSON on Channel): niche, audience, persona (tone sliders + sample script), visual skin (palette, type pair, motion style, caption style, intro/outro sting), mascot (optional, Recraft vector w/ fixed seed/style ref), voice (ElevenLabs library voice; clone on Creator+), format preferences, forbidden topics. Stored also as Mastra working memory (`resource = channelId`).
- **Trend Card** (per niche, shared across users): cluster of breakout items with exemplars, topic + format + hook tags, velocity.
- **Idea** (per channel): hook line, format template, beats w/ timings, why-now evidence links, risk flags. States: suggested → approved → queued → produced.
- **Video**: idea → script → voice → scene plan → assets → HTML composition → render → master mp4 + per-platform cuts (≤60s Shorts/Reels, 60–90s TikTok Rewards cut).
- **Series**: cadence rule (e.g. 1/day, Mon–Fri 18:00 local) that auto-pulls approved ideas into production and schedules publishing.
- **Publication**: Video × SocialAccount × scheduledAt → platform post id, status.
- **MetricSnapshot**: publication × t (1h/6h/24h/72h/7d) → views, retention, saves, shares → outlier score vs account median.

### 3.2 Format library (launch with 6, grow to 15)
Beat-grammar templates (hook 0–2s / N body beats / payoff / loop-CTA), snapped to music BPM (existing `snapToBeats`). Launch set, chosen for low policy risk + motion-graphics strength:
1. "Did you know" explainer (kinetic type + diagram)
2. Data-viz "this chart explains" (animated chart build)
3. "X vs Y" comparison (split screen, stat rounds)
4. "N things I wish I knew" (text + icons, save-CTA)
5. Mythbusting (strike-through, sources on screen)
6. News/headline reaction (animated headline, 3 bullets)
Later: listicle countdown, then-vs-now, quiz, tutorial/screen-rec, story-time (opt-in, with commentary), stickman "every X explained". Quote/motivation and raw POV/Reddit-reading formats are deprioritized (highest demonetization risk, Crayo's turf).

### 3.3 User flow (MVP)
1. Sign in → onboarding wizard: niche (search over ~150 niche taxonomy) → 6 generated skin previews (draft-quality HF renders) pick/tune 1 → voice pick → persona → optional mascot → kit saved.
2. Niche Radar shows this week's trend cards + 10 ranked ideas for the kit. Approve / edit / dismiss.
3. "Make video" → progress timeline (reuse callback→DB→poll progress streaming) → preview player + scene-level editor (edit any text/number, swap asset, re-render free ×3).
4. Connect accounts (aggregator hosted OAuth) → publish now or schedule → per-platform caption/hashtags/title variants (Haiku) → TikTok privacy/consent per batch (audit requirement).
5. Series toggle: autopilot with approval queue (default) or full auto (YouTube/IG only; TikTok always needs batch approval).
6. Analytics tab: per video outlier score, retention curve (YouTube), what format/hook is winning → bandit re-weights idea mix.

---

## 4. Architecture

### 4.1 Clean-slate layout (same repo, pnpm workspace, new branch `pivot/faceless`)
```
apps/web            Next 16 App Router (Vercel) — fresh scaffold; Auth.js, Prisma, Dodo, PostHog, shadcn
apps/engine         Express + Mastra (server adapter) + @mastra/inngest serve — ECS (port from generate-server)
packages/db         Prisma schema + client (single schema; engine imports it — stop mirroring two schemas)
packages/hf-kit     ported hfProject/hfMediaEngine/hfComposer contracts/hfRenderClient + 9:16 format blocks + skills md
packages/publisher  Publisher interface + adapters (aggregator first; youtube/meta/tiktok direct later)
packages/radar      trend ingest/score/cluster + idea generation
services/render-lambda   kept as-is (SQS → HyperFrames Lambda → R2), add completion callback
services/scraper-service kept (screenshot/crawl for the optional URL→explainer format)
```

**Keep / port / kill**
| Keep as-is | Port (rewrite into new packages) | Kill |
|---|---|---|
| Auth.js + Prisma User/Account | hfDirector → Mastra workflow steps | Remotion deps (`@remotion/*`, bundler/lambda/renderer) |
| Dodo client/webhook/checkout, Subscription, CreditPurchase, WebhookEvent | hfComposer system prompt → cached HF skill prompt (1080×1920 contract) | Jitter pipeline (`urlToJitter`, `hfComposerLegacy`, jitter templates gallery `/templates`) |
| R2 storage lib, Music table + seed/fetch scripts + beatSync | elevenlabsService → TTS adapter w/ timestamps | Screen recording (`/record`, `/editor/recording`, cursor tracker/overlay, videoProcessor, ScreenRecording model) |
| render-lambda + render-service HF engine | sfxGenerator → cached SFX library | 3D (`three`, `@react-three/*`, threeEngine, ogl, CircularGallery) |
| scraper-service | progress streaming (callback→DB→poll) | model.ts Gemini/Ollama/OpenRouter routing (Mastra replaces) |
| LlmCall token logger (re-point to Mastra observability) | billing.checkAndDeductCredits → per-video metering | Blog/SEO landing pages (rebuild later targeting "faceless" keywords) |
| PostHog, Resend | skills/*.md → packages/hf-kit/skills | Project/Generation/ProductImage models (replaced by Channel/Video) |

### 4.2 AI backend (Mastra 1.79.x pinned, Claude + DeepSeek)
Model routing via Mastra strings with fallback arrays:
| Job | Model | Notes |
|---|---|---|
| Trend tagging, niche classification, moderation, titles/hashtags/captions, caption line-breaking | `anthropic/claude-haiku-5-5` ($0.10/$0.50) | fallback `deepseek/deepseek-flash` |
| Bulk idea generation + dedup, trend summaries, hook A/B variants, first-draft scripts, translations | `deepseek/deepseek-flash` ($0.30/$1.20, 50% off-peak, cache hits $0.006) | no PII/brand secrets; JSON mode not schema-strict → zod validate + retry; disclose as subprocessor |
| Script final (hook/body/CTA in persona) | `anthropic/claude-sonnet-5-5` ($2/$10) | structured output (zod), Opus for Pro+ |
| Visual plan + HyperFrames HTML/GSAP | `anthropic/claude-sonnet-5-5` | HF skill prompt in 1h cache (hits = 5%); Opus 5.5 retry on lint failure for Pro+ |
| Critic (vision on rendered keyframes + lint report) | Sonnet (std) / Opus 5.5 (premium) | max 2 loops |
| Scheduled/overnight queue | same via Batch API (−50%) + DeepSeek off-peak | scheduling product = most jobs not latency-bound |
Fable 5.1 not used per video (maybe one-off kit synthesis). Evals: Mastra scorers for lint-pass rate, persona adherence, hook quality; dataset of 50 golden scripts/compositions in CI.

### 4.3 Pipeline (Mastra workflow, Inngest runner, hosted in apps/engine on ECS)
```
ideate(radar cards → ideas)                       Haiku/DeepSeek
 → script(persona, format beat-grammar)           Sonnet, structured
 → parallel[ tts(ElevenLabs v4 Turbo w/ char timestamps) | visualPlan(scene list, block per beat) ]
 → assets.foreach(image: Nano Banana 2.1 / Recraft Flash | stock: Pexels/Pixabay → R2)   idempotent by (videoId, stepId, hash)
 → compose(HTML 1080×1920, registry blocks, captions from timestamps, music beat-snap, SFX cues)
 → dountil(lint + vision critic pass, max 2)
 → render(enqueue SQS → Lambda; SUSPEND) ⟵ Lambda/StepFunctions completion → Inngest event → resume
 → qc(originality score vs channel's last 30; policy linter; AI-label flags; per-platform cuts)
 → approve(SUSPEND for user, or auto for series)
 → publish.sleepUntil(scheduledAt) → Publisher.publish()
 → metrics cron (1h/6h/24h/72h/7d) → bandit update
```
Rules: every paid step idempotent (Inngest/Mastra may re-run); cap retries, down-model on lint-only fixes (Opus→Sonnet→DeepSeek); Mastra storage `@mastra/pg` on Neon in its own schema (`mastra`) so Prisma sees no drift; Vercel side only starts runs/polls status; Inngest cron for scheduler (Mastra's built-in scheduler is best-effort, no serverless).

### 4.4 Media stack
| Layer | Default | Premium / add-on | Free tier |
|---|---|---|---|
| TTS | ElevenLabs v4 Turbo/Flash $0.04/1k chars (char timestamps) | ElevenLabs v4 $0.08, PVC clone | Kokoro (near-free) + Groq Whisper align $0.04/hr |
| Images | Nano Banana 2.1 1K $0.034; Recraft V4.1 Flash $0.007 (flat/icons/mascot) | FLUX.2 pro photoreal | stock only |
| AI video b-roll | none | Veo 3.1 Fast no-audio $0.80/8s (credit add-on) | — |
| Stock | Pexels + Pixabay portrait → R2 w/ license metadata | Storyblocks later (indemnity) | same |
| Music | existing Music table (BPM-tagged) | Lyria 3 Clip $0.04 / ElevenLabs Music $0.15/min | same |
| SFX | ElevenLabs SFX generated once → cached library | | |
| Render | HyperFrames 0.8.x, arm64 Lambda, 1080×1920, ~$0.01–0.06/video | | draft quality |

### 4.5 COGS per 60s video (uncached list → with cache+batch)
| Path | Cost |
|---|---|
| Cheapest (DeepSeek + Kokoro/Inworld + HTML only) | $0.07–0.12 |
| Standard (Sonnet + ElevenLabs Turbo + 3 images) | $0.50–0.60 → **~$0.30–0.40** with prompt cache + Batch |
| Premium (Opus + ElevenLabs v4 + 1 Veo clip) | $2.05–2.90 |
Biggest swing = LLM retries. Standard path at ~$0.35 gives ~55–60% gross margin on Starter/Creator (see §6). Premium only as metered add-on.

### 4.6 Trend radar (packages/radar)
Computed **per niche (~150), shared across users**, not per user.
- Daily: YouTube `mostPopular` (region × category), `batchGetStats` velocity re-polls, `search.list` breakout (own 100/day bucket, cache hard), Reddit rising/top-week.
- 2×/wk: Apify TikTok Creative Center hashtags/sounds + TikTok/IG hashtag top posts (ToS gray area, accept risk, isolate behind flag).
- Weekly: DataForSEO Google Trends rising queries; Exa/Tavily grounded "this week in X".
- Score: velocity = views/age_h; outlier = views / creator median (≥5× = breakout); cross-platform bonus.
- LLM pass 1 (Haiku/DeepSeek batch): tag {topic, format, hook_type, length, visual_style}; embed + cluster per niche → trend cards.
- LLM pass 2 (Sonnet, grounded): 10 ideas per channel in persona with evidence links + risk flags.
- Format trends: format share of breakout items rising WoW (15-format taxonomy).
- Feedback: our own published metrics → per-channel Thompson-sampling bandit over format × topic.
- Cost ≈ $450–1,750/mo at 1k users. Weekly digest email via Resend.

### 4.7 Distribution (packages/publisher) — buy first, build direct later
`Publisher { connect(channel) → hostedOAuthUrl; publish(video, targets, schedule); status(id); metrics(id) }`
- **Phase 0:** one aggregator adapter. Primary candidate **Post for Me** (unlimited accounts, ~$10/1k posts, built for SaaS; verify white-label) with **Upload-Post** (white-label from $50, 22 platforms) behind a flag as failover. Ayrshare ($149+/mo, best analytics incl. TikTok retention) if/when analytics depth matters. Users connect via vendor's already-audited TikTok/Meta/Google apps → we inherit approvals.
- **File reviews day 1** (long poles): Google OAuth verification + YouTube quota audit; Meta App Review (`instagram_business_content_publish`, `pages_manage_posts`, `threads_content_publish`) + Business Verification; TikTok app review + Direct Post audit (build the compliant UX now: username/avatar shown, privacy selector with no default, comment/duet/stitch toggles, commercial disclosure, explicit consent, no watermark).
- **Phase 2:** YouTube direct (`publishAt` native scheduling, `containsSyntheticMedia`, `selfDeclaredMadeForKids`; `videos.insert` is now 1 unit in its own 100/day bucket; Analytics API gives retention curves).
- **Phase 3:** Instagram + Facebook + Threads direct on one Meta app (IG 100 posts/24h, FB Reels 30, Threads 250; read `content_publishing_limit` at runtime).
- **Phase 4:** TikTok direct post-audit (~15 posts/day/creator shared across all clients; `is_aigc`). Pinterest/LinkedIn/X/Snapchat stay on aggregator forever.

### 4.8 Policy guardrails (product requirements)
1. Unwatermarked master per platform; our logo never on user video.
2. Vary templates per channel (skin randomization within kit bounds) → no detectable template cluster.
3. Originality linter: similarity of script/structure/visual fingerprint vs channel's last 30 uploads; block or warn.
4. Finance/health/legal niches: narrator + on-screen sources/data, never "AI advisor persona".
5. Reddit/story readings opt-in only, with added commentary beats.
6. `containsSyntheticMedia` / `is_aigc` auto-true when realistic AI people/scenes present; stylized motion graphics usually exempt.
7. TikTok: 60–90s cut for Creator Rewards (≥1 min original); Shorts ≤3 min vertical.
8. C2PA Content Credentials in output (phase 3).

---

## 5. Data model (Prisma v2, single schema in packages/db)
```
User, Account, Subscription, CreditPurchase, WebhookEvent     (keep)
Channel        id userId name niche kit(Json) timezone status
SocialAccount  id channelId platform provider(aggregator|direct) externalId handle tokens(enc) status caps(Json)
TrendItem      id niche platform url title stats(Json) tags(Json) fetchedAt   (shared)
TrendCard      id niche week topic format hook score exemplars(Json)
Idea           id channelId cardId? hook format beats(Json) evidence(Json) risk(Json) status score
Video          id channelId ideaId script(Json) scenes(Json) kitSnapshot(Json) masterUrl cuts(Json) status cost(Json) originality(Json) runId
Series         id channelId cadence(Json) platforms(Json) mode(approve|auto) active
Publication    id videoId socialAccountId scheduledAt publishedAt externalPostId status error
MetricSnapshot id publicationId t views retention(Json) likes comments shares saves outlierScore
Music, LlmCall (keep; LlmCall fed from Mastra observability)
Mastra tables  → separate Postgres schema `mastra`
```
Metering: 1 video = 1 unit of plan quota; re-renders free ×3; add-on credits only for Veo clips / custom music.

---

## 6. Pricing & packaging (Dodo)
| Tier | $/mo (annual −20%) | Channels | Videos/mo | Includes |
|---|---|---|---|---|
| Free | 0 | 1 | 3 (draft quality) | limited radar, no auto-post |
| Starter | 24 (19) | 1 | 30 | 3 platforms, idea feed, library voices |
| Creator (anchor) | 49 (39) | 2 | 60 | all platforms, voice clone, full radar, originality check |
| Pro | 99 (79) | 5 | 150 | 60–90s TikTok mode, Opus-quality, priority render |
| Agency | 199+ (159) | 15 | 400 | seats, client workspaces |
Add-on packs: AI video clips, custom music. Rollover unused videos 1 month. 7-day money-back. Dodo: 4 subscription products (monthly + annual) + credit packs; keep existing webhook/credit ledger, change unit from "credits" to "videos".
Margin check (standard path ~$0.35 with cache+batch): Starter 30 videos ≈ $10.5 COGS / $24 → ~56%; Creator 60 ≈ $21 / $49 → ~57%; Pro 150 Opus-ish ≈ $60–75 / $99 → ~30% (gate Opus to critic/retry only to protect this).

---

## 7. Roadmap (16 weeks)

**Phase 0 — Foundations (wk 1–2)**
- Branch `pivot/faceless`; scaffold `apps/web`, `apps/engine`, `packages/*`; move keepers; delete kill list. Single Prisma schema.
- Mastra + Inngest skeleton in engine; `@mastra/pg` schema `mastra`; Claude + DeepSeek keys; model fallback config; observability → PostHog.
- Port HF pipeline to 1080×1920; build 6 format blocks (beat grammar + registry blocks); lint + draft-render eval harness (50 golden cases).
- Pick aggregator (Post for Me vs Upload-Post, get written confirmation of audited TikTok client + white-label); implement `Publisher` adapter.
- **File Google / Meta / TikTok reviews.** Prepare demo videos.
- Dodo: create v2 products.

**Phase 1 — MVP (wk 3–6)**
- Onboarding wizard → Channel Identity Kit (skin previews, voice, persona, mascot).
- Single video generation end-to-end with progress timeline; preview + scene editor; free re-render.
- Connect accounts + publish now / schedule via aggregator; per-platform metadata variants.
- Plans + metering live. Dogfood: launch 2–3 of our own faceless channels (tech/AI explainer, finance data-viz, history) as GTM proof.
- Private beta 20 users.

**Phase 2 — Loop (wk 7–10)**
- Niche Radar ingest + trend cards + idea queue; weekly digest email.
- Series/autopilot with approval queue; Inngest cron scheduler; TikTok batch-approval UX.
- Metrics polling + outlier scores + bandit re-weighting; analytics tab.
- Originality/policy linter; 60–90s TikTok cut; 4 more formats.
- Public launch (Product Hunt + own channels + "faceless" SEO landings).

**Phase 3 — Depth (wk 11–16)**
- YouTube direct publish + Analytics retention curves; then Meta direct.
- Voice cloning (ElevenLabs PVC), mascot consistency, AI video add-on (Veo Fast), custom music add-on.
- Agency tier (seats, workspaces); C2PA credentials; optional URL→brand-explainer format (Fastlane-style) for founders.

---

## 8. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Platform policy drift (YouTube on-camera bias, TikTok AI exclusion from Rewards — disputed) | Educational explainer defaults, originality linter, labels, 60s+ cuts; monitor policy monthly |
| Aggregator dependency / suspension | `Publisher` abstraction, second vendor behind flag, direct YouTube by wk 12 |
| Mastra churn (~weekly minors; DurableAgent beta) | Pin exact versions; use Agents/Workflows/Memory only; no DurableAgent/Temporal |
| LLM HTML generation unreliability → retries blow COGS | Eval harness, lint-first fixes on cheaper model, cap 2 loops, format blocks constrain output |
| Margins at Pro tier | Opus only for critic/retry; batch + cache mandatory for scheduled queue |
| DeepSeek data residency | Never send PII/brand secrets; subprocessor disclosure; Claude fallback |
| Scraping ToS (Apify TikTok/IG) | Feature-flag, isolate, drop if contested; YouTube/Reddit/Trends official paths carry the radar |
| TikTok "no fully automated posting" | Batch approval UX; upload-to-inbox fallback |

---

## 9. Decisions needed from you
1. Aggregator: Post for Me (cheapest, unlimited accounts) vs Upload-Post (white-label $50) vs Ayrshare (analytics). Recommend Post for Me + Upload-Post fallback.
2. Same repo (new branch, workspace layout) vs fresh repo. Recommend same repo for Dodo/R2/Auth history.
3. Keep "remawt" name/domain for the faceless product? (Research shows no conflict; brand is neutral.)
4. Launch niches (recommend 5: tech/AI explainers, personal finance data-viz, history, psychology, science facts).
5. Keep URL→brand-explainer as a secondary format for founders (Phase 3) or drop entirely.
6. ~~Free tier: watermarked drafts vs no free tier~~ Decided 2026-10-29: keep a Free tier (3 draft-quality videos/month), no watermark on any tier.

## 10. Open verifications (from research)
- TikTok Direct Post spec/duration limits (docs returned 503).
- Instagram daily cap (docs say 100 in one place, 50 in another) → read `content_publishing_limit` at runtime.
- YouTube: unverified projects now allowed public uploads? Test with fresh project.
- Aggregators: written confirmation of audited TikTok client, white-label, SLA.
- TikTok Creator Rewards treatment of fully AI-generated content (sources conflict).
