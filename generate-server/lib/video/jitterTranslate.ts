/**
 * JITTER-NATIVE → JitterDocInputProps translator.
 *
 * Turns a scraped Jitter document into the target schema consumed by
 * `JitterComposition.tsx` (see `jitterJson.ts`). Three on-disk shapes exist
 * in the raw corpus, all handled here:
 *
 *   1. `{ source, project: { meta, nodes } }`      — flat-node v1 (spec primary)
 *   2. `{ meta, nodes, syncedAt }`                 — flat-node v1 (same shape)
 *   3. `{ name, conf: { artboards } }`             — legacy nested tree
 *
 * For the flat-node shapes we rebuild the layersTree + operationsTree from the
 * flat `nodes` array via `position.parentId` and sort siblings by the
 * fractional-index string `position.index` (lexicographic). We render the FIRST
 * artboard only (v1 previews).
 *
 * Coordinates are absolute artboard-space and passed through unchanged.
 * Opacity stays on the 0–100 scale. Easing objects are collapsed to the
 * schema's 4-value enum. Unmapped item types are COLLECTED (never thrown) so
 * coverage gaps are explicit in the batch report.
 */

import type { z } from "zod";
import type { JitterDocSchema } from "./jitterJson";

// The translator emits PRE-PARSE input props: optional fields (e.g.
// customComponents) are left for zod `.default()` to fill, and several op/layer
// shapes are passed through loosely. `z.input` models exactly that. `.safeParse`
// is the gate downstream.
export type JitterDocInputProps = z.input<typeof JitterDocSchema>;

