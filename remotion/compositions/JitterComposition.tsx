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

type AnyLayer = TextLayer | ImageLayer | RectLayer | LayerGroup | CustomLayer;

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
      type: "textIn";
      effect?: "appear" | "slide" | "fade";
      split?: "letters" | "words" | "none";
      order?: "forward" | "reverse" | "random";
      offset?: number;
      nodeDuration?: number;
      nodeEasing?: Easing;
      travelDistance?: number;
      slideDirection?: "up" | "down" | "left" | "right";
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

function ease(t: number, kind: Easing = "natural"): number {
  const x = Math.max(0, Math.min(1, t));
  switch (kind) {
    case "none":
      return x;
    case "slowDown":
      return 1 - Math.pow(1 - x, 3);
    case "accelerate":
      return x * x * x;
    case "natural":
    default:
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }
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
  };
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
    case "textIn": {
      if (layer.type !== "text") return state;
      const split = op.split ?? "letters";
      const order = op.order ?? "forward";
      const offsetMs = op.offset ?? 50;
      const nodeDurMs = op.nodeDuration ?? 500;
      const dist = op.travelDistance ?? 20;
      const dir = op.slideDirection ?? "up";
      const effect = op.effect ?? "appear";

      const tokens = splitText(layer.text, split);
      const indices = tokens.map((_, i) => i);
      if (order === "reverse") indices.reverse();
      // (random: deterministic shuffle could go here; skip for now.)

      const nodes: TextNodeState[] = tokens.map(() => ({
        opacity: layer.opacity ?? 100,
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
        if (effect === "appear") {
          nodes[i].opacity = nt > 0 ? layer.opacity ?? 100 : 0;
        } else if (effect === "fade") {
          nodes[i].opacity = eased * (layer.opacity ?? 100);
        } else {
          // slide
          nodes[i].opacity = eased * (layer.opacity ?? 100);
          const remaining = (1 - eased) * dist;
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
    default:
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
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("data:")) return url;
  return staticFile(url.replace(/^\//, ""));
}

function renderImage(layer: ImageLayer) {
  return (
    <img
      src={resolveImageSrc(layer.url)}
      alt={layer.mediaName ?? ""}
      style={{ width: "100%", height: "100%", objectFit: "contain" }}
    />
  );
}

function renderRect(layer: RectLayer) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: layer.fillColor ?? "#fff",
        borderRadius: layer.cornerRadius ?? 0,
        boxShadow: layer.shadowEnabled
          ? `${layer.shadowOffsetX ?? 0}px ${layer.shadowOffsetY ?? 0}px ${layer.shadowBlur ?? 0}px rgba(0,0,0,${(layer.shadowOpacity ?? 50) / 100})`
          : undefined,
      }}
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
  const hasTransform =
    !isBeatOverlay && (st.scale !== 1 || st.angle !== 0);
  const containerStyle: React.CSSProperties = {
    position: "absolute",
    left: st.x,
    top: st.y,
    width: st.width,
    height: st.height,
    opacity: isBeatOverlay ? 1 : st.opacity / 100,
    borderRadius: layer.cornerRadius ?? 0,
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

  if (layer.type === "text") {
    return <div style={containerStyle}>{renderText(layer, st)}</div>;
  }
  if (layer.type === "image") {
    return <div style={containerStyle}>{renderImage(layer)}</div>;
  }
  if (layer.type === "rect") {
    return <div style={containerStyle}>{renderRect(layer)}</div>;
  }
  if (layer.type === "custom") {
    return (
      <div style={containerStyle}>
        <CustomLayerHost layer={layer} />
      </div>
    );
  }
  return null;
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

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
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

export const JitterComposition: React.FC<JitterDocInputProps> = ({
  conf,
  audio,
  narration,
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
      </AbsoluteFill>
    </CustomContext.Provider>
  );
};

export default JitterComposition;
