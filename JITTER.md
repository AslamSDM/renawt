# Jitter Pipeline — Agent Reference

Brief for future agents working on the Jitter video pipeline. Keeps the surface area small so you can navigate without reading every file.

## What it is

A second video pipeline alongside the existing `jsonComposer` / `JsonComposition` track. It models a video as a Jitter-style document: primitive **layers** placed in absolute coordinates, animated by a separate **operations** timeline that targets layers by id. It also supports a **built-in component library** for richer surfaces (mockups, typewriters, beat hits, etc.) and AI-authored React components when needed.

The original `JsonComposition` pipeline (registry-based, opinionated motion baked into components) is untouched and still runs.

## Pipeline (URL → mp4)

```
URL → screenshot (Playwright/MCP)
    → analyzeBrandFromScreenshot   (Gemini Pro Vision)  → BrandReport
    → pickTrack                    (music_metadata.json) → {url, bpm}
    → align duration to whole beats
    → briefFromBrandReport         → JitterBrief (brand + copy + audio + heroImage)
    → generateJitterDoc            (Gemini Pro)         → JitterDoc
    → snapDocToBeats               (safety net)         → JitterDoc
    → JitterComposition (Remotion) → mp4
```

End-to-end script: `generate-server/scripts/test-url-video.ts`.

## Files (anchor map)

| Path | Role |
|------|------|
| `generate-server/lib/video/jitterJson.ts` | Zod schema. Source of truth for layer / operation / artboard / doc shapes. |
| `generate-server/lib/video/beatSnap.ts` | `beatGridForBpm`, `describeBeatGrid`, `snapDocToBeats` post-processor. |
| `generate-server/lib/audio/musicPicker.ts` | Reads `music_metadata.json`, picks a track by mood + preferred BPM. |
| `generate-server/lib/agents/jitterComposer.ts` | LLM agent. System prompt + user-message builder + cross-ref validator. |
| `generate-server/lib/agents/urlToJitter.ts` | Orchestrator: vision → music → brief → composer. |
| `generate-server/scripts/test-url-video.ts` | CLI runner. Calls orchestrator + Remotion render + open. |
| `remotion/compositions/JitterComposition.tsx` | Renderer. Walks layers, applies operations per-frame, hosts builtins + dynamic customComponents. |
| `remotion/jitter/builtins.tsx` | The built-in component library. Each component fills its layer box. |
| `remotion/fonts/jitterFonts.ts` | Pre-loaded Google Fonts + `resolveFontFamily()` (with Apple system stack fallback). |
| `remotion/Root.tsx` | Registers `<Composition id="JitterComposition" ...>` with `calculateMetadata`. |
| `public/jitter/` | Drop point for screenshots. Served by Remotion at `/jitter/*` (see `remotion.config.ts`: `setPublicDir("./public")`). |

## JitterDoc — top-level shape

```jsonc
{
  "name": "Short title",
  "fps": 30,
  "audio": { "url": "...", "bpm": 124, "volume": 0.6 } | null,
  "customComponents": [{ "name": "PascalName", "source": "function ... { return ... }" }],
  "conf": {
    "id": "root",
    "version": 4,
    "artboards": [
      {
        "id": "art1",
        "name": "Scene 1",
        "width": 1920,
        "height": 1080,
        "duration": 4000,                  // ms — sum across artboards = video duration
        "fillColor": "#0b1020",
        "background": true,
        "operations": [ /* see "Operations" */ ],
        "layers":     [ /* see "Layers" */ ]
      }
    ]
  }
}
```

All times are **milliseconds**. Frames are derived per-artboard via `Math.round((duration * fps) / 1000)`.

## Layers

Every layer needs a unique `id`. Common base props: `x, y, width, height, scale, angle, opacity, cornerRadius`. Coordinates are **artboard-local pixels** (top-left origin). Nested layers in a `layerGrp` are relative to the group.

| `type` | Notable props |
|---|---|
| `text` | `text, color, font: { name, weight }, fontSize, lineHeight, letterSpacing, textAlign, verticalAlign, case` |
| `image` | `url` (http/https/data: URL, or `/jitter/...` resolved via `staticFile`) |
| `rect` | `fillColor, cornerRadius, shadowEnabled, shadowOffset{X,Y}, shadowBlur, shadowColor, shadowOpacity` |
| `layerGrp` | `background, fillColor, clipsContent, shadow*, layers: AnyLayer[]` |
| `custom` | `component` (string — name in builtins or in `customComponents[]`), `props` (record) |

The `custom` layer is the bridge to React components. Lookup order at render time: dynamic `customComponents[]` (compiled via `new Function`) shadow same-named builtins.

