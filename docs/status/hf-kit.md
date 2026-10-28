# hf-kit status (2026-10-28)

Package: `packages/hf-kit` (`@remawt/hf-kit`, ESM, `"type": "module"`). Contract source: the HyperFrames skills (`hyperframes`, `-core`, `-cli`, `-registry`) plus the legacy `hfComposer` rules, ported to 1080×1920.

## Public API (`src/index.ts`)
Required signatures, unchanged:
- `composeVideo(input)` → `Composition`. Deterministic. No LLM.
- `lintComposition(comp)` → `{ ok, errors, warnings }`
- `scaffoldProject(comp, dir)` → `{ indexPath, files }`. `dir` must be under `os.tmpdir()`.
- `buildSystemPrompt(...)` and `buildScenePlanPrompt(...)`
- `renderPoster(...)` → PNG `Buffer`
- `submitRender(comp, opts)` and `pollRender(jobId)`

Additive extras:
- `composeVideo` accepts `media?: { userVideo?, speechAudioUrl? }`.
- Helpers: `allocateScenes(format, totalMs, words)`, `chunkWords`, `resolvePlan`, `projectFiles`, `renderRequestBody`, `renderJobId`, `audioUrlsFor`, `videoUrlsOf`, `BLOCK_SCHEMAS`, `BLOCK_SAMPLES`, `runHyperframesLint`, `runHyperframesRender`, `hyperframesVersion`.

## What composeVideo produces
- `index.html` contains:
  - the root `#root` (`data-composition-id="main"`, start, duration, width, height, fps);
  - GSAP 3.14.2 from the CDN;
  - a Google Fonts `<link>` for the skin's display, body and mono fonts;
  - a full-bleed background `<div>`;
  - one host per scene, back to back, on track 1;
  - an `overlays` host (track 2), a `captions` host (track 3) and a `chrome` host for grain and watermark (track 4). Hosts above the scene sequence carry `data-remawt-layer`;
  - root-level `<audio>` elements;
  - a `#remawt-media` JSON manifest when the video has footage;
  - an empty paused `window.__timelines["main"]`.
- `compositions/<sid>.html` has these rules:
  - Everything sits inside `<template>`. The root is `#root` and has no background. Fills go on `#<sid>-bg`.
  - Content sits in `#<sid>-stage`, and transitions animate that wrapper.
  - Every id is prefixed with the scene id.
  - The script is an IIFE. It builds one paused timeline and registers it last.
  - Initial states use `gsap.set` because a `tl.set` at time 0 does not render frame 0 (hyperframes lint `gsap_timeline_set_initial_hide`).
  - Opacity changes use `.set` and then `.to`. `fromTo` animates transforms or `clipPath` only.
- Timing:
  - Scene durations are frame-aligned. The last scene stretches to cover the narration.
  - Music BPM nudges scene boundaries onto beats when a beat is within 120 ms.
  - Root duration = the sum of the scene durations.

## Blocks (`src/blocks/`, zod data schemas in `schema.ts`)
- `kinetic-headline`: word-by-word reveal behind masks, with accent emphasis words.
- `diagram`: auto, vertical, horizontal, cycle, hub, grid or custom layout. Arrows are rotated wrappers whose inner line grows with `scaleX`.
- `counter`: an odometer. Each digit is a strip that moves with `y`. The final value is exact.
- `chart`: line, area or bar in pure SVG. Lines draw on with a `clipPath` wipe. Bars grow with `scaleY`. Supports annotations that avoid each other, a legend and a source line.
- `split-title`: a matchup of two sides with a VS badge.
- `split-stat`: comparison rounds of vertical bars. The winner is highlighted with a crown.
- `numbered-card`, `strike-through`, `source-card`, `headline-card` (the outlet is plain text, never a logo), `bullet-stack`.
- `map`: country outlines from Natural Earth 110m, about 120 KB (`world.data.ts`). Supports country names, aliases and continents, labelled pulsing points and a focus crop for a region.
- `icon-grid`: 122 inlined lucide icons, plus a runtime fallback to any lucide-static icon.
- `image`: Ken Burns of at most 6%. Lint enforces the limit.
- `outro`.
- `video-segment`: user footage inside the scene, `<video class="clip">` with a `data-media-start` trim. Crop is `cover`, `blur-pad` or `{x,y,w,h}`. Cuts to and from footage are hard cuts.
- `overlay-lower-third`, `overlay-keyword`, `overlay-stat`, `overlay-progress`: drawn over footage in the `overlays` composition at absolute times.
- Aliases are resolved (`chart-line`, `bar-compare`, `checklist`, …). For `a|b`, the first known name wins.

