/**
 * TS port of contentgen `tools/exdraw.py` Board: builds Excalidraw elements in draw order.
 *
 * Differences from the Python builder, required by the sketch style:
 * - a text element is always exactly ONE line (`text()` throws on "\n"); `lines()` wraps a string
 *   and adds one element per line, so every line is its own draw unit and lines hand-write in sequence;
 * - shape labels are free text lines centred on the shape (not bound text), drawn after the shape;
 * - ids are deterministic (`<prefix><n>`), seeds come from a seeded PRNG (mulberry32).
 *
 * Elements are drawn in array order. A unit = one text line, or one shape, or one group of shapes.
 */
import { EXCALIFONT_ADV, EXCALIFONT_UPM } from "./metrics.data";

export type ElType = "rectangle" | "ellipse" | "diamond" | "line" | "arrow" | "text";

/** Kit-only metadata carried on `customData` (ignored by Excalidraw). */
export interface SketchMeta {
  /** Unit key: shapes sharing a key draw as one unit; text segments sharing a key form ONE line. */
  unit?: string;
  /** Extra pause (s) after this unit finishes. */
  pauseAfter?: number;
  /** Draw speed multiplier for this unit (1 = default). */
  speed?: number;
  /** A text line written over this many seconds at most (long lines). */
  role?: string;
}

export interface ExEl {
  id: string;
  type: ElType;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: "solid" | "hachure" | "cross-hatch" | "zigzag";
  strokeWidth: number;
  strokeStyle: "solid" | "dashed" | "dotted";
  roughness: number;
  opacity: number;
  groupIds: string[];
  frameId: null;
  roundness: { type: number } | null;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: false;
  boundElements: Array<{ id: string; type: string }>;
  updated: number;
  link: null;
  locked: false;
  customData?: SketchMeta;
  [k: string]: unknown;
}

export interface TextOpts {
  size?: number;
  color?: string;
  align?: "left" | "center" | "right";
  opacity?: number;
  meta?: SketchMeta;
}

export interface ShapeOpts {
  stroke?: string;
  fill?: string;
  fillStyle?: ExEl["fillStyle"];
  strokeWidth?: number;
  strokeStyle?: ExEl["strokeStyle"];
  roughness?: number;
  rounded?: boolean;
  opacity?: number;
  meta?: SketchMeta;
}

export const LINE_HEIGHT = 1.25;

/** Deterministic PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Width in px of a single line of Excalifont text (advance widths, no kerning). */
export function measureText(text: string, size: number): number {
  let w = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 32;
    w += EXCALIFONT_ADV[cp] ?? 620;
  }
  return (w / EXCALIFONT_UPM) * size;
}

