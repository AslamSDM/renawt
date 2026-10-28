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
