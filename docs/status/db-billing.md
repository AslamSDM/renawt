# db-billing status

## IMPORTANT: migration is NOT applied
`packages/db/prisma/migrations/20261028120000_v2_faceless/migration.sql` is written but unapplied.
Nothing was run against the database except read-only introspection (`prisma migrate diff --from-url`).
`migrate:dev` was removed from `packages/db/package.json` because `apps/web/.env` points at prod.

### Destructive statements in the migration
- `DROP TABLE "Generation"`, `"JitterDocHistory"`, `"ProductImage"`, `"Project"`, `"ScreenRecording"` (v1 data)
- `DROP INDEX "llm_calls_projectId_idx"` (the column and rows are kept: `LlmCall.projectId String?` was added to the schema)
- `ALTER TABLE ... DROP CONSTRAINT <fk>` on Account, CreditPurchase, Subscription (+ the dropped v1 tables).
  The schema uses `relationMode = "prisma"`, so Prisma drops the real FKs that prod still has. No rows are lost.
- Kept tables (User, Account, Subscription, CreditPurchase, WebhookEvent, Music, llm_calls) only get `ADD COLUMN`s that are nullable or have defaults.
- At the end, an `UPDATE "User"` backfills `videoAllowance` for active subscribers whose v1 plan name matches a v2 plan id. Other names keep 3.

### Notes for whoever applies it
- I generated the diff against **prod itself**, not the legacy schema. Prod has drift: a `JitterDocHistory` table and real FKs that no migration file creates.
  Drops use `IF EXISTS`, so the file also runs on a DB built from `legacy/web/prisma/schema.prisma`.
- The existing migration history is inconsistent. `20260208082356_werj` is SQLite SQL (`DATETIME`), so `--from-migrations` with a shadow DB cannot replay it.
  Check `_prisma_migrations` in prod before you run `migrate deploy`. You may need `prisma migrate resolve` for older entries.
- Back up or branch the Neon DB first (a Neon branch is cheap).

## Done
- Schema (`packages/db/prisma/schema.prisma`): passes `prisma validate`. Every relation scalar was already indexed. I added only optional or defaulted items:
  `Subscription.dodoCustomerId?`, `dodoProductId?`, `cancelAtPeriodEnd`, `updatedAt`, `@@index([dodoSubId])`; `UsageLedger @@index([videoId])`; `LlmCall.projectId?`.
- Client: `packages/db/src/client.ts` exports `getPrisma()` (cached on globalThis, log level set by NODE_ENV, `PRISMA_LOG_QUERIES`) and `withDbRetry`. `src/index.ts` re-exports `@prisma/client`.
  `apps/web/lib/db/prisma.ts` exports `prisma = getPrisma()`. `lib/db/index.ts` is now a re-export only (the v1 credit helpers are gone).
- Auth (`apps/web/auth.ts`): Google + PrismaAdapter. `session.user.id` and `creditBalance` are typed through an `@auth/core/types` augmentation (I added the `@auth/core@0.41.0` dep, the same version next-auth uses).
  On `createUser`: sets `videoAllowance=3`, then sends the welcome email.
  `authorized` protects `/app` and `/onboarding`. `/api/*` passes through, and each route returns its own 401.
- `middleware.ts` matcher: `/app/:path*`, `/onboarding/:path*`, `/api/billing/:path*`, `/api/app/:path*`.
- Removed `app/api/auth/vps-token` (the engine uses the server-side `API_KEY` bearer).
- Billing (`apps/web/lib/billing/`):
  - `getEntitlements` runs a lazy 30-day reset first.
  - `resetPeriodIfExpired` uses an optimistic lock on `usagePeriodStart` and writes `reset` and `rollover` ledger rows.
  - `consumeVideo` is a raw conditional UPDATE `videosUsed < videoAllowance + rolloverVideos`, idempotent per videoId.
  - `refundVideo` is idempotent. `consumeAddonCredits` runs a `gte` guard plus a ledger row. `canRerender` is also here.
  - `subscriptions.ts` holds the webhook state transitions and `resetAllExpiredPeriods`.
  - Rollover rule: rollover videos are used first and expire after one period. Unused allowance carries over, capped at min(unused, allowance). Free never rolls over.
- Dodo:
  - `lib/dodo/subscription.ts`: the catalog comes from `PLANS`/`ADDONS` and the `DODO_PRODUCT_*` env ids, with a reverse lookup `resolveProduct`.
  - `lib/dodo/index.ts`: `createCheckoutSession(userId, planId|addonId, billing)` and `createPortalLink` (the SDK supports `customers.customerPortal.create`).
- Webhook (`app/api/dodo/webhook/route.ts`): `Webhooks()` verifies the signature. `WebhookEvent` insert and effect share one transaction for idempotency.
  - `subscription.active`: upsert Subscription, set allowance, start a fresh period.
  - `subscription.renewed`: same as active, plus rollover. It skips the reset if a lazy reset ran in the last 3 days.
  - `plan_changed`: allowance only. `updated`: syncs period end and the cancel flag. `on_hold`: status only.
  - `cancelled`, `expired`, `failed`: FREE, allowance 3.
  - A one-time `payment.succeeded` with no subscription_id grants addon credits: `creditBalance +=`, a CreditPurchase row, and a ledger row.
- Routes:
  - `GET /api/billing/entitlements`
  - `POST /api/billing/checkout {planId|addonId, billing, returnUrl?}`
  - `GET|POST /api/billing/portal → {url}`
  - `POST /api/billing/reset` (Bearer API_KEY)
  - `/api/dodo/checkout_session` is kept as an alias of the checkout route.
- Seed: `packages/db/scripts/seed-music.ts`, run with `pnpm --filter @remawt/db seed:music` (I added the tsx devDep). I did not run it.
- I appended the env names to `docs/ENV.md`.

## Verified
- `prisma validate`, `prisma format`, `pnpm --filter @remawt/db generate`, `pnpm --filter @remawt/db typecheck`: all pass.
- `pnpm --filter @remawt/web typecheck`: no errors in db-billing files. The remaining errors are in other owners' files: `components/layout/grid.tsx`, `components/layout/stack.tsx`, and `lib/storage/r2.ts` (missing `@aws-sdk/client-s3`).
- Rollover math was spot-checked with tsx.

## Open / not verified
- The webhook, checkout and portal have not been tested against Dodo test mode. The Dodo product ids still need to be created and put in env.
- `subscription.cancelled` downgrades right away, as the spec says. If Dodo sends it when a user chooses cancel-at-period-end, users lose quota early. In that case consider downgrading on `expired` only.
- `consumeVideo` idempotency is check-then-insert inside a transaction. Two concurrent calls for the same videoId could double-count. Callers should consume once per video, for example in an engine step keyed by videoId.
- Middleware imports `auth.ts`, which imports Prisma (the jwt callback does a DB read). This is the same setup as v1 production. If the edge runtime complains, switch to Next 16 `proxy.ts` or split the auth config.
- `lib/email` subscription copy still says "credits have been added". That file has no owner.
- Engine ESM: `@remawt/db` ships TS source with an extensionless `./client` import. This works under tsx or a bundler, not plain `node`.