/** Greedy word wrap to `maxWidth` (px). Words longer than a line are kept whole. */
export function wrapText(text: string, size: number, maxWidth: number): string[] {
  const words = String(text ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && measureText(next, size) > maxWidth) { lines.push(cur); cur = w; }
    else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Largest size in [min, base] (step 2) at which `text` wraps into ≤ maxLines lines of maxWidth. */
export function fitText(text: string, o: { maxWidth: number; maxLines: number; base: number; min: number }): { size: number; lines: string[] } {
  for (let s = o.base; s >= o.min; s -= 2) {
    const lines = wrapText(text, s, o.maxWidth);
    if (lines.length <= o.maxLines && lines.every((l) => measureText(l, s) <= o.maxWidth)) return { size: s, lines };
  }
  return { size: o.min, lines: wrapText(text, o.min, o.maxWidth) };
}

export class Board {
  readonly elements: ExEl[] = [];
  private rng: () => number;
  private n = 0;

  constructor(public prefix = "x", seed = 7, public ink = "#ECECEC") {
    this.rng = mulberry32(seed);
  }

  private id(kind: string): string {
    this.n += 1;
    return `${this.prefix}${kind}${this.n}`;
  }

  private int(): number {
    return 1 + Math.floor(this.rng() * 2 ** 31 - 2);
  }

  private base(type: ElType, x: number, y: number, w: number, h: number, o: ShapeOpts & { extra?: Record<string, unknown> } = {}): ExEl {
    const el: ExEl = {
      id: this.id(type.slice(0, 2)),
      type,
      x: round(x), y: round(y), width: round(w), height: round(h),
      angle: 0,
      strokeColor: o.stroke ?? this.ink,
      backgroundColor: o.fill ?? "transparent",
      fillStyle: o.fillStyle ?? "solid",
      strokeWidth: o.strokeWidth ?? 2,
      strokeStyle: o.strokeStyle ?? "solid",
      roughness: o.roughness ?? 1,
      opacity: o.opacity ?? 100,
      groupIds: [],
      frameId: null,
      roundness: o.rounded ? { type: 3 } : null,
      seed: this.int(),
      version: 1,
      versionNonce: this.int(),
      isDeleted: false,
      boundElements: [],
      updated: 1,
      link: null,
      locked: false,
      ...(o.meta ? { customData: o.meta } : {}),
      ...(o.extra ?? {}),
    };
    this.elements.push(el);
    return el;
  }

  /** One line of hand-written text. `x,y` is the top-left (align left), centre-top (center) or right-top (right). */
  text(x: number, y: number, line: string, o: TextOpts = {}): ExEl {
    if (/\n/.test(line)) throw new Error("sketch: Board.text() takes one line; use lines()");
    const size = o.size ?? 44;
    const w = Math.max(1, measureText(line, size));
    const h = size * LINE_HEIGHT;
    const align = o.align ?? "left";
    const left = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    return this.base("text", left, y, w, h, {
      stroke: o.color, opacity: o.opacity, roughness: 1, meta: o.meta,
      extra: {
        text: line, originalText: line, fontSize: size, fontFamily: 5, textAlign: align, verticalAlign: "top",
        containerId: null, lineHeight: LINE_HEIGHT, autoResize: true, baseline: Math.round(size * 0.93),
      },
    });
  }

  /** Several lines, one element each, stacked from `y`. Returns the elements and the bottom y. */
  lines(x: number, y: number, lines: string[], o: TextOpts & { gap?: number } = {}): { els: ExEl[]; bottom: number } {
    const size = o.size ?? 44;
    const step = size * LINE_HEIGHT + (o.gap ?? 0);
    const els = lines.map((l, i) => this.text(x, y + i * step, l, o));
    return { els, bottom: y + lines.length * step - (o.gap ?? 0) };
  }

  /**
   * One line made of coloured segments (e.g. an accent word). The segments share a unit key, so
   * they are written left to right as ONE line. `x` follows `align` like text().
   */
  segLine(x: number, y: number, segs: Array<{ text: string; color?: string }>, o: TextOpts = {}): ExEl[] {
    const size = o.size ?? 44;
    const parts = segs.filter((p) => p.text.length);
    if (parts.length === 1) return [this.text(x, y, parts[0].text, { ...o, color: parts[0].color ?? o.color })];
    const total = measureText(parts.map((p) => p.text).join(""), size);
    const align = o.align ?? "left";
    let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
    const unit = `${this.prefix}line${this.n + 1}`;
    return parts.map((p) => {
      const el = this.text(cx, y, p.text, { ...o, align: "left", color: p.color ?? o.color, meta: { ...o.meta, unit } });
      cx += measureText(p.text, size);
      return el;
    });
  }

  box(x: number, y: number, w: number, h: number, o: ShapeOpts = {}): ExEl {
    return this.base("rectangle", x, y, w, h, { rounded: true, ...o });
  }

  ellipse(x: number, y: number, w: number, h: number, o: ShapeOpts = {}): ExEl {
    return this.base("ellipse", x, y, w, h, o);
  }

  diamond(x: number, y: number, w: number, h: number, o: ShapeOpts = {}): ExEl {
    return this.base("diamond", x, y, w, h, o);
  }

  private linear(type: "line" | "arrow", points: Array<[number, number]>, o: ShapeOpts & { extra?: Record<string, unknown> }): ExEl {
    const [x0, y0] = points[0];
    const rel = points.map(([px, py]) => [round(px - x0), round(py - y0)]);
    const xs = rel.map((p) => p[0]), ys = rel.map((p) => p[1]);
    return this.base(type, x0, y0, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), {
      ...o,
      rounded: false,
      extra: { points: rel, lastCommittedPoint: null, startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: null, ...o.extra },
    });
  }

  line(points: Array<[number, number]>, o: ShapeOpts & { curved?: boolean } = {}): ExEl {
    const el = this.linear("line", points, o);
    if (o.curved) el.roundness = { type: 2 };
    return el;
  }

  arrow(points: Array<[number, number]>, o: ShapeOpts & { head?: "arrow" | "triangle" | "bar" | "dot"; curved?: boolean; startHead?: "arrow" | "triangle" | null } = {}): ExEl {
    const el = this.linear("arrow", points, { ...o, extra: { endArrowhead: o.head ?? "arrow", startArrowhead: o.startHead ?? null, elbowed: false } });
    el.roundness = o.curved === false ? null : { type: 2 };
    return el;
  }

  /** Straight arrow from the edge of shape a to the edge of shape b (exdraw `arrow_between`). */
  arrowBetween(a: ExEl, b: ExEl, o: ShapeOpts & { gap?: number } = {}): ExEl {
    const gap = o.gap ?? 14;
    const ax = a.x + a.width / 2, ay = a.y + a.height / 2;
    const bx = b.x + b.width / 2, by = b.y + b.height / 2;
    let p0: [number, number], p1: [number, number];
    if (Math.abs(bx - ax) >= Math.abs(by - ay)) {
      const s = bx > ax ? 1 : -1;
      p0 = [ax + s * (a.width / 2 + gap), ay];
      p1 = [bx - s * (b.width / 2 + gap), by];
    } else {
      const s = by > ay ? 1 : -1;
      p0 = [ax, ay + s * (a.height / 2 + gap)];
      p1 = [bx, by - s * (b.height / 2 + gap)];
    }
    return this.arrow([p0, p1], { ...o, curved: false });
  }

  /** Put shapes in one group, so they draw as one unit. Text lines are never grouped (one unit each). */
  group(...els: ExEl[]): string {
    const gid = this.id("grp");
    for (const el of els) {
      if (el.type === "text") continue;
      el.groupIds.push(gid);
    }
    return gid;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Draw units, in element order: one per text line, per ungrouped shape, per group (outermost group id). */
export function buildUnits(elements: ExEl[]): number[][] {
  const unitOf = new Map<string, number>();
  const units: number[][] = [];
  elements.forEach((el, i) => {
    const key = el.type === "text" ? (el.customData?.unit ? `l:${el.customData.unit}` : `t:${el.id}`) : el.customData?.unit ? `u:${el.customData.unit}` : el.groupIds.length ? `g:${el.groupIds[el.groupIds.length - 1]}` : `e:${el.id}`;
    if (!unitOf.has(key)) { unitOf.set(key, units.length); units.push([]); }
    units[unitOf.get(key)!].push(i);
  });
  return units;
}