## Other modules
- **Skin** (`src/skin`):
  - Safe area: 220 px at the top and 420 px at the bottom. Content box y = 220–1170; caption band y = 1200–1440.
  - Type scale for a 1080-wide frame. No readable text is under 28 px.
  - Radius depends on `shapes`.
  - Motion presets set duration, ease, stagger, travel distance and transition.
  - Grain is a fixed-seed SVG texture.
- **Captions** (`src/captions`):
  - A chunk ends after punctuation, at 4 words, at 1.2 s, or before a pause of 150 ms or more.
  - One caption group is on screen at a time, and each group is hard-killed when its window ends.
  - Styles: `bottom`, `centered`, `karaoke` (the active word gets the accent colour and scales up) and `minimal`.
- **Transitions** (`src/transitions`): `push`, `dissolve`, `scale`, `blur` and `cut`. Each is split into an exit on the outgoing scene and an entrance on the incoming one. Registry names map onto these (`push-slide`, `blur-crossfade`, `zoom-through`, `focus-pull`).
  - Shader transitions from the registry are not used. They need overlapping scene slots, and the kit keeps scenes back to back.
- **Audio** (`src/audio`):
  - Root `<audio>` tracks: narration on track 10; music on track 11 at `data-volume` 0.25; SFX on tracks 20 and up.
  - The music is ducked under speech with a `data-automation` volume lane: down to 0.32× during speech, with a 0.6 s fade-in and a 1.5 s fade-out.
  - A music track shorter than the video is tiled.
  - `mixFilter()` builds the equivalent ffmpeg graph: adelay, volume and sidechaincompress.
- **Watermark**: "made with remawt", bottom-left under the captions, FREE plan only (`watermark: true`).
- **Lint** (`src/lint.ts`):
  - Structure: root attributes, host attributes, host id = composition id, scene files exist, `<template>` wrappers, timeline registration (and that it comes after the tweens), paused timelines.
  - Forbidden code and tweens: `fromTo` with opacity, forbidden or non-contract tween properties, `Math.random`, `Date`, fetch, timers, `repeat: -1`, `play()`/`pause()`, adding a scene timeline to another timeline.
  - Elements: id prefixes, unique ids, no background on the scene root, no CSS transform on an element that GSAP transforms, the Ken Burns limit.
  - Timing: scenes back to back, durations sum to the root, media inside the root duration.
  - Media: audio ids, no `crossorigin`, `data-automation` is valid JSON, each `<video>` is consistent with the manifest (in/out range, `data-media-start`, slot length), asset URLs (https, data or `assets/`; a local path is an error).
- **CLI** (`src/cli.ts`): runs the pinned devDependency `hyperframes@0.8.212` (`lint --json`, `render`).
- **Render** (`src/render`):
  - `RENDER_PROVIDER=lambda`: sends one SQS message with `projectFiles`, `durationInFrames` and `assets.{audioUrls,videoUrls}`. Status comes from R2 `status/{jobId}.json`.
  - `service`: HTTP `/render-hf`. On completion the file is downloaded and uploaded to R2.
  - `local`: `npx hyperframes render` in tmp, an ffmpeg mux only when the output has no audio stream, then an R2 upload (or a `file://` URL). Status is kept in a tmp file and in R2.
  - Job ids are deterministic (`<videoId>-<hash>`), so resubmitting the same job does not send it again.
  - `src/r2.ts` is ported from legacy and uses the same environment variable names.
- **Poster** (`src/poster.ts`): a `kinetic-headline` at its end state, screenshotted with puppeteer and system Chrome. Uses `PUPPETEER_EXECUTABLE_PATH`, else a known path. Takes about 1.3 s per poster.
- **Prompts** (`src/prompts`):
  - The system prompt is cacheable. It holds the block catalogue (JSON Schema per block from `z.toJSONSchema`, plus an example), the ScenePlan JSON shape and 10 rules.
  - The user prompt holds the script lines with their spoken times, the beat slots from `allocateScenes` and the natural cut points.

## Verified
- `pnpm --filter @remawt/hf-kit typecheck`: clean.
- `pnpm --filter @remawt/hf-kit test`: 56 of 56 pass. They cover:
  - caption chunking and caption windows;
  - `allocateScenes` (one slot per beat, sums to the total, no cut inside a word);
  - every block and every overlay rendering and passing lint;
  - zod paths in error messages;
  - determinism;
  - the ducking lane;
  - the render body;
  - 22 lint violations plus a video-range mismatch;
  - the prompts.
- `pnpm --filter @remawt/hf-kit demo`: 6 formats plus `video-edit`, written to `$TMPDIR/remawt-hfkit-demo/<id>/`.
  - The kit lint and `hyperframes lint` show 0 errors on all 7.
  - `hyperframes check` passes on all 7: runtime, layout, contrast and audio. The craft check warns only about the count-up digits on screen for a short time (now `data-layout-ignore`) and about a short demo bullet slot.
  - Draft MP4s rendered with the CLI (1080×1920, 45.3 s, with an audio stream): see the table below.
