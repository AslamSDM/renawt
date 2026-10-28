# remawt v2 — faceless content platform

Pick a niche → build a Channel Identity Kit → AI makes motion-graphics shorts (HyperFrames) from an idea, an uploaded recording, or a voice note → Niche Radar suggests what to make → schedule + publish to TikTok / Shorts / Reels → metrics feed back.

Plan: `docs/PIVOT_PLAN.md`. Build contract: `docs/BUILD.md`. Design contract: `docs/DESIGN.md`. Research: `docs/research/`. Per-area status: `docs/status/`. Env: `docs/ENV.md`.

## Layout
| Path | What |
|---|---|
| `apps/web` | Next 16 (Vercel). Auth.js, Prisma, Dodo, app UI |
| `apps/engine` | Express + Mastra + Inngest (ECS). Pipeline, radar, publishing, series |
| `packages/db` | Prisma schema + migrations (single source of truth) |
| `packages/shared` | zod contracts: IdentityKit, FORMATS, NICHES, PLANS, pipeline + API DTOs |
| `packages/hf-kit` | HyperFrames 9:16 kit: 15 blocks, captions, lint, render client, demos |
| `packages/publisher` | Publisher interface: dryrun, Post for Me, Upload-Post, YouTube direct |
| `packages/radar` | Trend sources, scoring, clustering, idea prompts, bandit |
| `deploy/aws/render-lambda`, `services/*` | render Lambda / render-service / scraper (kept from v1) |
| `legacy/` | v1 code, reference only |

## Run
```bash
pnpm install
pnpm db:generate
# web
cp apps/web/.env.example apps/web/.env   # or fill from docs/ENV.md
pnpm dev                                  # http://localhost:3000
# engine (separate terminal)
pnpm dev:engine                           # http://localhost:3001 ; Inngest dev: npx inngest-cli@latest dev -u http://localhost:3001/api/inngest
# checks
pnpm -r typecheck && pnpm -r test && pnpm --filter @remawt/web build
# hf-kit demos (renders 7 draft MP4s to $TMPDIR/remawt-hfkit-demo)
pnpm --filter @remawt/hf-kit demo
# engine offline smoke (no keys needed)
pnpm --filter @remawt/engine exec tsx scripts/smoke.ts --offline --render
```
Dev UI without a DB: `DEV_BYPASS_AUTH=1` (+ `DEV_BYPASS_EMPTY=1`, `DEV_BYPASS_PLAN=CREATOR`), fake video at `/app/videos/dev-video`.

## Not yet done (see sidequest todos)
- v2 migration `packages/db/prisma/migrations/20261028120000_v2_faceless` is **unapplied** (drops v1 tables; branch Neon first).
- No live LLM/TTS/image/publish calls verified (keys missing or invalid). Offline paths and 177 unit tests are green.
- Vercel root dir → `apps/web`; engine deploy; R2 CORS for browser uploads; Dodo v2 products.