## Operations

All ops have `{ id, targetId, startTime, endTime?, easing }`. `targetId` references a layer id. `easing ∈ { none, slowDown, natural, accelerate }` (default `natural`).

Renderer applies each matching op as a stateful fold, in declared order, onto a base `LayerState` derived from the layer's static props. Layer state has `{ x, y, width, height, scale, opacity, angle, scaleOrigin, textProgress }`.

| `type` | Effect | Key props |
|---|---|---|
| `growIn` | Scale `op.scale → layer.scale` | `scale: 0..1` |
| `shrinkOut` | Scale `layer.scale → op.scale` | `scale: 0..1` |
| `resize` | Animate w/h between `fromValue`/`toValue` with anchor offset | `anchor, fromValue, toValue` |
| `fadeIn` | Opacity `0 → base` | — |
| `fadeOut` | Opacity `base → 0` | — |
| `slideIn` | Translate from offset to base + opacity 0→base | `direction, distance` |
| `slideOut` | Translate base → offset + opacity base→0 | `direction, distance` |
| `pulse` | Sine-wave scale wobble `intervalMs` period; runs while in window | `scaleAmount, intervalMs` |
| `textIn` | Per-token reveal on a `text` layer (letter / word / none split) | `effect, split, order, offset, nodeDuration, nodeEasing, travelDistance, slideDirection` |

Pre-start pose for entries (`growIn`, `slideIn`, `fadeIn`, `resize`, `textIn`) is non-default — they leave the layer offscreen / invisible / scaled-to-0 until their `startTime`. After `endTime`, ops freeze at `t=1` (except `pulse`, which returns to base).

## Built-in components (`remotion/jitter/builtins.tsx`)

Each fills its layer box. Entry/exit motion comes from Jitter operations on the wrapping layer.

```
BrowserMockup, MacMockup, PhoneMockup       — chrome + screen-content slot
CursorClick                                  — animated cursor moving + clicking inside its box
Typewriter, GradientText                     — text effects (own time-base)
GlassCard, GlowHalo, AnimatedGradient,       — surfaces / fx
BlurredBlob, MotionLines, FloatingDots
CodeBlock, NumberCounter, ProgressBar        — data
BeatInvert, BeatFlash, BeatColorSwap         — beat-driven
```

The full prop catalog is in `BUILTIN_CATALOG` inside `jitterComposer.ts` — that string is what the agent sees, so update it whenever you add a builtin.

**Sync invariant**: `JITTER_BUILTINS` (renderer) and `BUILTIN_NAMES` (agent validator) and `BUILTIN_CATALOG` (agent prompt) must list the same components. There's no automated check yet.

## Beat handling

The whole pipeline is beat-aware end-to-end:

1. `pickTrack` returns `{url, bpm}` from `music_metadata.json`.
2. `urlToJitter` rounds the requested duration to a whole number of beats.
3. `briefFromBrandReport` → `JitterBrief.audio = { url, bpm, volume }`.
4. `jitterComposer` injects a **BEAT GRID** block into the user message (beatMs, halfBeatMs, 8-beat scene-break rule). The agent composes ON-grid natively.
5. After parse, `snapDocToBeats` snaps any stray op times to the half-beat cell and rounds artboard durations to whole beats. Acts as a safety net.
6. **BeatInvert / BeatFlash / BeatColorSwap** components consume `bpm` directly and drive their own `useCurrentFrame()` math relative to the artboard start.

Agent prompt **requires** at least one beat hit per scene and at least one `BeatInvert` per video.

## Motion contract (in the system prompt)

- Every non-background layer **must** have an entry op AND an exit op. A layer that just appears/disappears is a bug.
- Vary entry/exit kinds across layers in a scene; pick a "motion theme" per scene.
- Easings: `slowDown` for entries, `accelerate` for exits, `natural` for sustained transforms.
- Avoid pure opacity-only animation — pair fades with translate or scale.
- Snap event times to the beat / half-beat grid (the prompt provides the exact ms).

If you weaken any of these, the output regresses to "things popping in mid-frame."

## How to add a new operation

1. Schema: add `XOpSchema = z.object({ type: z.literal("x"), ...OpBase, ...specificProps })` and append it to `OperationSchema`'s `discriminatedUnion`.
2. Renderer (`JitterComposition.tsx`): extend the `Operation` union type. Add a `case "x":` in `applyOperation` that returns a new `LayerState`. If your op needs a non-default pre-start pose, add a `case` in `applyPreStart` too.
3. Prompt (`jitterComposer.ts`): add an example line to the OPERATION TYPES list, and any new design guidance.

## How to add a new built-in component

