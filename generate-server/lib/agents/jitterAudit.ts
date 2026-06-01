/**
 * JITTER DOC AUDIT — pure, deterministic quality scoring.
 *
 * `finalizeDoc` already computes overlap / contrast / motion-coverage signals,
 * but throws them away after logging. This module turns the same checks into a
 * persistent, structured QualityReport so prompt/model changes are MEASURABLE
 * (run the eval harness before/after and diff the scores) instead of judged by
 * eyeballing one render.
 *
 * 100% read-only and dependency-free — never mutates the doc, safe to call
 * anywhere (hot path, scripts, tests).
 */

import type { JitterDoc } from "../video/jitterJson";

export interface QualityReport {
  /** 0-100, higher is better. 100 = no detected defects. */
  score: number;
  scenes: number;
  layers: number;
  operations: number;
  totalDurationMs: number;
  /** Counts of each defect class (also drive the score). */
  defects: {
    overlaps: number;
    lowContrastText: number;
    missingEntry: number;
    missingExit: number;
    offFrame: number;
    emptyScenes: number;
    durationMismatchMs: number;
  };
  /** Human-readable lines, capped — for logs / eval diffs. */
  notes: string[];
}

const BEAT_OVERLAY = new Set(["BeatInvert", "BeatColorSwap", "BeatTextSwap"]);
const BG_COMPONENTS = new Set([
  "TemplateBackdrop",
  "AbstractBackdrop",
  "MeshGradient",
  "DotGrid",
  "LineGrid",
  "AnimatedGradient",
  "BlurredBlob",
  "NoiseField",
  "FloatingDots",
  "BeatInvert",
  "BeatColorSwap",
]);
const ENTRY_OPS = new Set(["fadeIn", "slideIn", "growIn", "textIn", "resize"]);
const EXIT_OPS = new Set(["fadeOut", "slideOut", "shrinkOut"]);

