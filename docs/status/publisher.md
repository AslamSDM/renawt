# Status: publisher (`packages/publisher`)

_2026-10-28_

## Done
- `src/types.ts`: the `Publisher` interface, extended additively only. New: `PublishMeta` TikTok toggles, branded content, IG `shareToFeed`, YT `description/tags/categoryId`, `pinterestBoardId`. Also `privacy` + `followers|unlisted`, `ConnectRequest.providerProfileId?`, `ConnectedAccount.status?`, `metrics(…, ctx?)`, optional `cancel()`, `PublisherError`.
- Adapters:
  - `dryrun` (stateless and deterministic; ids encode platform and publish time; seeded growth curve plus retention)
  - `postforme` and `uploadpost` (both built from the vendors' OpenAPI specs)
  - `youtube` (direct: OAuth, refresh, resumable upload with native `publishAt`, status, stats plus Analytics retention, revoke; flagged `experimental`)
- `meta.ts`: per-platform limits, brand stripping, hashtag normalisation and dedupe. `caps.ts`: default caps and `checkCap`. `scheduler.ts`: Intl-only `nextSlots` (DST-safe), `spreadAcrossPlatforms`, rolling-window `isWithinCap`. `retry.ts`: jittered backoff, Retry-After, idempotency-key passthrough. `validate.ts`: TikTok privacy is required (audit rule), and the URL must be https.
- `index.ts`: `createPublisher(env)`, `getPublisher(id, env, opts)`, `resolvePublisherId`, the `PUBLISHERS` capability matrix, and re-exports.
- Tests: 35 passing (meta limits, caps, scheduler across NY/Berlin/Sydney/Kolkata DST, dryrun end-to-end, mocked-fetch URL/method/body for publish, status, metrics and connect on all three real adapters, retry semantics). `typecheck` is clean.
- `README.md` (provider switching, id conventions, verified/UNVERIFIED list, TikTok audit UX checklist) and the env names appended to `docs/ENV.md`.
- `package.json`: added `"type": "module"`.

## Not verified
- No live calls to any provider, because there are no API keys. The UNVERIFIED items are listed in the README: PFM idempotency header, PFM `redirect_url_override` behaviour, Upload-Post `tags[]` encoding, Upload-Post job status before execution, Upload-Post retention key, YouTube `videos.delete` scope.
- Upload-Post TikTok compliance and white-label still need written confirmation (PIVOT_PLAN §10).

## Notes for other agents
- Engine (`apps/engine/src/lib/publisher.ts`) already calls `createPublisher(process.env)`. That works unchanged. Store `ConnectResult.providerProfileId` (needed by `listConnectedAccounts`). Pass `{providerAccountId, publishedAt}` to `metrics()`.
- With PFM or Upload-Post, scheduling is native at the aggregator (`scheduledAt` is forwarded). The engine can also publish at slot time instead.
- `youtube_direct` needs a `tokenStore` from the engine, backed by encrypted `SocialAccount.tokens`, and an OAuth callback route that calls `exchangeCode(code)`.
- Web: TikTok publish UI must satisfy the README checklist. `privacy` has no default.
