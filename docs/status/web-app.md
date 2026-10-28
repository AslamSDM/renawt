# Status: web-app

## What exists
**Data layer**
- `apps/web/lib/engine.ts`: a typed client for every route in the BUILD.md API table. It sends `Authorization: Bearer API_KEY` and `x-user-id`, has a 20s timeout, and never throws. It returns `{ok:false, reason}` when `ENGINE_URL` is unset or the engine fails, and the UI shows that reason in a toast.
- `lib/queries/*`: Prisma loaders scoped by the session user.
  - `viewer.ts` handles the session and dev bypass.
  - `channels.ts`: the active channel comes from the `remawt_channel` cookie.
  - `shapes.ts` has zod readers for every Json column.
  - Also: `billing`, `home`, `radar`, `analytics`, `tz` (Intl-only time-zone maths) and `format`.
- `lib/actions/*`: zod-validated server actions that call `revalidatePath`, in `channel`, `video`, `ideas`, `radar`, `publish`, `series`, `social` and `kit`.
  - `startVideo` checks entitlements, clamps quality and length to the plan, creates the `Video` with status QUEUED, calls `consumeVideo`, then calls the engine. If the engine fails, it refunds the video and marks it FAILED.
- API routes:
  - `api/app/uploads`: presigned R2 PUT to `uploads/{userId}/{channelId}/{uuid}.{ext}`. Checks type and size: video ≤2GB, audio ≤200MB.
  - `api/app/videos/[id]/progress`: proxies the engine's progress and falls back to the DB.

**Pages** (each has `loading.tsx` + `error.tsx` and empty states)
- `/onboarding`: 7-step wizard (zustand, persisted to sessionStorage) with a progress rail. Validates with `IdentityKitSchema`, calls `createChannel`, then goes to `/app`.
- `/app`, `/app/new`, `/app/radar`, `/app/ideas`, `/app/videos`, `/app/videos/[id]`, `/app/schedule`, `/app/analytics`, `/app/series`.
- `/app/settings` redirects to `/app/channels/[id]/settings`. `/app/videos/new` redirects to `/app/new`.
- `/app/settings/billing` and `/pricing`.
- `app/(app)/app/layout.tsx` feeds `<AppShellData>`. `ChannelSync` writes the channel cookie when the sidebar switcher changes.
- The publish drawer covers the TikTok audit checklist:
  - account avatar and handle
  - privacy selector with no default
  - comment / duet / stitch toggles
  - commercial disclosure with the Promotional content / Paid partnership notices
  - consent checkbox
  - AI-label toggle, prefilled from `qc.labels`
  - a notice that posts can take a few minutes to appear
- Approving a TikTok post from the Schedule page asks for privacy and consent again.
- Shared components are in `components/app/**`. The kit editors (niche, skin, voice, persona, mascot) are reused by onboarding and channel settings.

## Verified
- `pnpm --filter @remawt/web typecheck` and `pnpm --filter @remawt/web build` pass. ESLint is clean on all files I own.
- Puppeteer screenshots at 1440 and 375 cover `/pricing`, `/onboarding` (niche, look, persona and review steps) and all 10 app routes.
  - No horizontal scroll at either width.
  - No console or page errors.
  - Run in dev bypass with a fixture channel, and also with no channel.

## Not verified
- No real DB: the v2 migration has not been applied to Neon.
- No engine, no R2 upload, no Dodo checkout.
- The video detail page with real data: it returns 404 in bypass mode.

## DEV_BYPASS_AUTH
`DEV_BYPASS_AUTH=1` (ignored in production) makes my loaders skip Prisma. They return empty data and an in-memory fixture channel; set `DEV_BYPASS_EMPTY=1` to get no channel instead. Every mutation returns "read-only".

The middleware still requires a session cookie. For screenshots I minted one with `next-auth/jwt` `encode` and `AUTH_SECRET`.

## Open items
See `docs/REQUESTS.md` → "From web-app". The main one: the `Video.sourceKind/sourceUrl/source/transcript` columns exist in the migration SQL but not in `schema.prisma`. Until they are added, the source is stored as the first progress event.