function isBg(l: any): boolean {
  if (!l) return true;
  if ((l.type === "rect" || l.type === "layerGrp") && l.background === true)
    return true;
  if (l.type === "custom" && typeof l.component === "string") {
    if (BEAT_OVERLAY.has(l.component) || BG_COMPONENTS.has(l.component))
      return true;
  }
  return false;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function luminance(c: { r: number; g: number; b: number }): number {
  const ch = [c.r, c.g, c.b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function contrastRatio(aHex: string, bHex: string): number {
  const a = hexToRgb(aHex);
  const b = hexToRgb(bHex);
  if (!a || !b) return 21;
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Flatten non-bg layers with absolute boxes (groups add their offset). */
function collectBoxes(
  layers: any[],
  dx: number,
  dy: number,
  out: Array<{ id: string; x: number; y: number; w: number; h: number }>,
): void {
  for (const l of layers || []) {
    if (!l || typeof l !== "object") continue;
    if (isBg(l)) {
      if (l.type === "layerGrp" && Array.isArray(l.layers))
        collectBoxes(l.layers, dx + (l.x ?? 0), dy + (l.y ?? 0), out);
      continue;
    }
    const x = dx + (l.x ?? 0);
    const y = dy + (l.y ?? 0);
    const w = l.width ?? 0;
    const h = l.height ?? 0;
    if (w > 0 && h > 0) out.push({ id: l.id, x, y, w, h });
    if (l.type === "layerGrp" && Array.isArray(l.layers))
      collectBoxes(l.layers, x, y, out);
  }
}

/** Walk every non-bg layer + its targeting ops (for entry/exit coverage). */
function walkLayers(layers: any[], visit: (l: any) => void): void {
  for (const l of layers || []) {
    if (!l || typeof l !== "object") continue;
    if (l.type === "layerGrp" && Array.isArray(l.layers))
      walkLayers(l.layers, visit);
    if (!isBg(l) && l.id) visit(l);
  }
}

export function auditDoc(
  doc: JitterDoc,
  opts: { targetDurationMs?: number } = {},
): QualityReport {
  const arts = doc.conf.artboards;
  const defects = {
    overlaps: 0,
    lowContrastText: 0,
    missingEntry: 0,
    missingExit: 0,
    offFrame: 0,
    emptyScenes: 0,
    durationMismatchMs: 0,
  };
  const notes: string[] = [];
  let layers = 0;
  let operations = 0;
  let totalDurationMs = 0;

  for (const art of arts) {
    totalDurationMs += art.duration || 0;
    operations += (art.operations || []).length;

    const bg =
      art.background && typeof art.fillColor === "string"
        ? art.fillColor
        : "#0b1020";

    // Content count + entry/exit coverage + contrast + off-frame.
    const opsByTarget = new Map<string, Set<string>>();
    for (const o of art.operations || []) {
      if (!opsByTarget.has(o.targetId)) opsByTarget.set(o.targetId, new Set());
      opsByTarget.get(o.targetId)!.add(o.type);
    }
    let content = 0;
    walkLayers(art.layers, (l) => {
      layers++;
      content++;
      const targeting = opsByTarget.get(l.id) ?? new Set<string>();
      if (![...targeting].some((t) => ENTRY_OPS.has(t))) {
        defects.missingEntry++;
        if (notes.length < 60)
          notes.push(`scene ${art.id}: layer ${l.id} has no entry op`);
      }
      if (![...targeting].some((t) => EXIT_OPS.has(t))) {
        defects.missingExit++;
        if (notes.length < 60)
          notes.push(`scene ${art.id}: layer ${l.id} has no exit op`);
      }
      if (l.type === "text" && typeof l.color === "string") {
        if (contrastRatio(l.color, bg) < 4.5) {
          defects.lowContrastText++;
          if (notes.length < 60)
            notes.push(
              `scene ${art.id}: text ${l.id} low contrast (${l.color} on ${bg})`,
            );
        }
      }
      const x = l.x ?? 0;
      const y = l.y ?? 0;
      const w = l.width ?? 0;
      const h = l.height ?? 0;
      if (x < -4 || y < -4 || x + w > art.width + 4 || y + h > art.height + 4) {
        defects.offFrame++;
        if (notes.length < 60)
          notes.push(`scene ${art.id}: layer ${l.id} extends off-frame`);
      }
    });
    if (content === 0) {
      defects.emptyScenes++;
      notes.push(`scene ${art.id}: no content layers`);
    }

    // Overlaps (>30% of smaller box).
    const boxes: Array<{ id: string; x: number; y: number; w: number; h: number }> =
      [];
    collectBoxes(art.layers, 0, 0, boxes);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const ix = Math.max(
          0,
          Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x),
        );
        const iy = Math.max(
          0,
          Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y),
        );
        const inter = ix * iy;
        if (inter <= 0) continue;
        const ratio = inter / Math.max(1, Math.min(a.w * a.h, b.w * b.h));
        if (ratio > 0.3) {
          defects.overlaps++;
          if (notes.length < 60)
            notes.push(
              `scene ${art.id}: ${a.id} ↔ ${b.id} overlap ${Math.round(ratio * 100)}%`,
            );
        }
      }
    }
  }

  if (opts.targetDurationMs) {
    defects.durationMismatchMs = Math.abs(
      totalDurationMs - opts.targetDurationMs,
    );
  }

  // Score: start at 100, subtract weighted penalties, clamp to [0,100].
  const penalty =
    defects.overlaps * 6 +
    defects.lowContrastText * 5 +
    defects.missingEntry * 3 +
    defects.missingExit * 3 +
    defects.offFrame * 4 +
    defects.emptyScenes * 20 +
    Math.min(20, defects.durationMismatchMs / 250);
  const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));

  return {
    score,
    scenes: arts.length,
    layers,
    operations,
    totalDurationMs,
    defects,
    notes: notes.slice(0, 60),
  };
}

/** One-line summary for logs. */
export function summarizeAudit(r: QualityReport): string {
  const d = r.defects;
  return `score=${r.score} scenes=${r.scenes} layers=${r.layers} ops=${r.operations} | overlaps=${d.overlaps} lowContrast=${d.lowContrastText} noEntry=${d.missingEntry} noExit=${d.missingExit} offFrame=${d.offFrame} empty=${d.emptyScenes} durΔ=${d.durationMismatchMs}ms`;
}
