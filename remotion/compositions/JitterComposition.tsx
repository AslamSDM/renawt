/**
 * JITTER COMPOSITION (prototype)
 *
 * Renders a Jitter-style document (primitives + operations[] timeline) into
 * Remotion. Lives alongside JsonComposition.tsx — does not replace it.
 *
 * Times in the input JSON are MILLISECONDS. Frames derived via fps.
 */

import React from "react";
import * as Remotion from "remotion";
import {
  AbsoluteFill,
  Audio,
  Easing as RemotionEasing,
  Img,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
// @ts-ignore — no types ship for @babel/standalone CJS
import * as Babel from "@babel/standalone";
import { resolveFontFamily } from "../fonts/jitterFonts";
import { JITTER_BUILTINS } from "../jitter/builtins";

/** Components that must NOT live inside an isolated stacking context — their
 *  visual effect (mix-blend-mode, opacity flash) needs to reach the artboard. */
const BEAT_OVERLAYS = new Set([
  "BeatInvert",
  "BeatColorSwap",
  "BeatTextSwap",
]);

// ---- Types (mirror generate-server/lib/video/jitterJson.ts) ----

type Easing = "none" | "slowDown" | "natural" | "accelerate";

interface BaseLayer {
  id: string;
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  scale?: number;
  angle?: number;
  opacity?: number;
  cornerRadius?: number;
}

interface TextLayer extends BaseLayer {
  type: "text";
  text: string;
  color?: string;
  fontSize?: number;
  font?: { name?: string; weight?: number };
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "center" | "bottom";
  case?: "normal" | "upper" | "lower";
}

interface ImageLayer extends BaseLayer {
  type: "image";
  url: string;
  mediaName?: string;
}

interface TextImgLayer extends BaseLayer {
  type: "textImg";
  url?: string;
  textVector?: string;
  text?: string;
  mediaName?: string;
}

interface GifLayer extends BaseLayer {
  type: "gif";
  url: string;
  mediaName?: string;
}

interface VideoLayer extends BaseLayer {
  type: "video";
  url: string;
  mediaName?: string;
  fillColor?: string;
  volume?: number;
  loop?: boolean;
}

interface EllipseLayer extends BaseLayer {
  type: "ellipse";
  fillColor?: string;
  background?: boolean;
  strokeEnabled?: boolean;
  strokeColor?: string;
  strokeWeight?: number;
  startAngle?: number;
  sweep?: number;
}

interface StarLayer extends BaseLayer {
  type: "star";
  fillColor?: string;
  background?: boolean;
  strokeEnabled?: boolean;
  strokeColor?: string;
  strokeWeight?: number;
  spikes?: number;
  radiusRatio?: number;
}

interface SvgLayer extends BaseLayer {
  type: "svg" | "shape";
  url?: string;
  path?: string;
  fillColor?: string;
  background?: boolean;
  strokeEnabled?: boolean;
  strokeColor?: string;
  strokeWeight?: number;
  viewBoxWidth?: number;
  viewBoxHeight?: number;
}

interface CustomShaderLayer extends BaseLayer {
  type: "customShader";
  fillColor?: string;
}

interface MaskGroupLayer extends BaseLayer {
  type: "maskGrp";
  background?: boolean;
  fillColor?: string;
  clipsContent?: boolean;
  layers: AnyLayer[];
}

interface UnknownLayer extends BaseLayer {
  type: string;
  fillColor?: string;
  layers?: AnyLayer[];
}

interface RectLayer extends BaseLayer {
  type: "rect";
  fillColor?: string;
  shadowEnabled?: boolean;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowBlur?: number;
  shadowColor?: string;
  shadowOpacity?: number;
}

interface LayerGroup extends BaseLayer {
  type: "layerGrp";
  background?: boolean;
  fillColor?: string;
  clipsContent?: boolean;
  shadowEnabled?: boolean;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowBlur?: number;
  shadowColor?: string;
  shadowOpacity?: number;
  layers: AnyLayer[];
}

interface CustomLayer extends BaseLayer {
  type: "custom";
  component: string;
  props?: Record<string, unknown>;
}

interface JitterCustomComponent {
  name: string;
  source: string;
  description?: string;
}

// Known layer types form a proper discriminated union so `layer.type === "x"`
// narrows correctly. Unknown/unmapped types arrive at runtime and are handled
// in the render fallback via a cast — they are intentionally NOT part of this
// union (a `type: string` member would defeat all literal narrowing).
type AnyLayer =
  | TextLayer
  | ImageLayer
  | TextImgLayer
  | GifLayer
  | VideoLayer
  | RectLayer
  | EllipseLayer
  | StarLayer
  | SvgLayer
  | CustomShaderLayer
  | LayerGroup
  | MaskGroupLayer
  | CustomLayer;

interface OpBase {
  id: string;
  targetId: string;
  startTime: number;
  endTime?: number;
  easing?: Easing;
}

type Operation =
  | (OpBase & { type: "growIn"; scale?: number })
  | (OpBase & { type: "shrinkOut"; scale?: number })
  | (OpBase & {
      type: "resize";
      anchor?: "center" | "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
      fromValue?: { width?: number; height?: number };
      toValue?: { width?: number; height?: number };
    })
  | (OpBase & { type: "fadeIn" })
  | (OpBase & { type: "fadeOut" })
  | (OpBase & {
      type: "slideIn";
      direction?: "up" | "down" | "left" | "right";
      distance?: number;
    })
  | (OpBase & {
      type: "slideOut";
      direction?: "up" | "down" | "left" | "right";
      distance?: number;
    })
  | (OpBase & {
      type: "pulse";
      scaleAmount?: number;
      intervalMs?: number;
    })
  | (OpBase & {
      type: "textIn" | "textOut";
      effect?: "appear" | "slide" | "fade";
      split?: "letters" | "words" | "none";
      order?: "forward" | "reverse" | "random";
      offset?: number;
      nodeDuration?: number;
      nodeEasing?: Easing;
      travelDistance?: number;
      slideDirection?: "up" | "down" | "left" | "right";
    })
  | (OpBase & { type: "growOut"; scale?: number })
  | (OpBase & {
      type: "move";
      fromValue?: { x?: number; y?: number };
      toValue?: { x?: number; y?: number };
    })
  | (OpBase & { type: "scale"; fromValue?: number; toValue?: number })
  | (OpBase & { type: "rotate"; fromValue?: number; toValue?: number })
  | (OpBase & { type: "opacity"; fromValue?: number; toValue?: number })
  | (OpBase & { type: "color"; fromValue?: string; toValue?: string })
  | (OpBase & { type: "cornerRadius"; fromValue?: number; toValue?: number })
  | (OpBase & { type: "hide" })
  | (OpBase & { type: "show" })
  | (OpBase & { type: "blurRadius"; fromValue?: number; toValue?: number })
  | (OpBase & {
      type:
        | "blurIn"
        | "blurOut"
        | "blurScaleIn"
        | "blurScaleOut"
        | "blurSlideIn"
        | "blurSlideOut";
      blurRadius?: number;
      scale?: number;
      direction?: "up" | "down" | "left" | "right";
      distance?: number;
    })
  | (OpBase & { type: "morph"; fromValue?: unknown; toValue?: unknown })
  | (OpBase & {
      type: "spinOut";
      angle?: number;
      direction?: "cw" | "ccw";
    })
  | (OpBase & { type: "playVideo"; offset?: number; volume?: number })
  | (OpBase & {
      type: "playAudio";
      url?: string;
      offset?: number;
      volume?: number;
      audioDuration?: number;
    });

interface Artboard {
  id: string;
  name?: string;
  width: number;
  height: number;
  duration: number;
  fillColor?: string;
  background?: boolean;
  layers: AnyLayer[];
  operations: Operation[];
}

export interface JitterDocInputProps {
  name?: string;
  fps?: number;
  audio?: { url: string; bpm?: number; volume?: number } | null;
  narration?: {
    url: string;
    volume?: number;
    startMs?: number;
    durationMs?: number;
  } | null;
  captions?: {
    enabled?: boolean;
    style?: "bottom" | "centered" | "minimal";
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    background?: string;
    chunks?: { text: string; startMs: number; endMs: number }[];
  } | null;
  customComponents?: JitterCustomComponent[];
  conf: {
    artboards: Artboard[];
  };
}

type CustomMap = Record<string, React.ComponentType<any>>;

const CustomContext = React.createContext<CustomMap>({});

function transpileSource(source: string): string {
  // Babel @babel/standalone transforms JSX → React.createElement and keeps
  // the function declaration intact. Strip "use strict" prelude — we add our own.
  const result = (Babel as any).transform(source, {
    presets: [
      ["env", { targets: { esmodules: true }, loose: true }],
      ["react", { runtime: "classic", pragma: "React.createElement", pragmaFrag: "React.Fragment" }],
      "typescript",
    ],
    filename: "custom.tsx",
    sourceMaps: false,
    compact: false,
  });
  return result.code as string;
}

function compileCustomComponents(
  defs: JitterCustomComponent[] | undefined,
): CustomMap {
  if (!defs || defs.length === 0) return {};
  const map: CustomMap = {};
  for (const def of defs) {
    try {
      const compiled = transpileSource(def.source);
      // Build a fn that returns the component identified by def.name.
      const factory = new Function(
        "React",
        "Remotion",
        `"use strict";
        const { AbsoluteFill, Audio, Sequence, Img, useCurrentFrame, useVideoConfig, interpolate, spring, staticFile } = Remotion;
        ${compiled}
        return typeof ${def.name} === "function" ? ${def.name} : null;`,
      );
      const Comp = factory(React, Remotion);
      if (typeof Comp === "function") map[def.name] = Comp;
    } catch (err) {
      // Replace failing component with a debug placeholder
      // eslint-disable-next-line no-console
      console.error(`Jitter custom component ${def.name} failed:`, err);
      map[def.name] = (props: any) => (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "#400",
            color: "#fff",
            padding: 12,
            fontFamily: "monospace",
            fontSize: 14,
          }}
        >
          Custom {def.name} error: {String((err as Error)?.message || err)}
        </div>
      );
    }
  }
  return map;
}

