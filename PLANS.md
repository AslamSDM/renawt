# remawt v2 — Plans

Live plan for the faceless short-form platform. Long-form rationale, research and the 16-week roadmap live in `docs/PIVOT_PLAN.md`; this file is the short, current version. Update it when direction changes, not for day-to-day status (that is `PROGRESS.md`; open work is `TODO.md`).

## Thesis (unchanged since 2026-10-28)
Camera-shy, non-technical creators pick a niche, build a persistent Channel Identity Kit (look, voice, persona), and get motion-graphics explainers (HyperFrames, not AI-image slideshows) from an idea, a recorded video, or a voice note. Niche Radar suggests what to make; a scheduler publishes to TikTok / Shorts / Reels; metrics feed back. Whitespace: motion graphics + identity + trend loop, while competitors (faceless.so, Fastlane, AutoShorts…) commoditise on slideshow output that YouTube's inauthentic-content enforcement now penalises.

## Product decisions in force
| Area | Decision | Date |
|---|---|---|
| Stack | pnpm monorepo: `apps/web` (Next 16, Vercel), `apps/engine` (Express + Mastra + Inngest), `packages/{db,shared,hf-kit,publisher,radar}` | 10-28 |
| AI | Claude (Haiku 5.5 classify/repair, Sonnet 5.5 script/plan/compose, Opus 5.5 premium + critic) with DeepSeek fallback chains; prompt caching on the HF skill prompt | 10-28 |
| TTS | Fish Audio default (native word timestamps). ElevenLabs/Kokoro optional. ElevenLabs only for SFX | 10-28 |
| Visual styles | Skins: ledger, paper, neon, chalk, terminal, pastel, **sketch**, **sketch-paper** (Excalidraw hand-drawn, one line written at a time via excalidraw-animate ordering → GSAP) | 10-28 |
| 3D | Add Three.js blocks: `chart-3d`, `globe-3d`, `stat-3d`, `scene-3d`; planner picks whichever suits the beat | **10-29** |
| Watermark | **None on any tier** (Free keeps draft quality + 3 videos/month cap) | **10-29** |
| Starting points | idea (from radar) · prompt (typed) · video (user recording, motion graphics inserted) · audio (voice note as narration) | 10-28 |
| Pricing | Meter videos, not credits. Free 3 / Starter $24 / Creator $49 / Pro $99 / Agency $199 + add-on packs. Dodo | 10-28 |
| Publishing | `Publisher` interface; aggregator first (Post for Me / Upload-Post), YouTube direct later; TikTok audit UX rules baked in | 10-28 |
| Render | Local `hyperframes render` + ffmpeg in dev; AWS Lambda (existing) or a 4 vCPU / 8 GB box for 1 concurrent render in prod. DigitalOcean Functions rejected (1 GB / 48 MB limits) | 10-28 |
| Data | v1 tables kept; v2 migration applied non-destructively to Neon prod | 10-28 |

## Milestones to production
1. **Quality bar** (now): no overflow/orphan layouts, 3D blocks, no watermark, Pro-tier (Sonnet/Opus) renders look good on 10 golden ideas across ledger + sketch skins.
2. **Local UI loop**: Google sign-in locally (port 3000) or working dev bypass; create → watch progress → preview → edit script/scenes → re-render, from the browser.
3. **Keys + credit**: Fish credit, Groq (whisper for uploads), DeepSeek, Pexels; prod Inngest keys.
4. **Deploy**: Vercel root dir → `apps/web` + envs; engine on a 4 vCPU / 8 GB VPS (Dockerfile exists) with Inngest app registration; R2 CORS for browser uploads; render Lambda `videoUrls` + ducking (#45).
5. **Billing**: Dodo v2 products + webhook → `Subscription` rows; allowance rollover.
6. **Distribution**: choose aggregator (#32), file Google OAuth / Meta / TikTok reviews (#33); dryrun publisher until then.
7. **Radar live**: YouTube key is live; add Reddit/Exa refresh on a schedule; idea feed in UI.
8. **Launch**: landing + pricing live, free tier open, metrics loop.

## Not doing
- Remotion, jitter, screen recording, Veo reels, 3D (legacy v1) — all in `legacy/`, reference only.
- AI-image slideshows as a primary format.
- Credits-based billing.
