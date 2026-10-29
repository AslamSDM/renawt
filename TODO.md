# TODO

Open work, grouped. `#n` = sidequest todo id (`sidequest show`). Move items to `PROGRESS.md` when done.

## Next up
- [ ] Free disk space (360 MB left; `hyperframes render` refuses < 1 GB) — user to choose what to clear
- [ ] Render the four 3D demos (`pnpm --filter @remawt/hf-kit demo --only=3d`) and rerun both test ideas at Pro tier (Opus/Sonnet) with the new blocks
- [ ] Commit + push the 3D / layout / no-watermark batch (49 files, uncommitted)
- [ ] Wire `lintPlanText` into the engine repair loop (best-effort `repairScene` pass on text-budget issues)
- [ ] scene-3d: labels can collide mid-orbit (Moon/Earth)
- [ ] Lambda render: confirm software-WebGL flags in `@hyperframes/producer@0.7.37` or bump; ≥ 3008 MB; jsdelivr egress (see docs/REQUESTS.md "3D blocks")
- [ ] Bundle Space Grotesk / Fraunces / Patrick Hand (neon, pastel, chalk skins fail `hyperframes lint` on Google fonts)

## Blocked on user
- [ ] #48 Fish Audio API credit (`s2.1-pro` → 402; dev uses `s2.1-pro-free`)
- [ ] #40 Keys: DEEPSEEK, GROQ (whisper for uploaded video/audio), PEXELS, INNGEST prod, publisher provider key
- [ ] VPS for the engine (4 vCPU / 8 GB; Hetzner CPX31 suggested) or decision to resize the DO droplet
- [ ] #32 Aggregator choice (Post for Me / Upload-Post / Ayrshare) + audited TikTok client in writing
- [ ] #33 File Google OAuth verification + YouTube quota, Meta App Review, TikTok Direct Post audit
- [ ] Local UI test: kill the gistr dev servers on :3000/:3001 so Google sign-in works, or approve the dev-bypass fix (#52)

## Engine / pipeline
- [ ] #49 SFX: clamp ElevenLabs `duration_seconds` to ≥ 0.5 (pop 0.3 s, tick 0.2 s → 400)
- [ ] #50 `cost.ttsUsd` missing from `Video.cost` (Fish step not metered)
- [ ] #45 Render Lambda: honour `assets.videoUrls` + music ducking / SFX timing
- [ ] Progress events: `ready` is logged before `cuts done` (ordering nit)
- [ ] `smoke.ts` still gates voice on ElevenLabs/Kokoro keys; should use Fish like the real step (and its smoke user is Free → Kokoro path)
- [ ] Music bed: last two renders had no music (assets `[]`); confirm picker runs for v2 and the Music table is used
- [ ] Real test of `video` and `audio` sources (needs GROQ key + R2 CORS)

## Web
- [ ] #52 `DEV_BYPASS_AUTH` ignored by middleware (`auth.ts` `authorized` callback)
- [ ] #47 Excalifont in web sketch previews (onboarding falls back to sans)
- [ ] #42 Vercel root dir → `apps/web`; add `ENGINE_URL` / `API_KEY` envs

## Infra / billing / data
- [ ] #43 Deploy engine (Dockerfile) + Inngest app registration + render callback URL
- [ ] #41 R2 bucket CORS (PUT + content-type from app origins)
- [ ] #37 Dodo v2 products (Starter/Creator/Pro/Agency monthly + annual, add-on packs)
- [ ] Clean up local test rows when done: user `localtest@remawt.local`, channels "Local Test Science" / "Local Test Sketch", Subscription `local-test-pro`

## Later
- [ ] Golden-case eval at Pro tier (Sonnet/Opus) across all skins incl. 3D blocks; keep `docs/status/eval-*.md` current
- [ ] Series autopilot + analytics loop UI
- [ ] Voice clone flow (Creator+)