// ---- Easings ----

/**
 * Jitter easing → eased progress. Mirrors Remotion's Easing curves:
 *   none       → linear
 *   slowDown   → ease-out (cubic)         Remotion: Easing.out(Easing.cubic)
 *   accelerate → ease-in (cubic)          Remotion: Easing.in(Easing.cubic)
 *   natural    → ease-in-out (cubic)      Remotion: Easing.inOut(Easing.cubic)
 * Unknown/object easings (raw Jitter passthrough) fall back to "natural".
 */
const EASING_FNS: Record<Easing, (x: number) => number> = {
  none: RemotionEasing.linear,
  slowDown: RemotionEasing.out(RemotionEasing.cubic),
  accelerate: RemotionEasing.in(RemotionEasing.cubic),
  natural: RemotionEasing.inOut(RemotionEasing.cubic),
};

function ease(t: number, kind?: Easing | string): number {
  const x = Math.max(0, Math.min(1, t));
  const fn =
    typeof kind === "string" && kind in EASING_FNS
      ? EASING_FNS[kind as Easing]
      : EASING_FNS.natural;
  return fn(x);
}

// ---- Layer state computation ----

interface LayerState {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  opacity: number; // 0..100
  angle: number;
  blur: number; // CSS blur in px
  cornerRadius?: number;
  fillColor?: string; // overridden by `color` op
  visible: boolean; // hide/show toggles
  textProgress?: TextProgress;
  scaleOrigin?: string; // CSS transform-origin
}

interface TextNodeState {
  opacity: number;
  translateX: number;
  translateY: number;
}

interface TextProgress {
  split: "letters" | "words" | "none";
  nodes: TextNodeState[];
}

function msToFrames(ms: number, fps: number): number {
  return (ms * fps) / 1000;
}

