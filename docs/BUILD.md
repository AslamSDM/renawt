# remawt v2 — Build Guide (for all agents)

Read `docs/PIVOT_PLAN.md` first. This file is the contract between parallel workstreams.

## Layout
```
apps/web            @remawt/web     Next 16 App Router, Vercel. Auth.js (Google), Prisma via @remawt/db, Dodo, PostHog.
apps/engine         @remawt/engine  Express + Mastra + Inngest. ECS. All AI/pipeline/publishing/radar work runs here.
packages/db         @remawt/db      Prisma schema (SINGLE source of truth) + client. Edit schema only via the DB owner.
packages/shared     @remawt/shared  zod contracts: IdentityKit, FORMATS, NICHES, PLANS, pipeline types, API DTOs.
packages/hf-kit     @remawt/hf-kit  HyperFrames 9:16 kit: skill prompt, format blocks, project scaffold, lint, render client.
packages/publisher  @remawt/publisher  Publisher interface + adapters (dryrun, postforme, uploadpost, youtube_direct later).
packages/radar      @remawt/radar   Trend ingest sources, scoring, clustering, idea generation helpers.
services/render-lambda (deploy/aws/render-lambda) kept; services/render-service kept; legacy/ = v1 reference only (DO NOT import from legacy; copy+adapt).
```

## Rules for every agent
1. Own only your directories (ownership table below). If you need a change elsewhere, write the exact request into `docs/REQUESTS.md` (append) and continue with a local stub/interface.
2. Contracts live in `@remawt/shared` and `@remawt/db`. Extend, never break. If you must add a field, add it optional.
3. `pnpm install` is already run at root. To add a dep: edit your package.json then run `pnpm install --filter <your-pkg>` from repo root. If the lockfile is locked by another process, wait and retry.
4. Node 24, pnpm 10. ESM in engine/packages (`"type": "module"` in engine). Web is Next default.
5. Every paid external call (LLM, TTS, image, render, publish) must be idempotent: key by `(videoId, step, contentHash)` and check R2/DB before paying again.
6. Secrets from env only. Never commit `.env`. Env names in `docs/ENV.md` (append yours).
7. Legacy code: `legacy/web` and `legacy/generate-server` are reference for porting (R2 client, ElevenLabs, music picker, beatSync, sfx, hfRenderClient, hfProject, progress, Dodo, auth). Copy and adapt into the new package; keep the behaviour, drop Remotion/jitter/recording/3D.
8. Run `pnpm --filter <pkg> typecheck` before you report done. Report what is verified vs not.
9. Do not commit. The orchestrator commits.

## Ownership
| Area | Owner agent | Dirs |
|---|---|---|
| Design system + landing + shell | design-foundation | `apps/web/app/globals.css`, `apps/web/components/ui/**`, `apps/web/components/layout/**`, `apps/web/app/page.tsx`, `apps/web/app/layout.tsx`, `apps/web/components/Navbar.tsx`, `Footer.tsx`, `docs/DESIGN.md` |
| Web app pages | web-app | `apps/web/app/(app)/**`, `apps/web/app/onboarding/**`, `apps/web/app/pricing/**`, `apps/web/app/api/**` (except auth/dodo), `apps/web/lib/engine.ts`, `apps/web/lib/actions/**`, `apps/web/components/app/**` |
| DB, auth, billing | db-billing | `packages/db/**`, `apps/web/auth.ts`, `apps/web/middleware.ts`, `apps/web/lib/dodo/**`, `apps/web/lib/db/**`, `apps/web/lib/billing/**`, `apps/web/app/api/auth/**`, `apps/web/app/api/dodo/**`, `apps/web/app/api/billing/**` |
| Engine + pipeline | engine | `apps/engine/**`, `packages/hf-kit/**` |
| Publisher | publisher | `packages/publisher/**` |
| Radar | radar | `packages/radar/**` |
| Design QA (final) | design-qa | read everything in `apps/web`, fix spacing/alignment/cohesion anywhere in `apps/web` |

## Engine HTTP API (web → engine)
Auth: `Authorization: Bearer ${API_KEY}` + `x-user-id: <userId>`. JSON. Engine validates with zod schemas from `@remawt/shared` (`api.ts`).
| Method | Path | Body / Returns |
|---|---|---|
| POST | `/v1/videos/start` | `StartVideoRequest` → `{videoId, runId}`. Creates Inngest/Mastra run; writes `Video.progress` as it goes. |
| POST | `/v1/videos/rerender` | `RerenderRequest` → `{runId}`. Re-runs compose→render with edited scenes/script. |
| GET | `/v1/videos/:id/progress` | → `{status, progress: ProgressEvent[]}` (web polls every 2s). |
| POST | `/v1/kit/previews` | `KitPreviewRequest` → `KitPreviewResponse`. Renders 1 draft poster (PNG via draft render) per skin, niche copy. |
| POST | `/v1/kit/voice-sample` | `{voiceId, provider, text}` → `{audioUrl}` |
| GET | `/v1/voices` | → `[{voiceId, name, provider, previewUrl, tags}]` |
| POST | `/v1/radar/refresh` | `RefreshRadarRequest` → `{queued: niches[]}` (Inngest event) |
| GET | `/v1/radar/:niche?week=` | → `{cards: TrendCard[]}` |
| POST | `/v1/ideas/generate` | `GenerateIdeasRequest` → `{ideaIds}` |
| POST | `/v1/publications/schedule` | `SchedulePublicationRequest` → `{publicationIds}`; engine `sleepUntil` + publish via Publisher |
| POST | `/v1/publications/:id/cancel` | → `{ok}` |
| POST | `/v1/social/connect` | `{channelId, platform, returnUrl}` → `{url}` (hosted OAuth from provider) |
| POST | `/v1/social/sync` | `{channelId}` → upserts SocialAccount rows from provider |
| POST | `/v1/series/tick` | internal cron (Inngest) |
| POST | `/webhooks/render` | render Lambda completion callback → resumes run |
| POST | `/webhooks/publisher/:provider` | provider callbacks |
| GET | `/health` | |

Web reads DB directly (Prisma) for all lists/details; engine is only for actions that run AI/pipeline/publishing.

## Pipeline (engine) — Mastra workflow on Inngest
`ideate? → script → parallel[voice, plan] → assets → compose → lint/critic (≤2) → render (SQS→Lambda; suspend) → qc → cuts → READY`
Write a `ProgressEvent` to `Video.progress` at every step start/done/fail. Update `Video.status` accordingly. Costs go into `Video.cost` and `llm_calls`.

## Design contract
`docs/DESIGN.md` (written by design-foundation agent) defines tokens, spacing scale, containers, page shell, section rhythm, and the component list. All web pages MUST use `components/layout/*` primitives (PageShell, PageHeader, Section, Stack, Grid, Card) and the spacing scale. No ad-hoc paddings.
