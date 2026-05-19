import type { JitterDocInputProps } from "@/remotion/compositions/JitterComposition";

export type JitterDoc = JitterDocInputProps;

export interface AnyLayerLite {
  type: "text" | "image" | "rect" | "layerGrp" | "custom";
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
  text?: string;
  color?: string;
  fontSize?: number;
  url?: string;
  fillColor?: string;
  background?: boolean;
  layers?: AnyLayerLite[];
  component?: string;
  props?: Record<string, unknown>;
}

export interface LayerPath {
  artboardIndex: number;
  layerIndices: number[];
}

export function getLayer(doc: JitterDoc, path: LayerPath): AnyLayerLite | null {
  const art = doc.conf.artboards[path.artboardIndex];
  if (!art) return null;
  let current: any = { layers: art.layers };
  for (const idx of path.layerIndices) {
    if (!current?.layers?.[idx]) return null;
    current = current.layers[idx];
  }
  return current as AnyLayerLite;
}

export function setLayer(
  doc: JitterDoc,
  path: LayerPath,
  patch: Partial<AnyLayerLite>,
): JitterDoc {
  const next: JitterDoc = JSON.parse(JSON.stringify(doc));
  const art = next.conf.artboards[path.artboardIndex];
  if (!art) return next;
  let parent: any = { layers: art.layers };
  for (let i = 0; i < path.layerIndices.length - 1; i++) {
    parent = parent.layers[path.layerIndices[i]];
  }
  const last = path.layerIndices[path.layerIndices.length - 1];
  parent.layers[last] = { ...parent.layers[last], ...patch };
  return next;
}

export function totalDurationMs(doc: JitterDoc): number {
  return doc.conf.artboards.reduce((s, a) => s + (a.duration ?? 0), 0);
}
