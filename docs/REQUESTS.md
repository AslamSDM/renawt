# Cross-workstream requests (append; orchestrator resolves)

## From radar (2026-10-28)
1. **db-billing**: add `REDDIT`, `GOOGLE_TRENDS`, `NEWS` to `enum Platform` (or a separate `TrendPlatform` enum for `TrendItem.platform`). Until then radar scores/clusters these items but only persists DB-enum platforms (`DB_PLATFORMS` in `packages/radar/src/persist.ts`). Once added, extend that list.
2. **db-billing**: add optional `meta Json?` to `TrendCard` for `{itemCount, breakoutCount, platforms, keywords, producibleFormat}`. Not blocking: radar derives format trends from `TrendItem.tags` per week (`loadWeekFormatItems`).
3. **db-billing / orchestrator**: note `TrendCard.format` holds a 15-format *taxonomy* id (`packages/radar/src/taxonomy.ts`), which is a superset of `@remawt/shared` FORMATS ids. `Idea.format` is always a FORMATS id. Schema comment on TrendCard.format could say so.
4. **shared owner**: `packages/shared/package.json` lacks `"type": "module"`. Under Node ESM (tsx, engine) named imports from its `export *` index fail ("does not provide an export named FORMAT_IDS"). Radar works around it with `packages/radar/src/shared.ts`; the engine will hit the same thing. Fix: add `"type": "module"` to shared (and db if needed).
5. **engine**: radar has no per-channel bandit storage. Either rebuild arms from MetricSnapshots each run (default in `ideasForChannel`) or persist `Arm[]` somewhere (e.g. `Channel.banditState Json?`) and pass `arms`. Also inject a persistent `QuotaCounter` (Redis/DB) into `createYoutubeQuota()` so the YouTube search bucket is shared across processes.

### Orchestrator resolution (2026-10-28)
- Radar 1: DONE — `Platform` enum now includes `REDDIT`, `GOOGLE_TRENDS`, `NEWS` (migration SQL updated). Radar: extend `DB_PLATFORMS` in `persist.ts`.
- Radar 2: DONE — `TrendCard.meta Json?` added (schema + migration).
- Radar 3: DONE — schema comment updated.
- Radar 4: DONE — `"type": "module"` on `@remawt/shared` and `@remawt/db`. Radar may drop `src/shared.ts` shim.
- Radar 5: engine — rebuild bandit arms from MetricSnapshots per run (default); YouTube quota counter: in-memory for now, persist later.
- Publisher: `Platform` in `@remawt/publisher` is now `Exclude<DbPlatform, "REDDIT"|"GOOGLE_TRENDS"|"NEWS">`.

## From hf-kit (2026-10-28)
1. **render-lambda (deploy/aws/render-lambda)**: `submitRender` now also sends `assets.videoUrls` (user footage the composition streams by https URL for `video-segment` scenes). The producer reads `<video src>` over the network today; for reliability the Lambda could pre-download `videoUrls` into the workdir and rewrite `src` to `assets/…`. Not blocking.
2. **render-lambda**: the muxer `amix`es `assets.audioUrls` at equal weight from t=0 and replaces the producer's own mix, so music ducking (`data-automation`), per-track `data-volume` and SFX offsets in index.html are lost on Lambda. Proposal: if the producer output already has an audio stream, skip the mux (the producer mixes `<audio>` tags itself), or use `mixFilter()` from `@remawt/hf-kit` (adelay + volume + sidechaincompress). Until then the engine should pass only the narration/speech URL (+ music) as `audioUrls`.
3. **render-lambda**: add `callbackUrl` POST is already there; status object shape unchanged (`status/{jobId}.json`). hf-kit jobIds are deterministic `<videoId>-<hash12>` for idempotent resubmits.

