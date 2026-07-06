---
title: Three.js Director (10-min continuity)
impact: HIGH
impactDescription: enables coherent 10-minute 3D product videos with a single continuity ledger across all beats
tags: 3d, three, director, continuity, 10min
---

## SceneSpec → render pipeline

The director emits a pure-data `DirectorPlan` (no React, no R3F, no `@remotion/*`, no `three` runtime imports). A separate `sceneBuilder` turns the plan into a `SceneSpec`:

```
brief → beat sheet → continuity ledger → per-beat emission → DirectorPlan → buildSceneSpec → SceneSpec → deterministic frame-stepped Three.js render
```

The render is **deterministic frame-stepped Three.js**: for each frame index `0..durationInFrames-1` the runtime evaluates the spec at that exact frame and renders. There is no animation loop, no clock, no RAF — the frame index is the only clock. This makes output reproducible and renders identically headless or in-browser.

Never import React, R3F, or `three` in the planning code. Those live only in the registry component `build()` functions, which are invoked at render time.

## Continuity ledger rules

Emit **ONE** continuity ledger for the whole video. Every beat references tokens by id; beats never re-declare palette, camera, lights, or materials.

```
ledger = {
  palette: ["#0a0a0a", "#ffffff", "#9ca3af", "#4a9eff", "#1e293b"],
  materials: { glass: { color: "#9ca3af", roughness: 0.1, metalness: 0.0 }, metal: { color: "#c0c0c0", roughness: 0.3, metalness: 0.95 }, matte: { color: "#1a1a1a", roughness: 0.9, metalness: 0 } },
  cameraRigs: { hero: { type: "path", points: [...], fov: 35, lookAt: [0,0,0] }, orbit: { type: "orbit", center: [0,0,0], radius: 4, speed: 0.2, fov: 35, height: 1.5 } },
  lightRigs: { key: [ { type: "directional", intensity: 1.2, position: [5,8,6] } ], fill: [ { type: "ambient", intensity: 0.4 } ], rim: [ { type: "directional", intensity: 0.8, position: [-6,4,-4] } ] },
  postFXPresets: { default: "cinematic" }
}
```

- Every object color MUST come from `ledger.palette` (white/gray/accent are always allowed).
- Every material MUST be a named entry from `ledger.materials` — never raw per-object roughness/metalness.
- The camera rig is declared once at the top level; beats do not declare their own camera.
- The critic flags PALETTE DRIFT (off-palette colors) and MATERIAL MISMATCH (material not in the library) and rewrites them to the nearest ledger token.

## 10-min pacing rules

A 10-minute video is ~10 beats summing to 600s @ 30fps = **18000 frames**. Default structure (the model may adjust):

| # | beat | seconds | frames |
|---|------|---------|--------|
| 1 | hook | 15 | 450 |
| 2 | brand intro | 30 | 900 |
| 3 | feature 1 | 90 | 2700 |
| 4 | feature 2 | 90 | 2700 |
| 5 | feature 3 | 90 | 2700 |
| 6 | use case montage | 120 | 3600 |
| 7 | social proof | 60 | 1800 |
| 8 | pricing | 60 | 1800 |
| 9 | recap | 30 | 900 |
| 10 | CTA | 15 | 450 |

Rules:
- Hook ≤ 15s. CTA ≤ 15s. Feature deep-dives ~90s each.
- The sum of `durationSeconds` MUST equal the requested total; frame boundaries are derived via `Math.round(seconds * fps)`.

## Camera path rig

Use `type: "path"` with **4–8 control points** for cinematic continuity across beats:

```json
{
  "type": "path",
  "points": [[0,2,8],[4,3,6],[6,2,4],[8,3,3],[10,2,5],[12,3,7]],
  "fov": 35,
  "lookAt": [0,0,0]
}
```

The runtime interpolates the camera along the path across the full video. Beats do not declare their own camera — they inherit the path. Use `type: "orbit"` (with `center`/`radius`/`speed`/`fov`/`height`) only for short, contained beats (≤15s) where a slow arc reads better than a path cut.

The critic flags CAMERA POP when consecutive beats would jump the camera; the fix is to interpolate radius/center between beats.

## HDRI sourcing

Use the preset keys only — never invent HDRI URLs:

- `studio` — neutral product photography
- `sunset` — warm golden hour
- `dawn` — cool soft light
- `night` — deep blues, city glow
- `warehouse` — industrial, raw
- `forest` — dappled green ambient
- `city` — urban reflections

The ledger picks ONE `hdri` preset for the whole video.

## PostFX budget

Pick ONE preset per video. Don't stack bloom + heavy DOF on 10-min videos — performance on 18000 frames matters.

| preset | use for |
|--------|---------|
| `clean` | tech / data / B2B — minimal grading, sharp |
| `cinematic` | product showcases — filmic contrast, subtle bloom |
| `dreamy` | lifestyle / soft goods — bloom + DOF |
| `noir` | moody / dramatic — desaturated, hard contrast |

## Registry components

The director only emits `component` names from `THREE_REGISTRY`:

- **ThreeProductHero** — 3D plane displaying the hero image with subtle orbit + soft light. Use for the hook and recap.
- **GlassPanel3D** — frosted-glass card with hairline border. Use for feature framing and pricing.
- **DepthParallax** — depth-displaced layers from a single image. Use for use-case montage.
- **MaterialCard** — a card with a named ledger material (glass/metal/matte). Use for feature trios.
- **ParticleField** — deterministic particle cloud. Pass `seed`; keep `count ≤ 400`.
- **Text3D** — extruded/bevelled text. `props.text` is required. Use for headlines and the CTA.

Every component's `props` are validated against that component's `propsSchema` (zod). Invalid props trigger one retry with the validation error appended.

## Determinism rules

Never call `Math.random()` in the spec. The runtime seeds particles deterministically; pass a fixed `props.seed` instead:

```json
{ "component": "ParticleField", "props": { "seed": 42, "count": 300 } }
```

The whole pipeline is reproducible: same `DirectorPlan` → identical frame output, run after run.

## Example minimal plan (2-beat)

```json
{
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "durationInFrames": 1350,
  "bgColor": "#0a0a0a",
  "hdri": "studio",
  "postFXPreset": "cinematic",
  "cameraRig": {
    "type": "path",
    "points": [[0,2,8],[3,2,6],[6,2,5]],
    "fov": 35,
    "lookAt": [0,0,0]
  },
  "lights": [
    { "type": "directional", "intensity": 1.2, "position": [5,8,6] },
    { "type": "ambient", "intensity": 0.4 },
    { "type": "directional", "intensity": 0.8, "position": [-6,4,-4] }
  ],
  "beats": [
    {
      "name": "hook",
      "startFrame": 0,
      "endFrame": 450,
      "layers": [
        { "id": "hero-plane", "component": "ThreeProductHero", "props": { "src": "https://cdn/hero.png", "bgColor": "#0a0a0a", "orbit": 0.18 } }
      ]
    },
    {
      "name": "cta",
      "startFrame": 450,
      "endFrame": 1350,
      "layers": [
        { "id": "cta-text", "component": "Text3D", "props": { "text": "Try it free", "color": "#4a9eff", "fontSize": 120, "seed": 7 } }
      ]
    }
  ]
}
```