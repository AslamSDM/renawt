# Jitter-native → JitterComposition: translate & render contract

Goal: turn the 357 scraped Jitter templates into animated mp4 previews for the
`/templates` gallery. Two work streams build against this shared contract.

## Data locations
- Source docs: `generate-server/data/jitter-templates/raw/<id>.json`
- Index/summaries: `generate-server/data/jitter-templates/index.json`
- Target schema: `generate-server/lib/video/jitterJson.ts` (`JitterDocSchema`, `JitterDocInputProps`)
- Renderer: `remotion/compositions/JitterComposition.tsx` (registered in `remotion/Root.tsx` as composition id `"JitterComposition"`)
- Local render reference: `scripts/local-render.ts` (`@remotion/renderer`: `bundle` → `selectComposition` → `renderMedia`)
- R2 upload: `generate-server/lib/storage/r2.ts` → `uploadVideoToR2(localPath, key)` / `uploadVideoBufferToR2(buffer, key)`

## Source format (Jitter-native)
`{ source, project: { meta, nodes: [...] } }`. `nodes` is a FLAT array. Each node:
```
{ id, item: {...}, position: { parentId, index } }
```
- `position.index` is a FRACTIONAL-INDEX string (e.g. "a0","a1","a2"); sort siblings lexicographically by it.
- Reconstruct trees by `parentId`. There are two trees per artboard:
  - `layersTree` node → contains the visual layer hierarchy (layerGrp/text/rect/image/ellipse/svg/shape/maskGrp/video/gif/star/textImg/customShader).
  - `operationsTree` node → contains the animation timeline (opGrp + op nodes).
- An `artboard` item holds width/height/duration/fillColor/background and is the render root. Multiple artboards per doc possible (204 artboards across 357 docs → most have 1; render the FIRST artboard only for v1 previews).

### Layer item fields (common)
`type, name, x, y, width, height, scale, angle, opacity (0–100), cornerRadius, fillColor, isHidden, clipsContent, strokeEnabled, shadowEnabled, ...`
- text adds: `text, font{name,weight}, fontSize, lineHeight, letterSpacing, textAlign, verticalAlign, case`
- image/video/gif add: `url, mediaName`
- ellipse/rect/shape/star/svg are vector primitives (svg has path data).

### Operation item fields (common)
`type, targetId, startTime, endTime, easing, fromValue, toValue, effect, nodeDuration` (times in ms).
- Op types present (count): move 6299, scale 3523, hide 2490, show 2175, resize 1971, opacity 1636, rotate 1391, color 1142, textIn 1123, blurRadius 1009, morph 599, playVideo 341, cornerRadius 134, blurScaleIn 130, textOut 179, growIn 195, blurSlideOut 80, blurSlideIn 65, playAudio 59, blurOut 45, blurScaleOut 45, shrinkOut 33, blurIn 15, slideIn 19, growOut 17, slideOut 17, fadeIn 3, fadeOut 1, spinOut 5, star/bulge/ellipseA misc.

## Target schema (must end up matching jitterJson.ts)
`JitterDocInputProps { name, fps, conf: { artboards: Artboard[] } }`.
`Artboard { id,name,x,y,width,height,duration(ms),fillColor,background, layers: AnyLayer[], operations: Operation[] }`.
Current `AnyLayer`: text | image | rect | layerGrp | custom.
Current `Operation`: growIn | shrinkOut | resize | fadeIn | fadeOut | slideIn | slideOut | pulse | textIn.

## Stream R — renderer + schema (owns: jitterJson.ts, JitterComposition.tsx, new layer/op component files)
Extend BOTH schema and renderer to cover the native types:
- New layer types: `ellipse` (fill+stroke), `shape`/`svg` (raw SVG path(s) → render `<svg><path/></svg>`), `video` (Remotion `<Video>` from url, with playVideo timing), `gif` (Img/animated), `star`, `maskGrp` (group whose children are clipped by first child / clip-path), `textImg` (treat as image). `customShader` → render as solid fillColor rect fallback (do NOT attempt WebGL).
- New ops mapped to interpolated transforms over [startTime,endTime] with easing:
  - `move` (x/y from→to), `scale` (scale from→to), `rotate` (angle from→to), `opacity` (opacity from→to), `color` (fillColor/text color crossfade), `cornerRadius`, `resize` (already), `hide`/`show` (visibility toggles at time), `blurRadius`/`blur*In/Out` (CSS blur px), `morph` (best-effort: treat as resize+opacity; full path morph optional), `growIn/Out`, `shrinkOut`, `slideIn/Out`, `textIn/textOut`, `spinOut` (rotate+fade), `playVideo`/`playAudio` (media start cue).
- Keep all existing behavior working. Add a generic fallback: any unknown op = no-op (log once); unknown layer = bounding-box rect with fillColor.
- Easing map: Jitter `none|slowDown|natural|accelerate` → Remotion `Easing` curves.
- Update `calculateMetadata`/duration so artboard `duration` drives frames.

## Stream T — translator (owns: NEW file generate-server/lib/video/jitterTranslate.ts + scripts/translate-jitter-templates.ts)
- `translateJitterDoc(raw): JitterDocInputProps` — rebuild layersTree + operationsTree from flat nodes via parentId + fractional index sort; map every item type to the schema above; coordinates are absolute artboard-space (keep x/y/width/height as-is); opacity 0–100 preserved.
- Skip `layersTree`/`operationsTree`/`opGrp`/`maskGrp` wrapper bookkeeping but preserve grouping (layerGrp → group with children; opGrp → flatten its child ops, inheriting group timing offset if present).
- CLI `scripts/translate-jitter-templates.ts`: translate all 357 → write `generate-server/data/jitter-templates/translated/<id>.json`; print a report: count ok/failed, and a histogram of any UNMAPPED item types so gaps are visible. Validate each against `JitterDocSchema` (use `.safeParse`).

## Integration (owner: me, after R+T land)
- `scripts/render-jitter-previews.ts`: for each translated doc → `selectComposition({id:"JitterComposition", inputProps})` → `renderMedia` (webm/mp4, downscaled, ~720p, capped duration) → `uploadVideoToR2(file, "screenshots/templates/<id>.mp4")` → append to `generate-server/data/jitter-templates/previews.json` (`{ id: url }`).
- Gallery: `lib/templates.ts` reads previews.json; `components/TemplateGallery.tsx` renders `<video muted loop autoplay playsinline>` when a url exists, else the palette swatch fallback.

## Definition of done per stream
- R: `npx tsc --noEmit` clean; a sample translated doc renders without throwing; unknown types fall back, never crash.
- T: all 357 translate + `.safeParse` pass (or report exact failures); unmapped-type histogram empty or documented.
