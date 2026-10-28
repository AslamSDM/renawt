# engine-core status (2026-10-28)

Owner: engine-core. Scope: `apps/engine/**`. The code is not committed.

## Done
- **Server** (`src/server.ts`): Express. It has `/health` (this also reports the active publisher). Every `/v1` route requires `Bearer API_KEY` and `x-user-id`. Request bodies are validated with zod against `@remawt/shared`. The server writes structured JSON access logs and shuts down gracefully on SIGTERM. The Inngest `serve()` is mounted at `/api/inngest`, through `createServe(inngest/express)` from `@mastra/inngest`. It registers 15 functions.
- **Routes**: every route in the BUILD.md API table is in `src/routes/{videos,misc,webhooks}.ts`. `/v1/videos/start` accepts `source` (the addendum). It only updates the existing `Video` row, then sends `video/produce.requested`.
- **Mastra** (`src/mastra/index.ts`): uses `PostgresStore({ connectionString, schemaName: "mastra" })`. When `POSTHOG_KEY` is set, a `PosthogExporter` is added through `@mastra/observability`. Versions are pinned: core 1.79.0, pg 1.32.0, inngest-adapter 1.10.7, **inngest 4.26.1**, because `@mastra/inngest` 1.10.x needs inngest ^4, not 3.x.
- **Models** (`src/mastra/models.ts`): `modelsFor(role, quality)` returns a fallback array. The arrays are classify/metadata = Haiku → DeepSeek, draft/tag = DeepSeek → Haiku, script/compose/plan = Sonnet → Opus (premium: Opus first), and critic = Sonnet or Opus. A model whose provider has no key is dropped. `withUsageLogging` (`usage.ts`) writes `llm_calls`, including cached tokens and USD from `src/lib/pricing.ts`. It also adds the cost to `Video.cost.llmUsd`. Video, channel and user ids come from AsyncLocalStorage (`lib/context.ts`).
- **Agents**:
  - `scriptwriter`, `planner`, `composer` (an HF system prompt sent as an Anthropic 1h-cached system block), `critic` (vision through image parts), `metadata` (Haiku; platform limits enforced), `tagger`/`ideator` (with `runTagger`/`runIdeator` injected into radar's `refreshNiche`/`ideasForChannel`).
  - Addendum agents: `pickFormat`, `beatifyTranscript` (never rewrites spoken words), `planVideoEdit`.
  - Agents never set temperature.
- **Workflows**:
  - `produceVideo`/`rerenderVideo` (Inngest) runs ingest → transcribe → script → parallel[voice, plan] → align → assets → compose → dountil(review, ok‖attempts≥2) → render → qc → cuts → READY.
    - Render: `local` renders inline. `lambda` runs `submitRender`, then **suspends**. `/webhooks/render` or the 15s/12min poll fallback (`render-poll-fallback`) resumes it. An atomic claim makes sure it is resumed only once.
    - On failure `onError` sets FAILED and refunds directly through Prisma (UsageLedger `refund` +1, `videosUsed--`). The refund is idempotent.
  - `kitPreviews` runs in-process (default engine). It writes R2 `kits/{channelId}/{skinId}.png`, cached by a hash.
  - `radarRefresh` runs on cron `0 5 * * *` and can also be triggered by hand.
  - `publishPublication` uses `sleepUntil`. `collectMetrics` runs hourly and writes the 1h/6h/24h/72h/7d buckets plus `outlierScore` against the account median.
  - `seriesTick` runs hourly. It picks an idea, consumes quota, starts produce, and creates Publications at the slot time. APPROVE mode sets `needsApproval`.
- **Idempotency**: each step reads from and persists to the Video row and skips work when its hash matches:
  - script present
  - voice hash covers text, voice and speed
  - plan draftHash
  - narration `narration/{videoId}.mp3` plus a `.json` alignment with the hash
  - assets in `assets/{videoId}/{scene}-{provider}-{hash}`
  - render keyed by composition hash plus jobId
  - SFX generated once per cue (`SfxAsset`)
  - ingest srcHash
- **Media**:
  - TTS: ElevenLabs `with-timestamps` turns character alignment into words in ms. It probes `GET /v1/models` and prefers v4 turbo/flash, with `eleven_flash_v2_5` as the default. Kokoro (DeepInfra) is used for FREE.
  - Assets: Nano Banana (Gemini), Recraft, Pexels and Pixabay are downloaded to R2 with license and attribution metadata.
  - Audio: `musicPicker` (Music table, 5-min cache, mood/BPM, seeded per channel) and `beatSync` (ms).
- **Addendum (3 starting points)**: `prompt` auto-picks the format. `audio` uses ingest (loudnorm mp3 to `narration/{id}.mp3`) → Groq Whisper (Workers AI fallback) → transcript beats → the upload is the voice track. `video` does the following:
  - probe, then normalise to 1080x1920@30 (scale, center crop or blur-pad), stored as a `user-video` asset
  - transcribe, then build an edit plan of keep / cut-ins (by `insertDensity`) / overlays
  - trim and concatenate the kept speech as narration, with words remapped to the edited timeline
  - build a ScenePlan that interleaves `video-segment` scenes with HF cut-ins and `overlay-*` scenes
  - pass `media: {userVideo, speechAudioUrl}` to `composeVideo`
- **QC**: TF-IDF originality is computed over the script plus block bigrams against the last 30 videos. A policy linter checks for advisor phrasing, "as an AI" and missing sources. AI labels are set only for AI-realistic imagery.
- **Cuts**: the same master is used for YT/TikTok/IG, plus per-platform metadata. The thumbnail is an ffmpeg frame uploaded to `videos/{id}/thumb.jpg`.
- **Packaging and docs**: added a `Dockerfile` (node 24, ffmpeg, chromium and fonts; it runs TS through tsx) and `scripts/smoke.ts` (full mode or `--offline [--render]`). Appended entries to `docs/ENV.md` and `docs/REQUESTS.md`.

## Verified
- `pnpm --filter @remawt/engine typecheck` passes. The tsconfig was switched to `moduleResolution: Bundler`, because the ESM workspace packages use imports without file extensions.
- Re-run after the shim removal: typecheck passes, the 24 tests pass, offline smoke passes (compose+lint ok), and the server boots with 15 Inngest functions.
- 24 unit tests pass (`node --test`). They cover beat allocation and word-gap snapping, caption chunking, character→word alignment, originality, pricing (including DeepSeek off-peak), transcript segmentation and timeline remap, the cut-in target, fit choice, ffmpeg argv, the policy linter and the video edit plan.
- The server boots. `/health` works, and `/api/inngest` registers 15 functions in dev mode. Bearer auth rejects requests that have no key.
- `smoke --offline --render`: canned script → align → **real hf-kit `composeVideo` → lint ok** → **local `hyperframes render` + ffmpeg mux** produced a 1080x1920 30fps 30.3s mp4. A sampled frame shows headline, captions and watermark.
- A live Mastra → Anthropic call reached the API, but the `ANTHROPIC_API_KEY` in `apps/engine/.env` is **invalid** (401). LLM output quality is therefore unverified.

## Not verified / stubbed
- Not run end to end against a database: the `DATABASE_URL` in `apps/engine/.env` looks like the v1 database. No v2 run, Inngest dev-server run, suspend/resume round trip, refund, or publish/metrics/series run against a real DB.
- Not called with a real request yet: ElevenLabs (it has a key, but I did not spend), Kokoro, Groq/Workers STT, Gemini, Recraft, Pexels, Pixabay, ElevenLabs SFX and PostHog.
- The Gemini image model id (`NANOBANANA_MODEL`) and the Recraft model/size are unverified.
- Video/audio ingest has no test with a real file: ffmpeg argv is unit-tested, but the full chain is not.
- Shims were removed in the follow-up. `lib/hfkit.ts` is a thin binding to `@remawt/hf-kit`, and `lib/publisher.ts` calls `createPublisher(env)`. Radar is called directly: `refreshNiche` and `ideasForChannel`, with `runTagger`/`runIdeator` injected.

## Open
- `Channel.publisherProfileId` is now used. `/v1/social/connect` stores it from the `connect()` result, and `/v1/social/sync` reads it with no re-connect (it returns 409 if the profile is missing).
- `Video.sourceKind/sourceUrl/source/transcript` are now real columns. `lib/videoSource.ts` reads and writes them directly; the `qc._source/_transcript` mirror and the casts are gone.
- The critic is not given rendered keyframes yet. The API supports images, but no pre-render keyframe capture exists.
- The TikTok 60s+ cut is only flagged (`cuts.tiktok.needsLongCut`). The Batch API / DeepSeek off-peak queueing for scheduled jobs is not implemented.
