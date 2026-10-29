# PROGRESS

Dated log of what landed and the current state. Newest first. Per-area detail: `docs/status/*.md`.

## Current state (2026-10-29)
- Branch `pivot/faceless` at `b893fa2` + **49 uncommitted files** (3D blocks, layout/overflow fixes, watermark removal, tracking docs). Typecheck clean across all 7 projects.
- **Disk full** (360 MB free on the Data volume): `hyperframes render` refuses to start; renders blocked until space is freed.
- **End-to-end verified locally**: prompt → script → Fish voice → plan → align → assets → compose → lint → local render → QC → cuts → READY. ~4.5 min per 35 s video. Two renders kept on R2:
  - Ledger skin, "Why the sky is blue": `videos/cmvsgyp8c0004or0s2ib98q3s/master.mp4` (38.4 s)
  - Sketch skin, "How compound interest snowballs": `videos/cmvsh5pzm0004unijga05lru4/master.mp4` (46.1 s)
  - Both ran at **Free → draft tier → Haiku 5.5** for script/plan (~$0.01). Test user now has a Pro subscription row, so reruns use Opus/Sonnet.
- Local run recipe (ports 3000/3001 are taken by another project's dev servers):
  ```bash
  # engine
  cd apps/engine && PORT=3101 APP_URL=http://localhost:3100 CORS_ORIGIN=http://localhost:3100 ENGINE_PUBLIC_URL=http://localhost:3101 pnpm exec tsx watch src/server.ts
  # inngest dev
  npx -y inngest-cli@latest dev -u http://localhost:3101/api/inngest --no-discovery   # UI http://localhost:8288
  # web
  cd apps/web && ENGINE_URL=http://localhost:3101 AUTH_URL=http://localhost:3100 pnpm exec next dev -p 3100
  ```
  Headless test without the UI: seed user/channel/video rows, then `POST /v1/videos/start` with `authorization: Bearer $API_KEY` + `x-user-id`, poll `/v1/videos/:id/progress`.
- Keys live and verified: Anthropic, Exa, Fish (free model only), YouTube Data API (gcloud project `remawt`), R2, Cloudflare. Missing: DeepSeek, Groq, Pexels, Fish credit.
- DB: Neon prod, v2 migration applied non-destructively (v1 tables intact; CSV backups in the session scratchpad).

## Log
### 2026-10-29
- Local test session: engine + Inngest dev + web started on alternate ports; two full pipeline runs READY; frames inspected.
- Findings: all LLM calls were Haiku (Free plan cap); diagram hub layout orphans nodes (#46); sketch node sublabel overflow (#51); ElevenLabs SFX rejects cues < 0.5 s (#49); `cost.ttsUsd` absent (#50); web dev bypass not honoured by middleware (#52).
- Decisions: remove watermark on all tiers; add four Three.js 3D blocks; test at Pro tier. Three Opus agents started (3D blocks / layout+overflow / watermark removal).
- Added `PLANS.md`, `TODO.md`, `PROGRESS.md`.
- Diagram layout rewrite (both HTML and sketch): hub = most-connected node, 2-row radial spokes, implicit hub↔spoke arrows (no orphans), chains centred, 1-node centred-large, whole diagram visible by 45% of scene. Text fitter (`fitLines`: shrink → wrap → ellipsis) on titles, diagram/bullet/icon-grid/split/counter/card text; `textfit.ts` char budgets + `lintPlanText`; catalogue entries carry "text budget" lines. 21 new tests. #46 #51 closed.
- 3D blocks landed: `chart-3d`, `globe-3d`, `stat-3d`, `scene-3d` (Three.js r158 pinned from jsdelivr, state rebuilt from `t` each frame, `hf-seek` driven, SwiftShader-safe, bundled Inter ExtraBold + Excalifont glyph outlines, toon/ink look on hand-drawn skins). Catalogue + lint (≤ 2 per video, 3–8 s, never the hook) + coercion + repair examples + demos. Snapshots verified non-black on all four; no MP4 yet (disk full).
- Watermark removed everywhere (hf-kit `watermark.ts` → grain-only `chrome.ts`; `watermark` dropped from Plan type, PipelineCtx, workflow ctx; web copy; docs). Free-tier TTS pick now `planForUser === "FREE"` at the voice step. Typecheck 7/7, hf-kit 121, engine 41, web build OK. Uncommitted.

### 2026-10-28
- Pivot planned (`docs/PIVOT_PLAN.md`, three research docs) and built in one session with ~10 Opus agents by directory ownership: web app (design system `docs/DESIGN.md`, landing, onboarding, 12 app pages), engine (Express + Mastra + Inngest, three video sources), `packages/{db,shared,hf-kit,publisher,radar}`. 177 unit tests, web build 28 routes.
- Fish Audio made default TTS with native word timestamps; ElevenLabs demoted.
- Excalidraw "Sketch" style: TS port of the contentgen `exdraw.py` Board, `exportToSvg` in headless Chrome, excalidraw-animate ordering → GSAP draw-on, one line written at a time; skins `sketch` / `sketch-paper`; Excalifont subset bundled.
- Compose robustness: planner uses the hf-kit block catalogue prompt, lenient coercion + Haiku repair loop; 24/24 live eval.
- DB migration rewritten non-destructive and applied to Neon prod.
- YouTube Data API key created via gcloud; radar has a live source.
- Infra decisions: DO Functions unsuitable for render; need AWS Lambda fix (#45) or a 4 vCPU / 8 GB VPS.
- Pushed `b893fa2`.