function baseState(layer: AnyLayer): LayerState {
  return {
    x: layer.x ?? 0,
    y: layer.y ?? 0,
    width: layer.width ?? 100,
    height: layer.height ?? 100,
    scale: layer.scale ?? 1,
    opacity: layer.opacity ?? 100,
    angle: layer.angle ?? 0,
    blur: 0,
    cornerRadius: layer.cornerRadius,
    fillColor: (layer as { fillColor?: string }).fillColor,
    visible: true,
  };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Parse any Jitter color form — hex string, {r,g,b} object (0–255 or 0–1),
 *  or [r,g,b] array — into an rgb triple. Returns null if unrecognizable. */
function colorToRgb(c: unknown): [number, number, number] | null {
  if (typeof c === "string") {
    let h = c.trim().replace(/^#/, "");
    if (h.length === 3) h = h.split("").map((x) => x + x).join("");
    if (h.length !== 6) return null;
    const n = parseInt(h, 16);
    if (Number.isNaN(n)) return null;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const pick = (...vals: unknown[]): number | null => {
    const v = vals.find((x) => typeof x === "number");
    return typeof v === "number" ? v : null;
  };
  let r: number | null = null,
    g: number | null = null,
    b: number | null = null;
  if (Array.isArray(c) && c.length >= 3) {
    [r, g, b] = [pick(c[0]), pick(c[1]), pick(c[2])];
  } else if (c && typeof c === "object") {
    const o = c as Record<string, unknown>;
    r = pick(o.r, o.red);
    g = pick(o.g, o.green);
    b = pick(o.b, o.blue);
  }
  if (r == null || g == null || b == null) return null;
  // Channels in 0–1 → scale to 0–255.
  const scale = r <= 1 && g <= 1 && b <= 1 ? 255 : 1;
  return [Math.round(r * scale), Math.round(g * scale), Math.round(b * scale)];
}

function rgbStr(rgb: [number, number, number]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

/** Linear interpolate two colors (any form); falls back to whichever end
 *  parses, else a safe string, so it never throws on non-hex input. */
function lerpColor(from: unknown, to: unknown, t: number): string {
  const a = colorToRgb(from);
  const b = colorToRgb(to);
  if (a && b) {
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return `rgb(${r}, ${g}, ${bl})`;
  }
  const fallback = t < 0.5 ? a : b;
  if (fallback) return rgbStr(fallback);
  return typeof (t < 0.5 ? from : to) === "string"
    ? ((t < 0.5 ? from : to) as string)
    : "transparent";
}

/** Ops the renderer has chosen to ignore — warned about once each. */
const warnedOps = new Set<string>();
function warnUnknownOp(type: string): void {
  if (warnedOps.has(type)) return;
  warnedOps.add(type);
  console.warn(`[Jitter] unsupported op "${type}" — treated as no-op`);
}

/** Unknown layer types — warned about once each. */
const warnedLayers = new Set<string>();
function warnUnknownLayer(type: string): void {
  if (warnedLayers.has(type)) return;
  warnedLayers.add(type);
  console.warn(
    `[Jitter] unsupported layer "${type}" — bounding-box fallback`,
  );
}

function splitText(text: string, mode: "letters" | "words" | "none"): string[] {
  if (mode === "none") return [text];
  if (mode === "words") return text.split(/(\s+)/);
  return Array.from(text);
}

function applyOperation(
  state: LayerState,
  layer: AnyLayer,
  op: Operation,
  frame: number,
  fps: number,
): LayerState {
  const startF = msToFrames(op.startTime, fps);
  const endF =
    op.endTime != null ? msToFrames(op.endTime, fps) : startF + msToFrames(500, fps);
  if (frame < startF) {
    // Pre-start: many ops need an "initial" pose (e.g. growIn starts at scale=0).
    return applyPreStart(state, layer, op);
  }
  const rawT = endF > startF ? (frame - startF) / (endF - startF) : 1;
  const t = ease(Math.max(0, Math.min(1, rawT)), op.easing);

  switch (op.type) {
    case "growIn": {
      const from = op.scale ?? 0;
      const to = layer.scale ?? 1;
      return { ...state, scale: from + (to - from) * t, scaleOrigin: "center" };
    }
    case "shrinkOut": {
      const from = layer.scale ?? 1;
      const to = op.scale ?? 0;
      return { ...state, scale: from + (to - from) * t, scaleOrigin: "center" };
    }
    case "resize": {
      const baseW = layer.width ?? state.width;
      const baseH = layer.height ?? state.height;
      const fromW = op.fromValue?.width ?? baseW;
      const fromH = op.fromValue?.height ?? baseH;
      const toW = op.toValue?.width ?? baseW;
      const toH = op.toValue?.height ?? baseH;
      const w = fromW + (toW - fromW) * t;
      const h = fromH + (toH - fromH) * t;
      const anchor = op.anchor ?? "center";
      let dx = 0;
      let dy = 0;
      if (anchor === "center" || anchor === "topRight" || anchor === "bottomRight") {
        dx = anchor === "center" ? (baseW - w) / 2 : baseW - w;
      }
      if (anchor === "center" || anchor === "bottomLeft" || anchor === "bottomRight") {
        dy = anchor === "center" ? (baseH - h) / 2 : baseH - h;
      }
      return {
        ...state,
        width: w,
        height: h,
        x: (layer.x ?? 0) + dx,
        y: (layer.y ?? 0) + dy,
      };
    }
    case "fadeIn":
      return { ...state, opacity: t * (layer.opacity ?? 100) };
    case "fadeOut":
      return { ...state, opacity: (1 - t) * (layer.opacity ?? 100) };
    case "slideIn": {
      const dist = op.distance ?? 40;
      const dir = op.direction ?? "up";
      const remaining = (1 - t) * dist;
      let dx = 0;
      let dy = 0;
      if (dir === "up") dy = remaining;
      if (dir === "down") dy = -remaining;
      if (dir === "left") dx = remaining;
      if (dir === "right") dx = -remaining;
      return {
        ...state,
        x: state.x + dx,
        y: state.y + dy,
        opacity: t * (layer.opacity ?? 100),
      };
    }
    case "slideOut": {
      const dist = op.distance ?? 60;
      const dir = op.direction ?? "down";
      const travel = t * dist;
      let dx = 0;
      let dy = 0;
      if (dir === "up") dy = -travel;
      if (dir === "down") dy = travel;
      if (dir === "left") dx = -travel;
      if (dir === "right") dx = travel;
      return {
        ...state,
        x: state.x + dx,
        y: state.y + dy,
        opacity: (1 - t) * (layer.opacity ?? 100),
      };
    }
    case "pulse": {
      // Pulse runs only inside [startTime, endTime]. Outside → base state.
      if (op.endTime != null && frame > endF) return state;
      const amount = op.scaleAmount ?? 0.04;
      const intervalMs = op.intervalMs ?? 484;
      const intervalFrames = Math.max(1, (intervalMs * fps) / 1000);
      const local = frame - startF;
      const phase = (local / intervalFrames) * Math.PI * 2;
      const wave = (Math.sin(phase) + 1) / 2; // 0..1
      return {
        ...state,
        scale: state.scale * (1 + amount * wave),
        scaleOrigin: "center",
      };
    }
    case "textIn":
    case "textOut": {
      if (layer.type !== "text") return state;
      const isOut = op.type === "textOut";
      const split = op.split ?? "letters";
      const order = op.order ?? "forward";
      const offsetMs = op.offset ?? 50;
      const nodeDurMs = op.nodeDuration ?? 500;
      const dist = op.travelDistance ?? 20;
      const dir = op.slideDirection ?? (isOut ? "down" : "up");
      const effect = op.effect ?? (isOut ? "fade" : "appear");
      const full = layer.opacity ?? 100;

      const tokens = splitText(layer.text, split);
      const indices = tokens.map((_, i) => i);
      if (order === "reverse") indices.reverse();
      // (random: deterministic shuffle could go here; skip for now.)

      const nodes: TextNodeState[] = tokens.map(() => ({
        opacity: full,
        translateX: 0,
        translateY: 0,
      }));

      tokens.forEach((_, i) => {
        const animOrderIdx = indices.indexOf(i);
        const nodeStartMs = op.startTime + offsetMs * animOrderIdx;
        const nodeEndMs = nodeStartMs + nodeDurMs;
        const nodeStartF = msToFrames(nodeStartMs, fps);
        const nodeEndF = msToFrames(nodeEndMs, fps);
        let nt = 0;
        if (frame >= nodeEndF) nt = 1;
        else if (frame <= nodeStartF) nt = 0;
        else nt = (frame - nodeStartF) / (nodeEndF - nodeStartF);
        const eased = ease(nt, op.nodeEasing);
        // For textOut, the per-token "progress" is the disappearance amount.
        const vis = isOut ? 1 - eased : eased;
        const visStep = isOut ? (nt >= 1 ? 0 : 1) : nt > 0 ? 1 : 0;
        if (effect === "appear") {
          nodes[i].opacity = visStep * full;
        } else if (effect === "fade") {
          nodes[i].opacity = vis * full;
        } else {
          // slide
          nodes[i].opacity = vis * full;
          const remaining = (1 - vis) * dist;
          if (dir === "up") nodes[i].translateY = remaining;
          if (dir === "down") nodes[i].translateY = -remaining;
          if (dir === "left") nodes[i].translateX = remaining;
          if (dir === "right") nodes[i].translateX = -remaining;
        }
      });

      return {
        ...state,
        textProgress: { split, nodes },
      };
    }
    case "growOut": {
      const from = layer.scale ?? 1;
      const to = op.scale ?? 0;
      return {
        ...state,
        scale: from + (to - from) * t,
        opacity: (1 - t) * state.opacity,
        scaleOrigin: "center",
      };
    }
    case "move": {
      const fromX = op.fromValue?.x ?? 0;
      const fromY = op.fromValue?.y ?? 0;
      const toX = op.toValue?.x ?? 0;
      const toY = op.toValue?.y ?? 0;
      return {
        ...state,
        x: state.x + (fromX + (toX - fromX) * t),
        y: state.y + (fromY + (toY - fromY) * t),
      };
    }
    case "scale": {
      const from = op.fromValue ?? layer.scale ?? 1;
      const to = op.toValue ?? layer.scale ?? 1;
      return {
        ...state,
        scale: from + (to - from) * t,
        scaleOrigin: "center",
      };
    }
    case "rotate": {
      const from = op.fromValue ?? layer.angle ?? 0;
      const to = op.toValue ?? layer.angle ?? 0;
      return { ...state, angle: from + (to - from) * t };
    }
    case "opacity": {
      const from = op.fromValue ?? state.opacity;
      const to = op.toValue ?? state.opacity;
      return { ...state, opacity: from + (to - from) * t };
    }
    case "color": {
      const from = op.fromValue ?? state.fillColor ?? "#000000";
      const to = op.toValue ?? state.fillColor ?? from;
      return { ...state, fillColor: lerpColor(from, to, t) };
    }
    case "cornerRadius": {
      const from = op.fromValue ?? state.cornerRadius ?? 0;
      const to = op.toValue ?? state.cornerRadius ?? 0;
      return { ...state, cornerRadius: from + (to - from) * t };
    }
    case "blurRadius": {
      const from = op.fromValue ?? 0;
      const to = op.toValue ?? 0;
      return { ...state, blur: from + (to - from) * t };
    }
    case "hide": {
      // Hidden from startTime onward.
      return { ...state, visible: false };
    }
    case "show": {
      // Visible from startTime onward (pre-start handled in applyPreStart).
      return { ...state, visible: true };
    }
    case "blurIn":
    case "blurScaleIn":
    case "blurSlideIn": {
      const peak = op.blurRadius ?? 40;
      const blur = (1 - t) * peak;
      let next: LayerState = {
        ...state,
        blur: state.blur + blur,
        opacity: t * state.opacity,
      };
      if (op.type === "blurScaleIn") {
        const from = op.scale ?? 0.8;
        next = { ...next, scale: from + (1 - from) * t, scaleOrigin: "center" };
      }
      if (op.type === "blurSlideIn") {
        const dist = op.distance ?? 40;
        const dir = op.direction ?? "up";
        const remaining = (1 - t) * dist;
        if (dir === "up") next.y += remaining;
        if (dir === "down") next.y -= remaining;
        if (dir === "left") next.x += remaining;
        if (dir === "right") next.x -= remaining;
      }
      return next;
    }
    case "blurOut":
    case "blurScaleOut":
    case "blurSlideOut": {
      const peak = op.blurRadius ?? 40;
      const blur = t * peak;
      let next: LayerState = {
        ...state,
        blur: state.blur + blur,
        opacity: (1 - t) * state.opacity,
      };
      if (op.type === "blurScaleOut") {
        const to = op.scale ?? 0.8;
        next = { ...next, scale: 1 + (to - 1) * t, scaleOrigin: "center" };
      }
      if (op.type === "blurSlideOut") {
        const dist = op.distance ?? 40;
        const dir = op.direction ?? "down";
        const travel = t * dist;
        if (dir === "up") next.y -= travel;
        if (dir === "down") next.y += travel;
        if (dir === "left") next.x -= travel;
        if (dir === "right") next.x += travel;
      }
      return next;
    }
    case "morph": {
      // Best-effort: a soft resize + opacity dip-and-recover crossfade.
      const dip = Math.sin(t * Math.PI); // 0 → 1 → 0
      return {
        ...state,
        opacity: state.opacity * (1 - 0.25 * dip),
        scale: state.scale * (1 + 0.04 * dip),
        scaleOrigin: "center",
      };
    }
    case "spinOut": {
      const spin = op.angle ?? 180;
      const sign = op.direction === "ccw" ? -1 : 1;
      return {
        ...state,
        angle: state.angle + sign * spin * t,
        opacity: (1 - t) * state.opacity,
        scaleOrigin: "center",
      };
    }
    case "playVideo":
    case "playAudio":
      // Media start cues — handled by the media layer / audio sequence, not a
      // transform. No-op for layer state.
      return state;
    default:
      warnUnknownOp((op as { type: string }).type);
      return state;
  }
}

function applyPreStart(
  state: LayerState,
  layer: AnyLayer,
  op: Operation,
): LayerState {
  switch (op.type) {
    case "growIn":
      return { ...state, scale: op.scale ?? 0, scaleOrigin: "center" };
    case "fadeIn":
      return { ...state, opacity: 0 };
    case "slideIn": {
      const dist = op.distance ?? 40;
      const dir = op.direction ?? "up";
      let dx = 0;
      let dy = 0;
      if (dir === "up") dy = dist;
      if (dir === "down") dy = -dist;
      if (dir === "left") dx = dist;
      if (dir === "right") dx = -dist;
      return { ...state, x: state.x + dx, y: state.y + dy, opacity: 0 };
    }
    case "resize": {
      const baseW = layer.width ?? state.width;
      const baseH = layer.height ?? state.height;
      const fromW = op.fromValue?.width ?? baseW;
      const fromH = op.fromValue?.height ?? baseH;
      const anchor = op.anchor ?? "center";
      let dx = 0;
      let dy = 0;
      if (anchor === "center" || anchor === "topRight" || anchor === "bottomRight") {
        dx = anchor === "center" ? (baseW - fromW) / 2 : baseW - fromW;
      }
      if (anchor === "center" || anchor === "bottomLeft" || anchor === "bottomRight") {
        dy = anchor === "center" ? (baseH - fromH) / 2 : baseH - fromH;
      }
      return {
        ...state,
        width: fromW,
        height: fromH,
        x: (layer.x ?? 0) + dx,
        y: (layer.y ?? 0) + dy,
      };
    }
    case "textIn": {
      if (layer.type !== "text") return state;
      const tokens = splitText(layer.text, op.split ?? "letters");
      return {
        ...state,
        textProgress: {
          split: op.split ?? "letters",
          nodes: tokens.map(() => ({ opacity: 0, translateX: 0, translateY: 0 })),
        },
      };
    }
    case "move": {
      // Hold the "from" pose before the move begins.
      const fromX = op.fromValue?.x ?? 0;
      const fromY = op.fromValue?.y ?? 0;
      return { ...state, x: state.x + fromX, y: state.y + fromY };
    }
    case "scale":
      return op.fromValue != null
        ? { ...state, scale: op.fromValue, scaleOrigin: "center" }
        : state;
    case "rotate":
      return op.fromValue != null ? { ...state, angle: op.fromValue } : state;
    case "opacity":
      return op.fromValue != null ? { ...state, opacity: op.fromValue } : state;
    case "color":
      return op.fromValue != null ? { ...state, fillColor: op.fromValue } : state;
    case "cornerRadius":
      return op.fromValue != null ? { ...state, cornerRadius: op.fromValue } : state;
    case "blurRadius":
      return op.fromValue != null ? { ...state, blur: op.fromValue } : state;
    case "blurIn":
    case "blurScaleIn":
    case "blurSlideIn": {
      // Entrance ops start fully blurred / invisible.
      const peak = op.blurRadius ?? 40;
      let next: LayerState = { ...state, blur: state.blur + peak, opacity: 0 };
      if (op.type === "blurScaleIn") {
        next = { ...next, scale: op.scale ?? 0.8, scaleOrigin: "center" };
      }
      if (op.type === "blurSlideIn") {
        const dist = op.distance ?? 40;
        const dir = op.direction ?? "up";
        if (dir === "up") next.y += dist;
        if (dir === "down") next.y -= dist;
        if (dir === "left") next.x += dist;
        if (dir === "right") next.x -= dist;
      }
      return next;
    }
    case "show":
      // Hidden until the show op fires.
      return { ...state, visible: false };
    default:
      return state;
  }
}

function resolveLayerState(
  layer: AnyLayer,
  ops: Operation[],
  frame: number,
  fps: number,
): LayerState {
  let s = baseState(layer);
  const applicable = ops.filter((o) => o.targetId === layer.id);
  for (const op of applicable) {
    s = applyOperation(s, layer, op, frame, fps);
  }
  return s;
}

// ---- Rendering ----

function renderText(layer: TextLayer, st: LayerState) {
  const fontFamily = resolveFontFamily(layer.font?.name);
  const weight = layer.font?.weight ?? 500;
  const baseStyle: React.CSSProperties = {
    fontFamily,
    fontWeight: weight,
    fontSize: layer.fontSize ?? 24,
    color: layer.color ?? "#000",
    lineHeight: `${layer.lineHeight ?? 150}%`,
    letterSpacing: layer.letterSpacing ?? 0,
    textAlign: layer.textAlign ?? "left",
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems:
      layer.verticalAlign === "center"
        ? "center"
        : layer.verticalAlign === "bottom"
          ? "flex-end"
          : "flex-start",
    justifyContent:
      layer.textAlign === "center"
        ? "center"
        : layer.textAlign === "right"
          ? "flex-end"
          : "flex-start",
    textTransform:
      layer.case === "upper"
        ? "uppercase"
        : layer.case === "lower"
          ? "lowercase"
          : "none",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    overflow: "hidden",
    boxSizing: "border-box",
  };

  const prog = st.textProgress;
  if (!prog) {
    return <div style={baseStyle}>{layer.text}</div>;
  }
  const tokens = splitText(layer.text, prog.split);
  return (
    <div style={baseStyle}>
      <span
        style={{
          display: "inline",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {tokens.map((tok, i) => {
          const node = prog.nodes[i] ?? {
            opacity: 100,
            translateX: 0,
            translateY: 0,
          };
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: node.opacity / 100,
                transform: `translate(${node.translateX}px, ${node.translateY}px)`,
                whiteSpace: "pre-wrap",
              }}
            >
              {tok}
            </span>
          );
        })}
      </span>
    </div>
  );
}

function resolveImageSrc(url: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("data:")) return url;
  // Custom Jitter asset schemes (userAsset:, localAsset:, …) aren't fetchable
  // at render time. Returning "" makes the caller skip <Img> so it doesn't hang
  // on a delayRender() that never clears.
  if (/^[a-zA-Z][\w+.-]*:/.test(url)) return "";
  return staticFile(url.replace(/^\//, ""));
}

/** <Img> blocks the render until decode; skip entirely when the src isn't a
 *  fetchable url so an unresolvable asset can't stall/fail the whole render. */
function SafeImg({
  url,
  alt,
  style,
}: {
  url?: string;
  alt?: string;
  style?: React.CSSProperties;
}) {
  const src = resolveImageSrc(url ?? "");
  if (!src) return null;
  return (
    <Img
      src={src}
      alt={alt ?? ""}
      style={style}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
      }}
    />
  );
}

function renderImage(layer: ImageLayer) {
  // Remotion <Img> blocks the render via delayRender() until the bitmap is
  // decoded — a plain <img> lets the frame capture race ahead of the network
  // fetch, which is why logos/screenshots came out blank. onError keeps a
  // single bad asset (e.g. dead R2 url) from cancelling the whole render.
  return (
    <SafeImg
      url={layer.url}
      alt={layer.mediaName ?? ""}
      style={{ width: "100%", height: "100%", objectFit: "contain" }}
    />
  );
}

function renderRect(layer: RectLayer, st: LayerState) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: st.fillColor ?? layer.fillColor ?? "#fff",
        borderRadius: st.cornerRadius ?? layer.cornerRadius ?? 0,
        boxShadow: layer.shadowEnabled
          ? `${layer.shadowOffsetX ?? 0}px ${layer.shadowOffsetY ?? 0}px ${layer.shadowBlur ?? 0}px rgba(0,0,0,${(layer.shadowOpacity ?? 50) / 100})`
          : undefined,
      }}
    />
  );
}

