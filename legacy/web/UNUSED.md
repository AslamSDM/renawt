# Unused / Unimported Files

Scan date: 2026-05-18. Method: heuristic — every `.ts/.tsx/.mjs/.js/.jsx` under
`app/`, `components/`, `lib/`, `generate-server/`, `scripts/`, `services/`,
`screenshot-api/`, `remotion/` was checked for any other file in the tree
importing it by basename. Next.js convention files (`page.*`, `layout.*`,
`route.*`, etc.) and known entry points (`server.ts`, `Root.tsx`, `middleware.ts`,
`auth.ts`) were excluded as inherently-entry. False positives were spot-checked
and removed (see Notes).

## Confirmed orphan source files

These have **zero importers** anywhere in the repo. Safe candidates for
deletion.

### Frontend components

- `components/cursor/CursorPreview.tsx`
- `components/ui/CircularGallery.tsx`
- `components/video/DemoVideoPlayer.tsx`

### Remotion compositions / examples

- `remotion/compositions/ProductDemoVideo.tsx`
- `remotion/examples/ProductShowcaseExample.tsx`

### Generate-server orphan agents

- `generate-server/lib/agents/visionBrandAnalyser.ts` — only references are in
  its own comment header; nothing imports it after the old-flow purge.

### Type declaration stubs

- `lib/skills/markdown.d.ts` — declaration file with no consumers.

### One-off / ops scripts

These look like ad-hoc utilities. Some may still be invoked manually from a
shell, not via imports — confirm before deleting.

- `scripts/add-credits.ts`
- `scripts/fetch-users.mjs`
- `scripts/generate-registry.mjs`
- `scripts/local-render.ts`
- `scripts/send-retention-emails.mjs`
- `scripts/setup_webhook_cloudfared.ts`
- `scripts/setup_webhook_ngrok.ts`

### Generate-server test/dev scripts

Invoked manually (e.g. `tsx test-jitter.ts`), not imported. Keep if you still
run them; delete otherwise.

- `generate-server/scripts/capture-and-test.ts`
- `generate-server/scripts/scrape-jitter-templates.ts`
- `generate-server/scripts/test-jitter-ollama.ts`
- `generate-server/scripts/test-jitter-reference.ts`
- `generate-server/scripts/test-jitter.ts`
- `generate-server/scripts/test-ollama-gemma4.ts`
- `generate-server/scripts/test-remawt-direct.ts`
- `generate-server/scripts/test-url-video.ts`

### Screenshot-api scripts

- `screenshot-api/scripts/loadtest.js` — ad-hoc load test.

## Notes / false positives excluded

The following showed up in the raw scan but were verified to be **actually
used** via relative-path imports that include a `.js` extension (which the
basename grep missed):

- `services/render-service/src/codeValidator.ts` ← imported by `renderEngine.ts`
- `services/render-service/src/renderEngine.ts` ← imported by `worker.ts`
- `services/scraper-service/src/r2Upload.ts` ← imported by `scraper.ts`

## Caveats

- The scan is import-graph-only. Files referenced **dynamically** (string
  literals passed to `require()` or `import()`, e.g. compositions loaded by id)
  will look orphan but may still be live.
- The scan does **not** check whether an imported symbol is actually used —
  only whether the file is imported somewhere.
- `package.json` scripts (`npm run …`) and external invokers (cron, deploy
  scripts) are out of scope. Some `scripts/*.ts` files may be wired into ops.