1. Implement in `remotion/jitter/builtins.tsx`. Root element must have `width: 100%, height: 100%`. Use `useCurrentFrame()` + `useVideoConfig()` for time-based effects (relative to the artboard window — Sequence resets `frame` to 0). For images, route through `resolveImg(url)` so `/jitter/...` maps to `staticFile`.
2. Register in `JITTER_BUILTINS` at the bottom of that file.
3. Mirror the name in `BUILTIN_NAMES` (Set) at the top of `jitterComposer.ts`.
4. Add an entry to `BUILTIN_CATALOG` in `jitterComposer.ts` with its props. Be explicit about prop names, types, defaults — the agent only knows what's written here.
5. If it's beat-driven, add a "BEAT HITS" or relevant section reference + at least one usage pattern.

## How to add a new font

1. Append a `loadFont` import + `loadX(...)` call in `remotion/fonts/jitterFonts.ts`.
2. Add to `JITTER_FONT_FAMILIES` map and `AVAILABLE_FONTS` is auto-derived.
3. Add the literal name string to `AVAILABLE_FONTS` array in `jitterComposer.ts` so the agent knows it can pick it.

The `resolveFontFamily()` function falls back to Inter for unknown names and to the macOS system stack for `SF Pro` / `Apple` / `System*`.

## Cross-reference validation (catches LLM drift)

`validateCrossRefs(doc)` in `jitterComposer.ts` checks:
- every `op.targetId` resolves to an existing layer id (recursing into `layerGrp`);
- every `layer.type === "custom"` references either a defined `customComponents[].name` or a name in `BUILTIN_NAMES`.

Failures are fed back to the LLM as a follow-up user message; up to 3 attempts.

## Schema-only model retries

`generateJitterDoc` always uses Gemini Pro (CF Kimi failed JitterDoc reliably). Token budget is 16k. The JSON extractor walks balanced braces (string-aware) so a trailing field after the JSON object doesn't break parsing.

## Adding a new agent that writes Jitter docs

1. Build a `JitterBrief` (see the type in `jitterComposer.ts`). At minimum: `brief: string`, `width`, `height`, `durationMs`. Add `brand`, `copy`, `heroImage`, `audio` whenever known.
2. Call `generateJitterDoc(brief, { maxAttempts: 3 })`.
3. Pass `result.doc` as `--props` to `npx remotion render remotion/Root.tsx JitterComposition <out.mp4>`.

If you also want vision + music + beats wired in, mirror the orchestrator pattern in `urlToJitter.ts`.

## Lambda / production notes

- The dynamic `customComponents[]` path uses `new Function(...)` to compile React components at render time. This works in `remotion render` and Studio. **It will not work on Remotion Lambda** — Lambda needs source baked into the bundle.
- Built-in components are real TS modules in the bundle and are Lambda-safe. Same for the operations engine.
- For Lambda support, write a codegen step (analogous to `lib/video/codegen.ts` for `VideoJson`) that emits a self-contained TSX wrapper inlining any `customComponents[]`, then deploy via `lambda:site:deploy`.

## Common pitfalls

- **Things pop in mid-frame** → an entry/exit op is missing on that layer. Check `validateCrossRefs` is not the only thing being checked; the system prompt mandates motion but the validator doesn't enforce it. If this becomes a recurring issue, add a `validateMotionCoverage` pass.
- **Image 404 in render** → file isn't under `public/`, or you forgot `setPublicDir("./public")` in `remotion.config.ts`, or the URL didn't get routed through `resolveImg`/`staticFile`.
- **Audio missing in mp4** → the agent dropped the `audio` field. The prompt now says "do not omit", but verify the doc JSON before render.
- **Off-grid hits** → the agent ignored the beat block. `snapDocToBeats` is a safety net but only snaps to half-beat — if `pulse.intervalMs` doesn't match `beatMs`, set it explicitly in the prompt.
- **`new Function` errors** in customComponents → the source string used disallowed identifiers. Only React + `AbsoluteFill, Audio, Sequence, Img, useCurrentFrame, useVideoConfig, interpolate, spring, staticFile` are in scope. Inline styles only.

## Quick repro

```bash
# Already have a screenshot at public/jitter/<slug>.png
cd generate-server && tsx scripts/test-url-video.ts \
  --url=<URL> \
  --screenshot=<absolute-path-to-png> \
  --hero-url=/jitter/<png-basename> \
  --duration=16000 \
  --render
```

Outputs:
- `tmp/test-output/brand-report.json`
- `tmp/test-output/jitter-doc.json`
- `tmp/test-output/jitter-raw.txt`
- `out/jitter-<url-slug>.mp4` (with `--render`)