function renderEllipse(layer: EllipseLayer, st: LayerState) {
  const fill =
    layer.background === false ? "none" : st.fillColor ?? layer.fillColor ?? "#fff";
  const stroke = layer.strokeEnabled ? layer.strokeColor ?? "#000" : "none";
  const strokeW = layer.strokeEnabled ? layer.strokeWeight ?? 0 : 0;
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ display: "block", overflow: "visible" }}
    >
      <ellipse
        cx={50}
        cy={50}
        rx={50 - strokeW / 2}
        ry={50 - strokeW / 2}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeW}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Build an SVG star polygon points string in a 0..100 viewBox. */
function starPoints(spikes: number, radiusRatio: number): string {
  const cx = 50;
  const cy = 50;
  const outer = 50;
  const inner = (Math.max(0, Math.min(100, radiusRatio)) / 100) * outer;
  const pts: string[] = [];
  const n = Math.max(3, Math.round(spikes));
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / n) * i - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  return pts.join(" ");
}

function renderStar(layer: StarLayer, st: LayerState) {
  const fill =
    layer.background === false ? "none" : st.fillColor ?? layer.fillColor ?? "#fff";
  const stroke = layer.strokeEnabled ? layer.strokeColor ?? "#000" : "none";
  const strokeW = layer.strokeEnabled ? layer.strokeWeight ?? 0 : 0;
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ display: "block", overflow: "visible" }}
    >
      <polygon
        points={starPoints(layer.spikes ?? 5, layer.radiusRatio ?? 50)}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeW}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function renderSvg(layer: SvgLayer, st: LayerState) {
  // Prefer a data-uri svg export when present (Jitter ships svg layers this way).
  // Only when it's a fetchable url — otherwise fall through to the path/box.
  if (resolveImageSrc(layer.url ?? "")) {
    return (
      <SafeImg
        url={layer.url}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    );
  }
  // Otherwise draw the extracted path `d` directly.
  if (layer.path) {
    const vbW = layer.viewBoxWidth ?? layer.width ?? 100;
    const vbH = layer.viewBoxHeight ?? layer.height ?? 100;
    const fill =
      layer.background === false ? "none" : st.fillColor ?? layer.fillColor ?? "#000";
    const stroke = layer.strokeEnabled ? layer.strokeColor ?? "#000" : "none";
    const strokeW = layer.strokeEnabled ? layer.strokeWeight ?? 0 : 0;
    return (
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${vbW} ${vbH}`}
        preserveAspectRatio="none"
        style={{ display: "block", overflow: "visible" }}
      >
        <path
          d={layer.path}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeW}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }
  // Nothing renderable — fall back to a faint box so layout stays intact.
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: st.fillColor ?? layer.fillColor ?? "transparent",
      }}
    />
  );
}

function renderTextImg(layer: TextImgLayer) {
  const src = layer.textVector ?? layer.url;
  // Render as image only when it resolves to a fetchable url; otherwise show
  // the text fallback so nothing hangs on an unresolvable asset.
  if (resolveImageSrc(src ?? "")) {
    return (
      <SafeImg
        url={src}
        alt={layer.text ?? layer.mediaName ?? ""}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    );
  }
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
      }}
    >
      {layer.text ?? ""}
    </div>
  );
}

function renderGif(layer: GifLayer) {
  // GIFs render via <Img>; the browser animates them during capture.
  return (
    <SafeImg
      url={layer.url}
      alt={layer.mediaName ?? ""}
      style={{ width: "100%", height: "100%", objectFit: "contain" }}
    />
  );
}

function renderVideo(layer: VideoLayer) {
  const src = layer.url ?? "";
  const isRemote =
    src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:");
  // localAsset: / unresolved urls can't be fetched — show a fill placeholder.
  if (!isRemote) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: layer.fillColor ?? "#000",
        }}
      />
    );
  }
  return (
    <OffthreadVideo
      src={src}
      muted={(layer.volume ?? 0) <= 0}
      volume={layer.volume ?? 0}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}

function LayerNode({
  layer,
  ops,
  frame,
  fps,
}: {
  layer: AnyLayer;
  ops: Operation[];
  frame: number;
  fps: number;
}) {
  const isBeatOverlay =
    layer.type === "custom" && BEAT_OVERLAYS.has(layer.component);
  // Beat overlays render at base state (no ops applied at the wrapper) so
  // mix-blend-mode and flash effects reach the artboard.
  const st = isBeatOverlay
    ? baseState(layer)
    : resolveLayerState(layer, ops, frame, fps);
  // Only set transform when it actually changes anything — a non-`none` transform
  // creates a stacking context that traps mix-blend-mode inside this wrapper.
  // hide/show ops can drop a layer out of the frame entirely.
  if (!isBeatOverlay && st.visible === false) return null;
  const hasTransform =
    !isBeatOverlay && (st.scale !== 1 || st.angle !== 0);
  const containerStyle: React.CSSProperties = {
    position: "absolute",
    left: st.x,
    top: st.y,
    width: st.width,
    height: st.height,
    opacity: isBeatOverlay ? 1 : st.opacity / 100,
    borderRadius: st.cornerRadius ?? layer.cornerRadius ?? 0,
    ...(st.blur > 0.01 ? { filter: `blur(${st.blur}px)` } : {}),
    ...(hasTransform
      ? {
          transform: `rotate(${st.angle}deg) scale(${st.scale})`,
          transformOrigin: st.scaleOrigin ?? "center",
        }
      : {}),
  };

  if (layer.type === "layerGrp") {
    const grp = layer;
    return (
      <div
        style={{
          ...containerStyle,
          backgroundColor: grp.background ? grp.fillColor ?? "#fff" : undefined,
          overflow: grp.clipsContent ? "hidden" : "visible",
          boxShadow: grp.shadowEnabled
            ? `${grp.shadowOffsetX ?? 0}px ${grp.shadowOffsetY ?? 0}px ${grp.shadowBlur ?? 0}px rgba(0,0,0,${(grp.shadowOpacity ?? 50) / 100})`
            : undefined,
        }}
      >
        {grp.layers.map((child) => (
          <LayerNode
            key={child.id}
            layer={child}
            ops={ops}
            frame={frame}
            fps={fps}
          />
        ))}
      </div>
    );
  }

  if (layer.type === "maskGrp") {
    // Mask group — clip children to the group's box.
    const grp = layer;
    return (
      <div
        style={{
          ...containerStyle,
          backgroundColor: grp.background ? grp.fillColor ?? "#fff" : undefined,
          overflow: grp.clipsContent === false ? "visible" : "hidden",
          borderRadius: st.cornerRadius ?? layer.cornerRadius ?? 0,
        }}
      >
        {(grp.layers ?? []).map((child) => (
          <LayerNode
            key={child.id}
            layer={child}
            ops={ops}
            frame={frame}
            fps={fps}
          />
        ))}
      </div>
    );
  }

  if (layer.type === "text") {
    return <div style={containerStyle}>{renderText(layer, st)}</div>;
  }
  if (layer.type === "image") {
    return <div style={containerStyle}>{renderImage(layer)}</div>;
  }
  if (layer.type === "textImg") {
    return <div style={containerStyle}>{renderTextImg(layer)}</div>;
  }
  if (layer.type === "gif") {
    return <div style={containerStyle}>{renderGif(layer)}</div>;
  }
  if (layer.type === "video") {
    return <div style={containerStyle}>{renderVideo(layer)}</div>;
  }
  if (layer.type === "rect") {
    return <div style={containerStyle}>{renderRect(layer, st)}</div>;
  }
  if (layer.type === "ellipse") {
    return <div style={containerStyle}>{renderEllipse(layer, st)}</div>;
  }
  if (layer.type === "star") {
    return <div style={containerStyle}>{renderStar(layer, st)}</div>;
  }
  if (layer.type === "svg" || layer.type === "shape") {
    return <div style={containerStyle}>{renderSvg(layer, st)}</div>;
  }
  if (layer.type === "customShader") {
    // No WebGL — render the layer's fill as a flat rect.
    return (
      <div
        style={{
          ...containerStyle,
          backgroundColor: st.fillColor ?? layer.fillColor ?? "#000",
        }}
      />
    );
  }
  if (layer.type === "custom") {
    return (
      <div style={containerStyle}>
        <CustomLayerHost layer={layer} />
      </div>
    );
  }
  // Unknown layer type → bounding-box rect using fillColor (never throws).
  const unknown = layer as UnknownLayer;
  if (Array.isArray(unknown.layers)) {
    // Unknown container-ish node — recurse so children aren't lost.
    return (
      <div style={{ ...containerStyle, overflow: "visible" }}>
        {(unknown.layers ?? []).map((child) => (
          <LayerNode
            key={child.id}
            layer={child}
            ops={ops}
            frame={frame}
            fps={fps}
          />
        ))}
      </div>
    );
  }
  warnUnknownLayer(unknown.type);
  const fallbackFill = st.fillColor ?? unknown.fillColor;
  if (!fallbackFill) return null;
  return <div style={{ ...containerStyle, backgroundColor: fallbackFill }} />;
}

class ComponentErrorBoundary extends React.Component<
  { name: string; children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error(`[Jitter] ${this.props.name} crashed:`, error.message);
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "rgba(80,0,0,0.65)",
            color: "#fff",
            padding: 12,
            fontFamily: "monospace",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {this.props.name}: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

function CustomLayerHost({ layer }: { layer: CustomLayer }) {
  const customs = React.useContext(CustomContext);
  // Dynamic customComponents shadow builtins so docs can override by name.
  const Comp = customs[layer.component] ?? JITTER_BUILTINS[layer.component];
  if (!Comp) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#400",
          color: "#fff",
          padding: 12,
          fontFamily: "monospace",
          fontSize: 14,
        }}
      >
        Unknown component: {layer.component}
      </div>
    );
  }
  return (
    <ComponentErrorBoundary name={layer.component}>
      <Comp {...(layer.props || {})} />
    </ComponentErrorBoundary>
  );
}

function ArtboardScene({ art }: { art: Artboard }) {
  const frame = useCurrentFrame();
  const { fps, width: compW, height: compH } = useVideoConfig();

  const scale = Math.min(compW / art.width, compH / art.height);
  const offsetX = (compW - art.width * scale) / 2;
  const offsetY = (compH - art.height * scale) / 2;

  // playAudio ops with a real url become Audio cues anchored at startTime.
  const audioCues = art.operations.filter(
    (o): o is Operation & { type: "playAudio"; url?: string } =>
      o.type === "playAudio" &&
      typeof (o as { url?: unknown }).url === "string" &&
      (o as { url: string }).url.startsWith("http"),
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {audioCues.map((cue) => {
        const fromF = Math.max(0, Math.round((cue.startTime * fps) / 1000));
        return (
          <Sequence
            key={cue.id}
            from={fromF}
            durationInFrames={Number.MAX_SAFE_INTEGER}
            layout="none"
          >
            <Audio src={cue.url as string} volume={cue.volume ?? 1} />
          </Sequence>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: offsetX,
          top: offsetY,
          width: art.width,
          height: art.height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          backgroundColor: art.background ? art.fillColor ?? "#fff" : undefined,
          overflow: "hidden",
        }}
      >
        {art.layers.map((layer) => (
          <LayerNode
            key={layer.id}
            layer={layer}
            ops={art.operations}
            frame={frame}
            fps={fps}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
}

interface CaptionsOverlayProps {
  chunks: { text: string; startMs: number; endMs: number }[];
  style: "bottom" | "centered" | "minimal";
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  background?: string;
  fps: number;
}

const CaptionsOverlay: React.FC<CaptionsOverlayProps> = ({
  chunks,
  style,
  fontFamily,
  fontSize,
  color,
  background,
  fps,
}) => {
  const frame = useCurrentFrame();
  const nowMs = (frame / fps) * 1000;
  const active = chunks.find((c) => nowMs >= c.startMs && nowMs < c.endMs);
  if (!active) return null;

  const isCentered = style === "centered";
  const isMinimal = style === "minimal";
  const bottom = isCentered ? undefined : 80;
  const top = isCentered ? "50%" : undefined;
  const transform = isCentered ? "translate(-50%, -50%)" : "translateX(-50%)";

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom,
          top,
          transform,
          maxWidth: "85%",
          padding: isMinimal ? "8px 16px" : "16px 28px",
          borderRadius: 14,
          background:
            background ?? (isMinimal ? "transparent" : "rgba(0,0,0,0.72)"),
          color: color ?? "#ffffff",
          fontFamily: resolveFontFamily(fontFamily ?? "Inter"),
          fontSize: fontSize ?? 44,
          fontWeight: 600,
          lineHeight: 1.2,
          textAlign: "center",
          textShadow: isMinimal ? "0 2px 8px rgba(0,0,0,0.85)" : undefined,
          letterSpacing: -0.5,
        }}
      >
        {active.text}
      </div>
    </AbsoluteFill>
  );
};

export const JitterComposition: React.FC<JitterDocInputProps> = ({
  conf,
  audio,
  narration,
  captions,
  customComponents,
}) => {
  const { fps } = useVideoConfig();
  const customs = React.useMemo(
    () => compileCustomComponents(customComponents),
    [customComponents],
  );
  let cursor = 0;
  // Music ducking window — while narration plays, drop music to ~12% so the
  // voice cuts through. Outside the narration window music plays at full
  // configured volume. Short crossfade prevents audible volume snaps.
  const narrationStartF =
    narration?.url != null
      ? Math.round(((narration.startMs ?? 0) * fps) / 1000)
      : -1;
  const narrationDurF =
    narration?.url != null && narration.durationMs
      ? Math.max(1, Math.round((narration.durationMs * fps) / 1000))
      : -1;
  const narrationEndF =
    narrationDurF > 0 ? narrationStartF + narrationDurF : -1;
  const baseMusicVol = audio?.volume ?? 1;
  const duckMusicVol = baseMusicVol * 0.18;
  const fadeFrames = Math.max(1, Math.round(fps * 0.25));
  const musicVolume =
    narration?.url && narrationEndF > 0
      ? (frame: number) => {
          if (frame < narrationStartF - fadeFrames) return baseMusicVol;
          if (frame > narrationEndF + fadeFrames) return baseMusicVol;
          if (frame >= narrationStartF && frame <= narrationEndF) {
            return duckMusicVol;
          }
          if (frame < narrationStartF) {
            const t = (frame - (narrationStartF - fadeFrames)) / fadeFrames;
            return baseMusicVol + (duckMusicVol - baseMusicVol) * t;
          }
          const t = (frame - narrationEndF) / fadeFrames;
          return duckMusicVol + (baseMusicVol - duckMusicVol) * t;
        }
      : narration?.url
        ? duckMusicVol // unknown narration length → keep music quiet throughout
        : baseMusicVol;

  return (
    <CustomContext.Provider value={customs}>
      <AbsoluteFill>
        {audio?.url ? (
          <Audio
            src={
              audio.url.startsWith("http")
                ? audio.url
                : staticFile(audio.url.replace(/^\//, ""))
            }
            volume={musicVolume}
          />
        ) : null}
        {narration?.url ? (
          <Sequence
            from={narrationStartF >= 0 ? narrationStartF : 0}
            durationInFrames={Number.MAX_SAFE_INTEGER}
            layout="none"
          >
            <Audio
              src={
                narration.url.startsWith("http")
                  ? narration.url
                  : staticFile(narration.url.replace(/^\//, ""))
              }
              volume={narration.volume ?? 1}
            />
          </Sequence>
        ) : null}
        {conf.artboards.map((art) => {
          const durFrames = Math.max(
            1,
            Math.round((art.duration * fps) / 1000),
          );
          const from = cursor;
          cursor += durFrames;
          return (
            <Sequence
              key={art.id}
              from={from}
              durationInFrames={durFrames}
              name={art.name}
            >
              <ArtboardScene art={art} />
            </Sequence>
          );
        })}
        {captions?.enabled !== false && captions?.chunks?.length ? (
          <CaptionsOverlay
            chunks={captions.chunks}
            style={captions.style ?? "bottom"}
            fontFamily={captions.fontFamily}
            fontSize={captions.fontSize}
            color={captions.color}
            background={captions.background}
            fps={fps}
          />
        ) : null}
      </AbsoluteFill>
    </CustomContext.Provider>
  );
};

export default JitterComposition;