## From engine-core (2026-10-28)
1. **db-billing**: the addendum fields `Video.sourceKind String?`, `Video.sourceUrl String?`, `Video.source Json?`, `Video.transcript Json?` are NOT in `packages/db/prisma/schema.prisma` yet (only `VideoStatus.TRANSCRIBING` is). Engine writes them when the columns exist and otherwise mirrors into `Video.qc._source` / `qc._transcript` (see `apps/engine/src/lib/videoSource.ts`). Web should read via the columns once added.
2. **db-billing**: add `Channel.publisherProfileId String?` (provider profile returned by `Publisher.connect`). `/v1/social/sync` currently re-derives it by calling `connect()` again or accepts `providerProfileId` in the body.
3. **web-app**: `/v1/videos/start` requires the Video row to exist and quota already consumed (UsageLedger kind=`video`); engine refunds on failure (UsageLedger kind=`refund`, `videosUsed--`). For `source.kind=prompt` with no chosen format, set `Video.format` to `"auto"` (engine picks one and writes it back).
4. **web-app**: `/v1/kit/voice-sample` body is `{voiceId, provider, text}`; `/v1/social/connect` returns `{url, providerProfileId}`; `/v1/videos/:id/progress` also returns `error` and `masterUrl`.
5. **all**: `VoiceTrack.words[].s/e` and every timing in engine-written JSON (`ScenePlan`, `Transcript`, captions) are **milliseconds**.
6. **render-lambda**: callback `POST {callbackUrl}` with JSON `{jobId, status: "completed"|"failed", videoUrl?, error?}`. The callbackUrl already carries `?videoId=&token=` (HMAC of videoId with API_KEY). Engine also polls `pollRender(jobId)` every 15s for 12 min as fallback.
7. ~~RESOLVED 2026-10-28~~ (schema + client now have the columns; engine mirror removed). **db-billing (engine-core, follow-up)**: `Channel.publisherProfileId` is consumed now (REQUEST 2 resolved). But `Video.sourceKind/sourceUrl/source/transcript` are still missing from `schema.prisma` and the generated client. They exist only in the migration SQL, so the client and the DB will drift. Please add them to the schema and run `prisma generate`. The engine then drops its `qc._source/_transcript` mirror.

## From web-app (2026-10-28)
1. **db-billing**: `packages/db/prisma/schema.prisma` `Video` is missing `sourceKind String @default("idea")`, `sourceUrl String?`, `source Json?`, `transcript Json?` (the migration SQL `20261028120000_v2_faceless` already has them; `TrendCard.meta` is also in SQL but not in the schema). Until they exist, `startVideo` (apps/web/lib/actions/video.ts) stores the `VideoSource` as the first progress event `{step:"source", output: VideoSource}` and the web reads the transcript from the `transcribe` step's `output` (`lib/queries/shapes.ts` `readVideoSource` / `readTranscript`). Once added: write the columns in `startVideo`, switch the two readers, and have the engine keep writing the transcript to `Video.transcript`.
2. **engine**: preserve the leading `source`/`queued` progress events when it overwrites `Video.progress`, and put the Whisper `Transcript` in the `transcribe` step's `output` (or `Video.transcript` after item 1). The progress proxy re-attaches them, but the DB copy is what pages render after the run.
3. **engine**: `POST /v1/publications/schedule` target `meta` from the web carries `{title?, caption, hashtags, aiLabel, aiGenerated, madeForKids, privacy?, allowComment?, allowDuet?, allowStitch?, commercial?, brandedContent?}` (TikTok audit fields). Series posts in APPROVE mode should be created with `meta.needsApproval = true`; the Schedule page approves them (sets `needsApproval:false`, `approvedAt`, `privacy`). The engine must not publish while `needsApproval` is true.
4. **design-foundation**: `components/ui` has no tag/chip input. Built `components/app/chip-input.tsx` on `fieldClasses`; promote it to `components/ui` if you agree.
5. **design-foundation**: `APP_ROUTES.newVideo` is `/app/videos/new`; the page lives at `/app/new` (as the spec says) and `/app/videos/new` redirects. Point `APP_ROUTES.newVideo` at `/app/new` to save the hop.
6. **db-billing**: `/api/billing/portal` returns to `/app/billing`; the page is `/app/settings/billing`.
7. **infra**: R2 bucket CORS must allow `PUT` with `content-type` from the app origins for direct browser uploads (`/api/app/uploads` presigns). Env: `ENGINE_URL`, `API_KEY` (already used), `DEV_BYPASS_AUTH` (dev only).
