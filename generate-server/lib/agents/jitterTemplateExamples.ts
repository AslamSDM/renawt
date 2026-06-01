/**
 * TEMPLATE EXAMPLE RETRIEVAL (lightweight RAG over the translated corpus)
 *
 * The composer used to see templates only as METADATA (id/name/palette/counts).
 * This retrieves a couple of REAL translated JitterDocs and compresses each to a
 * structural SKELETON (layer placement + op timing, verbatim copy stripped),
 * handing them to the composer as concrete few-shot layouts to imitate.
 *
 * Retrieval is deterministic + dependency-free:
 *   1. join the brief's sections against the scraped index (jitterTemplateRegistry)
 *      to get section-relevant, complexity-sorted candidate ids;
 *   2. re-rank by aspect-ratio proximity to the target canvas;
 *   3. load the matching `data/jitter-templates/translated/<id>.json` (full
 *      JitterDoc) and skeletonize it.
 *
 * No embeddings, no SDK. Scales across all translated templates for free.
 */

import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";
import {
  pickTemplateInspirations,
  type JitterTemplateSummary,
} from "./jitterTemplateRegistry";

const TRANSLATED_DIR = resolve(
  __dirname,
  "..",
  "..",
  "data",
  "jitter-templates",
  "translated",
);

export interface TemplateExample {
  name: string;
  skeleton: string;
}

/** Layer kinds the composer can emit — anything else (maskGrp, vector, etc.)
 *  is dropped from the skeleton so we never teach an unsupported primitive. */
const KNOWN_LAYER_TYPES = new Set(["text", "image", "rect", "layerGrp", "custom"]);

/** Map the raw Jitter op vocabulary in the scraped corpus onto the op types the
 *  composer actually understands. Unmapped ops are dropped from the skeleton. */
const OP_TYPE_MAP: Record<string, string> = {
  growIn: "growIn",
  shrinkOut: "shrinkOut",
  resize: "resize",
  fadeIn: "fadeIn",
  fadeOut: "fadeOut",
  slideIn: "slideIn",
  slideOut: "slideOut",
  pulse: "pulse",
  textIn: "textIn",
  // raw Jitter primitives → nearest composer op
  show: "fadeIn",
  hide: "fadeOut",
  appear: "fadeIn",
};

/** Translated docs share their id with the scraped index item. */
function loadTranslatedDoc(id: string): any | null {
  const p = join(TRANSLATED_DIR, `${id}.json`);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Compress a JitterDoc to a compact, token-bounded skeleton: scene dimensions
 * + a capped list of layers (id, kind, box) and operations (type, target,
 * timing). Verbatim text/props are intentionally dropped so the model copies
 * the LAYOUT, not the content.
 */
function skeletonize(
  doc: any,
  { maxScenes = 3, maxLayers = 7, maxOps = 7 } = {},
): string {
  const arts = (doc.conf?.artboards || []).slice(0, maxScenes);
  const lines: string[] = [];
  for (const a of arts) {
    lines.push(
      `scene "${a.name ?? "?"}" ${a.width}x${a.height} ${a.duration}ms`,
    );
    // Only top-level layers the composer can author; tiny/zero-size decorations
    // are skipped so the skeleton reads as real content layout.
    const layers = (a.layers || []).filter(
      (l: any) =>
        l &&
        KNOWN_LAYER_TYPES.has(l.type) &&
        (Number(l.width) || 0) >= 16 &&
        (Number(l.height) || 0) >= 16,
    );
    const shown = layers.slice(0, maxLayers);
    for (const l of shown) {
      const kind = l.type === "custom" ? `custom:${l.component}` : l.type;
      const box = `@${Math.round(l.x ?? 0)},${Math.round(l.y ?? 0)} ${Math.round(
        l.width ?? 0,
      )}x${Math.round(l.height ?? 0)}`;
      lines.push(`  ${l.id}: ${kind} ${box}`);
    }
    if (layers.length > shown.length)
      lines.push(`  …+${layers.length - shown.length} more layers`);
    // Map raw ops → composer vocab, drop unsupported.
    const ops = (a.operations || [])
      .map((o: any) => ({ ...o, type: OP_TYPE_MAP[o.type] }))
      .filter((o: any) => o.type)
      .slice(0, maxOps);
    for (const o of ops) {
      lines.push(
        `  op ${o.type}→${o.targetId} ${Math.round(o.startTime ?? 0)}-${Math.round(
          o.endTime ?? o.startTime ?? 0,
        )}ms`,
      );
    }
  }
  return lines.join("\n");
}

/**
 * Retrieve the best-matching translated templates for a brief, scored by
 * section relevance (from the scraped index) and aspect-ratio proximity.
 * Returns compact skeletons ready to drop into the prompt.
 */
export function pickTemplateExamples(opts: {
  sections?: string[];
  mood?: string;
  width?: number;
  height?: number;
  limit?: number;
}): TemplateExample[] {
  const sections = opts.sections?.length
    ? opts.sections
    : ["websites", "ui-elements", "text"];
  const limit = opts.limit ?? 2;
  const targetAspect =
    opts.width && opts.height ? opts.width / opts.height : 16 / 9;

  // Section-matched, dedup'd candidates from the index.
  const candidates: JitterTemplateSummary[] = pickTemplateInspirations(
    sections,
    { perSection: 6, minLayers: 6 },
  )
    // Skip degenerate templates: monster logo-reveals (thousands of nested
    // layers) skeletonize into uninformative giant groups; 1-2 layer stubs
    // teach nothing. Keep the representative middle.
    .filter((c) => c.layerCount >= 6 && c.layerCount <= 40);
  if (!candidates.length) return [];

  const ranked = candidates
    .map((c) => {
      const aspectPenalty =
        c.width && c.height ? Math.abs(c.width / c.height - targetAspect) : 0;
      // Prefer multi-scene, moderately-dense templates close to target aspect.
      const richness = (c.artboardCount || 0) * 2 + Math.min(c.layerCount, 20) * 0.2;
      return { c, score: richness - aspectPenalty * 4 };
    })
    .sort((a, b) => b.score - a.score);

  const out: TemplateExample[] = [];
  for (const { c } of ranked) {
    if (out.length >= limit) break;
    const doc = loadTranslatedDoc(c.id);
    if (!doc?.conf?.artboards?.length) continue;
    out.push({ name: c.name || c.id, skeleton: skeletonize(doc) });
  }
  return out;
}