/** Per-call diagnostics so the batch script can build a coverage histogram. */
export interface TranslateResult {
  doc: JitterDocInputProps;
  /** Raw item.type values we could not map, with counts. */
  unmapped: Record<string, number>;
  /** Which raw shape this doc used. */
  shape: "project.nodes" | "top.nodes" | "conf.nodes" | "conf" | "unknown";
  /** Non-fatal notes (e.g. no artboard found). */
  notes: string[];
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/** Convert a Jitter move delta {moveX?,moveY?} to the schema Vec2 {x?,y?}. */
function moveVec(v: any): { x?: number; y?: number } | undefined {
  if (!v || typeof v !== "object") return undefined;
  const out: { x?: number; y?: number } = {};
  if (typeof v.moveX === "number") out.x = v.moveX;
  if (typeof v.x === "number") out.x = v.x;
  if (typeof v.moveY === "number") out.y = v.moveY;
  if (typeof v.y === "number") out.y = v.y;
  return out;
}

/**
 * Convert a Jitter spline path (normalized 0–1 anchor coords + optional bezier
 * handles, expressed as deltas relative to the anchor) into an SVG `d` string,
 * scaled to the layer's width/height. Returns undefined if not a spline.
 */
function splineToPathD(
  path: any,
  width: number,
  height: number,
): string | undefined {
  const controls = path?.spline?.controls;
  if (!Array.isArray(controls) || controls.length === 0) return undefined;
  const w = width || 1;
  const h = height || 1;
  const sx = (n: number) => +(n * w).toFixed(3);
  const sy = (n: number) => +(n * h).toFixed(3);

  const pts = controls.map((c: any) => ({
    a: Array.isArray(c.anchor) ? c.anchor : [0, 0],
    lead: Array.isArray(c.leadingHandle) ? c.leadingHandle : [0, 0],
    trail: Array.isArray(c.trailingHandle) ? c.trailingHandle : [0, 0],
  }));

  let d = `M ${sx(pts[0].a[0])} ${sy(pts[0].a[1])}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const c1x = prev.a[0] + prev.trail[0];
    const c1y = prev.a[1] + prev.trail[1];
    const c2x = cur.a[0] + cur.lead[0];
    const c2y = cur.a[1] + cur.lead[1];
    const hasHandles =
      prev.trail[0] || prev.trail[1] || cur.lead[0] || cur.lead[1];
    if (hasHandles)
      d += ` C ${sx(c1x)} ${sy(c1y)} ${sx(c2x)} ${sy(c2y)} ${sx(cur.a[0])} ${sy(cur.a[1])}`;
    else d += ` L ${sx(cur.a[0])} ${sy(cur.a[1])}`;
  }
  if (path?.spline?.closed) d += " Z";
  return d;
}

/** Jitter colors live under different keys across formats. */
function pickColor(item: any, fallback = "#ffffff"): string {
  return str(item?.fillColor) || str(item?.color) || fallback;
}

/**
 * Collapse a Jitter easing (object `{name,schema,config}` or bare string) to
 * the schema enum `none | slowDown | natural | accelerate`.
 */
function mapEasing(
  easing: unknown,
): "none" | "slowDown" | "natural" | "accelerate" {
  let name = "";
  if (typeof easing === "string") name = easing;
  else if (easing && typeof easing === "object")
    name = str((easing as any).name);
  name = name.toLowerCase();
  if (!name) return "natural";
  if (name === "none" || name.startsWith("linear")) return "none";
  if (name.startsWith("slowdown") || name.startsWith("decelerate"))
    return "slowDown";
  if (name.startsWith("accelerate")) return "accelerate";
  // smooth / natural / impulse / overshoot / custom-path / bezier → natural
  return "natural";
}

function mapVerticalAlign(v: unknown): "top" | "center" | "bottom" {
  const s = str(v).toLowerCase();
  if (s === "top") return "top";
  if (s === "bottom") return "bottom";
  return "center"; // "middle" | "center" | anything else
}

function mapTextAlign(v: unknown): "left" | "center" | "right" {
  const s = str(v).toLowerCase();
  if (s === "right") return "right";
  if (s === "center") return "center";
  return "left";
}

function mapCase(v: unknown): "normal" | "upper" | "lower" {
  const s = str(v).toLowerCase();
  if (s.startsWith("upper")) return "upper";
  if (s.startsWith("lower")) return "lower";
  return "normal";
}

// ---------------------------------------------------------------------------
// Flat-node tree reconstruction
// ---------------------------------------------------------------------------

interface RawNode {
  id: string;
  item: any;
  position: { parentId: string | null; index: string };
}

function getNodes(raw: any): RawNode[] | null {
  if (raw?.project && Array.isArray(raw.project.nodes))
    return raw.project.nodes as RawNode[];
  if (Array.isArray(raw?.nodes)) return raw.nodes as RawNode[];
  // Some docs nest the flat node array under `conf` (`{ conf: { meta, nodes } }`).
  if (raw?.conf && Array.isArray(raw.conf.nodes))
    return raw.conf.nodes as RawNode[];
  return null;
}

/** parentId → children, each child list sorted by fractional `index`. */
function buildChildMap(nodes: RawNode[]): Map<string | null, RawNode[]> {
  const byParent = new Map<string | null, RawNode[]>();
  for (const n of nodes) {
    const p = n.position?.parentId ?? null;
    const arr = byParent.get(p);
    if (arr) arr.push(n);
    else byParent.set(p, [n]);
  }
  for (const arr of byParent.values()) {
    // Fractional-index strings sort lexicographically. Fall back to id for ties.
    arr.sort((a, b) => {
      const ia = a.position?.index ?? "";
      const ib = b.position?.index ?? "";
      if (ia < ib) return -1;
      if (ia > ib) return 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  }
  return byParent;
}

function childrenOf(
  byParent: Map<string | null, RawNode[]>,
  id: string,
): RawNode[] {
  return byParent.get(id) ?? [];
}

// ---------------------------------------------------------------------------
// Layer mapping (flat-node format)
// ---------------------------------------------------------------------------

const LAYER_TYPES = new Set([
  "text",
  "image",
  "rect",
  "ellipse",
  "svg",
  "shape",
  "star",
  "video",
  "gif",
  "textImg",
  "maskGrp",
  "customShader",
  "layerGrp",
]);

const baseLayer = (id: string, item: any) => ({
  id,
  name: item.name ? str(item.name) : undefined,
  x: num(item.x),
  y: num(item.y),
  width: num(item.width, 100),
  height: num(item.height, 100),
  scale: num(item.scale, 1),
  angle: num(item.angle),
  opacity: num(item.opacity, 100),
  cornerRadius: num(item.cornerRadius),
});

function mapTextLayer(id: string, item: any) {
  const font = item.font || {};
  return {
    type: "text" as const,
    ...baseLayer(id, item),
    text: str(item.text),
    color: pickColor(item, "#000000"),
    fontSize: num(item.fontSize, 24),
    font: {
      type: str(font.type) === "system" ? ("system" as const) : ("googlefont" as const),
      name: str(font.name) || "Inter",
      weight: num(font.weight, 400),
      fontStyle: str(font.fontStyle) || "regular",
    },
    lineHeight: num(item.lineHeight, 150),
    letterSpacing: num(item.letterSpacing),
    textAlign: mapTextAlign(item.textAlign),
    verticalAlign: mapVerticalAlign(item.verticalAlign),
    case: mapCase(item.case),
  };
}

function mapImageLayer(id: string, item: any, url?: string) {
  return {
    type: "image" as const,
    ...baseLayer(id, item),
    url: str(url ?? item.url),
    mediaName: item.mediaName ? str(item.mediaName) : undefined,
  };
}

/**
 * Vector primitives (ellipse/svg/shape/star) + customShader fallback. Shared
 * geometry plus type-specific fields. `shape` splines are normalised to an SVG
 * `d` string; `svg` layers keep their data-uri `url`.
 */
function mapVectorLayer(id: string, item: any, type: string) {
  const base = baseLayer(id, item);
  const pathD =
    type === "shape" && item.path
      ? splineToPathD(item.path, base.width, base.height)
      : undefined;
  return {
    type: type as any,
    ...base,
    fillColor: pickColor(item, type === "svg" || type === "shape" ? "#000000" : "#ffffff"),
    background: item.background !== false,
    url: item.url ? str(item.url) : undefined,
    path: pathD,
    startAngle: type === "ellipse" ? num(item.startAngle) : undefined,
    sweep: type === "ellipse" ? num(item.sweep, 100) : undefined,
    spikes: type === "star" ? num(item.spikes, 5) : undefined,
    radiusRatio: type === "star" ? num(item.radiusRatio, 50) : undefined,
    strokeColor: item.strokeColor ? str(item.strokeColor) : undefined,
    strokeWeight: typeof item.strokeWeight === "number" ? item.strokeWeight : undefined,
    strokeEnabled: !!item.strokeEnabled,
  };
}

function mapRectLayer(id: string, item: any) {
  return {
    type: "rect" as const,
    ...baseLayer(id, item),
    fillColor: pickColor(item, "#ffffff"),
    shadowEnabled: !!item.shadowEnabled,
    shadowOffsetX: num(item.shadowOffsetX),
    shadowOffsetY: num(item.shadowOffsetY),
    shadowBlur: num(item.shadowBlur),
    shadowColor: str(item.shadowColor) || "#000000",
    shadowOpacity: num(item.shadowOpacity, 50),
  };
}

/**
 * Map a single layer node (and recurse into group children). Anything not
 * recognized is recorded in `unmapped` and rendered as a bounding-box rect so
 * the preview still shows something.
 */
function mapLayer(
  node: RawNode,
  byParent: Map<string | null, RawNode[]>,
  unmapped: Record<string, number>,
): any {
  const item = node.item;
  const id = node.id;
  const type = str(item.type);

  switch (type) {
    case "text":
    case "textImg":
      // textImg is rendered as text (it also carries a `textVector` SVG, but
      // text is the cleaner target). Spec allows treating textImg as image too.
      return mapTextLayer(id, item);

    case "image":
    case "gif":
      return mapImageLayer(id, item);

    case "rect":
      return mapRectLayer(id, item);

    case "ellipse":
    case "svg":
    case "shape":
    case "star":
    case "customShader":
      return mapVectorLayer(id, item, type);

    case "video":
      return {
        type: "video" as any,
        ...baseLayer(id, item),
        url: str(item.url),
        mediaName: item.mediaName ? str(item.mediaName) : undefined,
      };

    case "layerGrp": {
      const layers = childrenOf(byParent, id)
        .filter((c) => LAYER_TYPES.has(str(c.item.type)))
        .map((c) => mapLayer(c, byParent, unmapped))
        .filter(Boolean);
      return {
        type: "layerGrp" as const,
        ...baseLayer(id, item),
        background: !!item.background,
        fillColor: pickColor(item, "#ffffff"),
        clipsContent: !!item.clipsContent,
        shadowEnabled: !!item.shadowEnabled,
        shadowOffsetX: num(item.shadowOffsetX),
        shadowOffsetY: num(item.shadowOffsetY),
        shadowBlur: num(item.shadowBlur),
        shadowColor: str(item.shadowColor) || "#000000",
        shadowOpacity: num(item.shadowOpacity, 50),
        layers,
      };
    }

    case "maskGrp": {
      // A mask group: render as a clipping group. Children clipped by first child.
      const layers = childrenOf(byParent, id)
        .filter((c) => LAYER_TYPES.has(str(c.item.type)))
        .map((c) => mapLayer(c, byParent, unmapped))
        .filter(Boolean);
      return {
        type: "maskGrp" as any,
        ...baseLayer(id, item),
        background: !!item.background,
        fillColor: pickColor(item, "#ffffff"),
        clipsContent: true,
        layers,
      };
    }

    default:
      unmapped[type] = (unmapped[type] || 0) + 1;
      // Bounding-box fallback so preview is non-empty.
      return mapRectLayer(id, item);
  }
}

// ---------------------------------------------------------------------------
// Operation mapping (flat-node format)
// ---------------------------------------------------------------------------

/**
 * Map a single op node to a target operation object. Returns null for wrapper
 * nodes (opGrp) and records unknown op types in `unmapped`.
 *
 * Many of these op types are not yet present in the discriminated union in
 * jitterJson.ts (Stream R is extending it). We still emit them with the SPEC
 * field names so that, once the schema lands, `.safeParse` passes. Until then
 * the batch report shows them as failed/unmapped.
 */
function mapOp(
  node: RawNode,
  unmapped: Record<string, number>,
): any | null {
  const item = node.item;
  const id = node.id;
  const type = str(item.type);

  // Common op fields.
  const common = {
    id,
    targetId: str(item.targetId),
    startTime: num(item.startTime),
    endTime: item.endTime != null ? num(item.endTime) : undefined,
    easing: mapEasing(item.easing),
  };

  switch (type) {
    case "opGrp":
      return null; // organizational wrapper only (no time offset in data)

    case "move":
      // Jitter stores deltas as {moveX,moveY}; the schema's Vec2 wants {x,y}.
      return {
        type: "move",
        ...common,
        fromValue: moveVec(item.fromValue),
        toValue: moveVec(item.toValue),
      };

    case "scale":
      return {
        type: "scale",
        ...common,
        fromValue: item.fromValue,
        toValue: item.toValue,
      };

    case "rotate":
      return {
        type: "rotate",
        ...common,
        fromValue: item.fromValue,
        toValue: item.toValue,
      };

    case "opacity":
      return {
        type: "opacity",
        ...common,
        fromValue: item.fromValue,
        toValue: item.toValue,
      };

    case "color":
      return {
        type: "color",
        ...common,
        colorSpace: str(item.colorSpace) || "rgb",
        fromValue: item.fromValue,
        toValue: item.toValue,
      };

    case "cornerRadius":
      return {
        type: "cornerRadius",
        ...common,
        fromValue: item.fromValue,
        toValue: item.toValue,
      };

    case "resize":
      return {
        type: "resize",
        ...common,
        anchor: str(item.anchor) || "center",
        fromValue: item.fromValue ?? undefined,
        toValue: item.toValue ?? undefined,
      };

    case "hide":
    case "show":
      // Visibility cues — only a startTime.
      return { type, id, targetId: str(item.targetId), startTime: num(item.startTime) };

    case "blurRadius":
    case "blurIn":
    case "blurOut":
    case "blurScaleIn":
    case "blurScaleOut":
    case "blurSlideIn":
    case "blurSlideOut":
      return {
        type,
        ...common,
        fromValue: item.fromValue,
        toValue: item.toValue,
        direction: item.direction,
        distance: item.distance,
      };

    case "morph":
      return {
        type: "morph",
        ...common,
        fromValue: item.fromValue,
        toValue: item.toValue,
      };

    case "growIn":
    case "growOut":
    case "shrinkOut":
      return { type, ...common, scale: num(item.scale, 0) };

    case "shrinkIn":
      // Renderer has no shrinkIn — express as a grow from an oversized scale.
      return { type: "growIn", ...common, scale: num(item.scale, 1.4) };

    case "slideIn":
    case "slideOut":
      return {
        type,
        ...common,
        direction: str(item.direction) || "up",
        distance: num(item.distance, 40),
      };

    case "fadeIn":
    case "fadeOut":
      return { type, ...common };

    case "spinOut": {
      // Schema spinOut direction enum is cw|ccw; data uses clockwise|counterclockwise.
      const dir = str(item.direction).toLowerCase();
      return {
        type,
        ...common,
        angle: num(item.angle, 180),
        direction: dir.startsWith("counter") || dir === "ccw" ? "ccw" : "cw",
      };
    }

    case "spinIn": {
      // Renderer has no spinIn — compose a rotate-into-place + fade-in.
      const dir = str(item.direction).toLowerCase();
      const angle = num(item.angle, 180);
      const start = dir.startsWith("counter") || dir === "ccw" ? angle : -angle;
      return [
        { type: "rotate", ...common, fromValue: start, toValue: 0 },
        { type: "fadeIn", ...common },
      ];
    }

    case "twistIn": {
      // Rotate-and-scale entrance.
      const angle = num(item.angle, 90);
      return [
        { type: "rotate", ...common, fromValue: -angle, toValue: 0 },
        { type: "growIn", ...common, scale: 0 },
      ];
    }

    case "moveThenScaleIn":
      return [
        { type: "move", ...common, fromValue: moveVec(item.fromValue), toValue: moveVec(item.toValue) },
        { type: "growIn", ...common, scale: 0 },
      ];

    case "bulge":
      // Scale-pulse emphasis.
      return { type: "pulse", ...common };

    case "ellipseA":
    case "starA":
      // Animated shape draw-on → scale + fade reveal.
      return [
        { type: "growIn", ...common, scale: 0 },
        { type: "fadeIn", ...common },
      ];

    // Mask-reveal family → closest entrance/exit primitive.
    case "maskRevealIn":
      return { type: "fadeIn", ...common };
    case "maskRevealOut":
      return { type: "fadeOut", ...common };
    case "maskResizeIn":
    case "maskSizeIn":
    case "maskCenterIn":
    case "maskExpandIn":
    case "maskShrinkOut":
      return { type: "growIn", ...common, scale: 0 };
    case "maskSlideIn":
      return { type: "slideIn", ...common, direction: str(item.direction) || "up", distance: num(item.distance, 60) };
    case "maskSlideOut":
      return { type: "slideOut", ...common, direction: str(item.direction) || "down", distance: num(item.distance, 60) };

    case "stroke":
    case "shadow":
    case "customShader":
      // Property animations on an already-visible element (outline draw, shadow
      // pulse, shader). No DOM-faithful equivalent; intentionally inert so the
      // element still renders. Not counted as an unmapped gap.
      return null;

    case "textIn":
    case "textOut":
      return {
        type,
        ...common,
        effect: str(item.effect) || "appear",
        split: str(item.split) || "letters",
        order: str(item.order) || "forward",
        offset: num(item.offset, 50),
        nodeDuration: num(item.nodeDuration, 500),
        nodeEasing: mapEasing(item.nodeEasing),
        travelDistance: num(item.travelDistance, 20),
        slideDirection: str(item.slideDirection) || "up",
      };

    case "playVideo":
    case "playAudio":
      return {
        type,
        id,
        targetId: str(item.targetId),
        startTime: num(item.startTime),
        endTime: item.endTime != null ? num(item.endTime) : undefined,
        offset: num(item.offset),
        volume: item.volume != null ? num(item.volume) : undefined,
        url: item.url ? str(item.url) : undefined,
        mediaName: item.mediaName ? str(item.mediaName) : undefined,
        audioDuration: item.audioDuration,
      };

    default:
      unmapped[type] = (unmapped[type] || 0) + 1;
      return null;
  }
}

/** Recursively flatten an operationsTree subtree into a flat op list. */
function collectOps(
  parentId: string,
  byParent: Map<string | null, RawNode[]>,
  unmapped: Record<string, number>,
  out: any[],
): void {
  for (const child of childrenOf(byParent, parentId)) {
    const type = str(child.item.type);
    if (type === "opGrp") {
      // Flatten group children; opGrp carries no time offset in the corpus.
      collectOps(child.id, byParent, unmapped, out);
      continue;
    }
    const op = mapOp(child, unmapped);
    if (Array.isArray(op)) out.push(...op);
    else if (op) out.push(op);
    // Some ops can themselves nest (rare); recurse to be safe.
    collectOps(child.id, byParent, unmapped, out);
  }
}

// ---------------------------------------------------------------------------
// Flat-node document translation
// ---------------------------------------------------------------------------

function translateNodeDoc(
  raw: any,
  nodes: RawNode[],
  fallbackName: string,
  unmapped: Record<string, number>,
  notes: string[],
): JitterDocInputProps {
  const byParent = buildChildMap(nodes);

  // Artboards are top-level (parent === null / missing).
  const artboardNodes = nodes
    .filter((n) => str(n.item.type) === "artboard")
    .sort((a, b) => {
      const ia = a.position?.index ?? "";
      const ib = b.position?.index ?? "";
      return ia < ib ? -1 : ia > ib ? 1 : 0;
    });

  if (artboardNodes.length === 0) {
    notes.push("no artboard node found");
  }

  const first = artboardNodes[0];
  const ab = first?.item ?? {};

  // Locate the layersTree + operationsTree children of the first artboard.
  let layersTreeId: string | null = null;
  let opsTreeId: string | null = null;
  if (first) {
    for (const child of childrenOf(byParent, first.id)) {
      const t = str(child.item.type);
      if (t === "layersTree") layersTreeId = child.id;
      else if (t === "operationsTree") opsTreeId = child.id;
    }
  }

  const layers: any[] = [];
  if (layersTreeId) {
    for (const child of childrenOf(byParent, layersTreeId)) {
      if (LAYER_TYPES.has(str(child.item.type))) {
        const mapped = mapLayer(child, byParent, unmapped);
        if (mapped) layers.push(mapped);
      } else {
        unmapped[str(child.item.type)] =
          (unmapped[str(child.item.type)] || 0) + 1;
      }
    }
  } else if (first) {
    notes.push("artboard has no layersTree");
  }

  const operations: any[] = [];
  if (opsTreeId) collectOps(opsTreeId, byParent, unmapped, operations);
  else if (first) notes.push("artboard has no operationsTree");

  const artboard = {
    type: "artboard" as const,
    id: first?.id || "artboard",
    name: str(ab.name) || fallbackName,
    x: num(ab.x),
    y: num(ab.y),
    width: num(ab.width, 1920),
    height: num(ab.height, 1080),
    scale: num(ab.scale, 1),
    angle: num(ab.angle),
    opacity: num(ab.opacity, 100),
    cornerRadius: num(ab.cornerRadius),
    clipsContent: ab.clipsContent !== false,
    duration: num(ab.duration, 4000),
    fillColor: pickColor(ab, "#ffffff"),
    background: ab.background !== false,
    layers,
    operations,
  };

  return {
    name: fallbackName,
    fps: num(raw?.fps ?? raw?.project?.meta?.fps, 30),
    conf: {
      id: "root",
      version: 4,
      artboards: [artboard],
    },
  } as JitterDocInputProps;
}

// ---------------------------------------------------------------------------
// Legacy `conf` (nested-tree) document translation
// ---------------------------------------------------------------------------

function mapConfLayer(
  layer: any,
  unmapped: Record<string, number>,
): any {
  const type = str(layer.type);
  const id = str(layer.id) || Math.random().toString(36).slice(2);
  const item = layer;

  switch (type) {
    case "text":
    case "textImg":
      return mapTextLayer(id, item);
    case "image":
    case "gif":
      return mapImageLayer(id, item);
    case "rect":
      return mapRectLayer(id, item);
    case "ellipse":
    case "svg":
    case "shape":
    case "star":
    case "customShader":
      return mapVectorLayer(id, item, type);
    case "video":
      return {
        type: "video" as any,
        ...baseLayer(id, item),
        url: str(item.url),
        mediaName: item.mediaName ? str(item.mediaName) : undefined,
      };
    case "layerGrp":
    case "maskGrp":
      return {
        type: type === "maskGrp" ? ("maskGrp" as any) : ("layerGrp" as const),
        ...baseLayer(id, item),
        background: !!item.background,
        fillColor: pickColor(item, "#ffffff"),
        clipsContent: type === "maskGrp" ? true : !!item.clipsContent,
        shadowEnabled: !!item.shadowEnabled,
        shadowOffsetX: num(item.shadowOffsetX),
        shadowOffsetY: num(item.shadowOffsetY),
        shadowBlur: num(item.shadowBlur),
        shadowColor: str(item.shadowColor) || "#000000",
        shadowOpacity: num(item.shadowOpacity, 50),
        layers: (item.layers || [])
          .map((l: any) => mapConfLayer(l, unmapped))
          .filter(Boolean),
      };
    default:
      unmapped[type] = (unmapped[type] || 0) + 1;
      return mapRectLayer(id, item);
  }
}

/** Legacy conf ops are nested under layers and opGrp.operations. Flatten them. */
function collectConfOps(
  ops: any[] | undefined,
  unmapped: Record<string, number>,
  out: any[],
): void {
  for (const o of ops || []) {
    const type = str(o.type);
    if (type === "opGrp") {
      collectConfOps(o.operations, unmapped, out);
      continue;
    }
    const node: RawNode = {
      id: str(o.id) || Math.random().toString(36).slice(2),
      item: o,
      position: { parentId: null, index: "" },
    };
    const mapped = mapOp(node, unmapped);
    if (Array.isArray(mapped)) out.push(...mapped);
    else if (mapped) out.push(mapped);
  }
}

function walkConfLayersForOps(
  layers: any[] | undefined,
  unmapped: Record<string, number>,
  out: any[],
): void {
  for (const l of layers || []) {
    if (l.operations) collectConfOps(l.operations, unmapped, out);
    if (l.layers) walkConfLayersForOps(l.layers, unmapped, out);
  }
}

function translateConfDoc(
  raw: any,
  fallbackName: string,
  unmapped: Record<string, number>,
  notes: string[],
): JitterDocInputProps {
  const artboards = raw?.conf?.artboards;
  const ab = Array.isArray(artboards) && artboards.length ? artboards[0] : {};
  if (!Array.isArray(artboards) || artboards.length === 0)
    notes.push("conf has no artboards");

  const layers = (ab.layers || [])
    .map((l: any) => mapConfLayer(l, unmapped))
    .filter(Boolean);

  const operations: any[] = [];
  // Artboard-level ops + ops nested inside layers.
  collectConfOps(ab.operations, unmapped, operations);
  walkConfLayersForOps(ab.layers, unmapped, operations);

  const artboard = {
    type: "artboard" as const,
    id: str(ab.id) || "artboard",
    name: str(ab.name) || str(raw?.name) || fallbackName,
    x: num(ab.x),
    y: num(ab.y),
    width: num(ab.width, 1920),
    height: num(ab.height, 1080),
    scale: num(ab.scale, 1),
    angle: num(ab.angle),
    opacity: num(ab.opacity, 100),
    cornerRadius: num(ab.cornerRadius),
    clipsContent: ab.clipsContent !== false,
    duration: num(ab.duration, 4000),
    fillColor: pickColor(ab, "#ffffff"),
    background: ab.background !== false,
    layers,
    operations,
  };

  return {
    name: str(raw?.name) || fallbackName,
    fps: num(raw?.fps, 30),
    conf: {
      id: str(raw?.conf?.id) || "root",
      version: num(raw?.conf?.version, 4),
      artboards: [artboard],
    },
  } as JitterDocInputProps;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Translate a raw scraped Jitter doc into JitterDocInputProps.
 *
 * @param raw       the parsed raw JSON
 * @param idHint    optional id/name used when the doc carries none
 */
export function translateJitterDocDetailed(
  raw: any,
  idHint = "Untitled",
): TranslateResult {
  const unmapped: Record<string, number> = {};
  const notes: string[] = [];

  const nodes = getNodes(raw);
  if (nodes) {
    const shape: TranslateResult["shape"] =
      raw?.project && Array.isArray(raw.project.nodes)
        ? "project.nodes"
        : Array.isArray(raw?.nodes)
          ? "top.nodes"
          : "conf.nodes";
    const doc = translateNodeDoc(raw, nodes, str(raw?.name) || idHint, unmapped, notes);
    return { doc, unmapped, shape, notes };
  }

  if (raw?.conf?.artboards) {
    const doc = translateConfDoc(raw, str(raw?.name) || idHint, unmapped, notes);
    return { doc, unmapped, shape: "conf", notes };
  }

  // Unknown shape — emit an empty 1-artboard doc so downstream never crashes.
  notes.push("unknown raw shape");
  const doc: JitterDocInputProps = {
    name: str(raw?.name) || idHint,
    fps: 30,
    conf: {
      id: "root",
      version: 4,
      artboards: [
        {
          type: "artboard",
          id: "artboard",
          name: str(raw?.name) || idHint,
          x: 0,
          y: 0,
          width: 1920,
          height: 1080,
          scale: 1,
          angle: 0,
          opacity: 100,
          cornerRadius: 0,
          clipsContent: true,
          duration: 4000,
          fillColor: "#ffffff",
          background: true,
          layers: [],
          operations: [],
        },
      ],
    },
  } as JitterDocInputProps;
  return { doc, unmapped, shape: "unknown", notes };
}

/** Convenience wrapper matching the spec signature. */
export function translateJitterDoc(raw: any): JitterDocInputProps {
  return translateJitterDocDetailed(raw).doc;
}