- `renderPoster` was run for the ledger, paper and neon skins. The PNGs are correct, including Google Fonts.

| demo | kit lint | hyperframes lint | draft render |
|---|---|---|---|
| did-you-know (with watermark) | ok | ok | ok, 3.5 MB, 27 s |
| chart-explains | ok | ok | ok, 3.4 MB, 29 s |
| x-vs-y | ok | ok | ok, 3.3 MB, 26 s |
| wish-i-knew | ok | ok | ok, 3.4 MB, 26 s |
| mythbust | ok | ok | ok 4.1MB 28s |
| headline-reaction | ok | ok | ok 3.4MB 28s |
| video-edit (3 footage segments, 2 cut-ins, lower-third, keyword, progress) | ok | ok | ok 6.2MB 12s (16.0s, footage audio kept) |

## Not verified or stubbed
- Lambda and service submit/poll were not run against real infrastructure: there are no AWS credentials or service here. The code is ported line for line from `hfRenderClient`.
- On Lambda, the muxer `amix`es `audioUrls` and so drops ducking and SFX offsets. See `docs/REQUESTS.md` (hf-kit 1–3).
- `blur-pad` is a contained frame over a pad tinted with the skin colours. A true blurred pad must be baked at ingest, because CSS blur on footage breaks the contract.
- Registry blocks are not installed (`registryBlocks: []`). All visuals are the kit's own.
- Fonts that are not bundled with HyperFrames (Space Grotesk, Fraunces, Patrick Hand) load through a Google Fonts `<link>` at render time, which needs network access. `hyperframes lint` accepts this.

## Compose robustness (2026-10-28, compose-robustness agent)
- **Lenient block schemas** (`src/blocks/coerce.ts`). `STRICT_BLOCK_SCHEMAS` / `STRICT_OVERLAY_SCHEMAS` are the renderer contract. The exported `BLOCK_SCHEMAS` / `OVERLAY_SCHEMAS` (used by `composeVideo`) are `z.preprocess(coerceData, strict)`:
  - a generic walker over the strict zod schema handles: bare string → `{label|text|name|metric…}`, `"$4,000"` / `"39%"` / `"1.2M"` → numbers, key synonyms (`bullets`→`items`, `countries`→`regions`, `lng`→`lon`, …), fuzzy enum values (`"flow"`→`vertical`, `"bar chart"`→`bar`), too-long text truncated at a word boundary, arrays sliced to max, invalid optional values dropped, invalid array items dropped, numbers clamped and rounded, nested extra keys stripped;
  - per-block structural fixes: diagram (ids from labels, edges as `"A -> B"` / `[a,b]` / `{source,target}` / labels / indexes, auto-chained edges when none are given); chart (bare number series → `{name, values}` + auto x labels, top-level `values`, `{name: values}` maps, `[{x,y}]` points, annotations by label/year); split-stat (`left/right.value` → `rounds[0]`, `"Cost: $2,100 vs $2,850"`, units from `$`); counter (`"$4,000"` → value + prefix/suffix/decimals); source-card (`source:{title,url}`); headline-card (`outlet` aliases, `"News"` fallback); numbered-card (`"Tip #2"`); icon-grid, map, kinetic-headline, strike-through, video-segment (`start`/`end` seconds).
  - Strict where rendering would break: chart needs ≥ 2 values, `outMs > inMs`, required objects that cannot be inferred. `headline-card.date` is now optional (the renderer skips it).
- **`coercePlan(plan, {assetIds})`** (`src/repair.ts`): coercion with scene context (headline/body, ordinal → numbered-card `n`/`total`), unknown block → `kinetic-headline`, unknown asset ids dropped, `image` without a resolved asset → `kinetic-headline`. Returns `{plan, changes[], invalid[]}`. Engine metadata keys in `data` (`asset`, `cutIn`, …) are kept. Also `sceneIssue`, `blockGuide(block)` (doc + generated shape + valid example, for the repair prompt).
- `composeVideo` now throws a `ComposeError` (not a plain Error at render time) for an `image` scene with no image asset.
- **Prompts**: the catalogue shows a compact `data shape` per block generated from the strict zod schemas (`shapeOf`) and an example; a test asserts every example parses strictly with zero coercions, so they cannot drift. `DATA_SHAPE_RULE` ("data must match the example shape exactly…") is rule 5. `buildSystemPrompt({output: "draft", extraRules})` / `buildScenePlanPrompt({output: "draft"})` give the engine planner a content-only output (no timings, no footage/overlay blocks).
- Tests: 113 pass (`src/__tests__/coerce.test.ts`: 3 messy fixtures per block × 16 blocks, each coerced → strict-valid → composed → lint clean; plus plan-level tests).
