# radar — status (2026-10-28)

Owner: radar agent. Scope: `packages/radar/**` only. Not committed.

## Verified
- `pnpm --filter @remawt/radar typecheck` passes (tsconfig now includes `test/`).
- `pnpm --filter @remawt/radar test` passes: 62 tests (`node --import tsx --test "test/**/*.test.ts"`).
- No LLM SDK, no Mastra. The only runtime deps are zod, @remawt/shared and @remawt/db (type-only). HTTP uses global `fetch`, which can be injected.

## Not verified
- No live API calls were made. The YouTube, Reddit, DataForSEO, Exa and Apify parsers are tested against hand-made fixtures in `test/fixtures/` that follow the documented response shapes.
- `persist.ts` is tested against a fake Prisma only. It has not run against Neon.

## Layout
| File | What |
|---|---|
| `src/types.ts` | Additive changes: `RadarPlatform` (DB `Platform` plus REDDIT/GOOGLE_TRENDS/NEWS), item `kind` (content/signal/evidence), `TaggedTrendItem`, `TrendCardDraft`, `SourceContext`, `QuotaCounter`, optional `TrendSource.isConfigured`. |
| `src/sources/youtube.ts` | `youtubeMostPopular` (one call per region, uses the niche's category), `youtubeBreakout` (search.list for the last 7 days, short videos ordered by viewCount, then videos.list, then channels.list to get a median proxy = channel views ÷ video count). Cached per niche for 6h. |
| `src/quota.ts` | `QuotaBudgeter`: day key in Pacific time, buckets `default` 10k and `search` 100 with 10% held in reserve, in-memory tally, optional injected persistent `QuotaCounter` with rollback when two processes race. |
| `src/sources/reddit.ts` | Reads rising and top-of-week listings. Uses public JSON with a User-Agent, or app-only OAuth when the client id and secret are set. Skips NSFW and stickied posts. `views` holds the post score. |
| `src/sources/googleTrends.ts` | DataForSEO explore/live with up to 5 keywords per task. Rising queries become `signal` items. |
| `src/sources/exa.ts` | Exa news search for the last 7 days. Results become `evidence` items. |
| `src/sources/apifyTiktok.ts` | Needs both `APIFY_TOKEN` and `RADAR_ENABLE_SCRAPERS=1`. The file comments the ToS risk. |
| `src/sources/index.ts` | `SOURCES` (6 sources with cadence and `isConfigured`), `configuredSources`, `dueSources`. |
| `src/score.ts` | Computes age, velocity, outlier (fallback: niche median per platform), z-score on log velocity against a per-platform baseline, and cross-platform corroboration. Dedupes by URL and by near-identical titles. Exports `computeBaseline` and `mergeBaselines`. |
| `src/taxonomy.ts` | The 15 formats with regex hints, `guessFormat`, and `producibleFormat`, which maps each format to a shared FORMATS id. |
| `src/prompts.ts` | `buildTagPrompt` + `TagResultSchema` + `parseTagResult` (lenient). `buildIdeaPrompt` + `IdeaResultSchema` + `parseIdeaResult`: allows only FORMATS ids, allows only evidence URLs that appear in the cards, dedupes against recent titles, applies advice-niche rules and risk flags, and passes the format mix through. |
| `src/cluster.ts` | `clusterItems`: groups by exact topic key or by Jaccard ≥ 0.5 against the cluster seed. Card score = Σ outlier×log-velocity×corroboration. Keeps the top 3 exemplars and takes the mode format. `formatTrends`: week-over-week share deltas. |
| `src/bandit.ts` | Thompson sampling over format×topic arms. Reward = outlier/(outlier+1). Seedable RNG. `maxShare` keeps the mix diverse. |
| `src/week.ts` | `weekKey` (ISO week), `previousWeekKey`, `weekStart`. |
| `src/persist.ts` | Every function takes the Prisma client as an argument: `upsertTrendItems`, `writeTrendCards` (updates in place so Idea links survive; deletes stale cards only when no ideas reference them), `loadTrendCards`, `loadWeekFormatItems`, `createIdeas`, `loadRecentTitles`, `loadChannelOutcomes`. |
| `src/index.ts` | `refreshNiche` and `ideasForChannel` orchestrators. `heuristicTags` is the fallback when the tagger fails. |
| `src/shared.ts` | Interop shim for @remawt/shared, which loads as CJS under Node ESM. See REQUESTS #4. |

## Engine integration
```ts
import { refreshNiche, ideasForChannel, createYoutubeQuota } from "@remawt/radar";
await refreshNiche({ niche: "ai-tools", env: process.env, prisma, runTagger: (p, schema) => router.cheap.object(p, schema),
  ctx: { youtubeQuota: createYoutubeQuota(redisCounter) }, cadences: ["daily"] });
await ideasForChannel({ channel, prisma, runIdeator: (p, schema) => router.strong.object(p, schema), count: 10 });
```
`p` is `{system, prompt, maxOutputTokens}`. `schema` is a zod object whose root is `{tags: [...]}` or `{ideas: [...]}`. The parsers also accept a bare array.

## Known gaps / follow-ups
- TrendItems on REDDIT, GOOGLE_TRENDS and NEWS are not persisted. The DB enum does not have these values (REQUESTS #1).
- `TrendCard.format` stores the taxonomy id. `Idea.format` stores the FORMATS id.
- Clustering is lexical. Embeddings/HDBSCAN can replace it later behind the same signature.
- YouTube `videos.batchGetStats` velocity re-polls are not implemented.
- Instagram hashtag scraping and TikTok Creative Center sounds are not implemented.
- The YouTube creator median is a mean-based proxy, which makes outlier scores conservative. The TikTok creator median is estimated as 10× (hearts ÷ videos).
- Bandit state is not persisted (REQUESTS #5).
