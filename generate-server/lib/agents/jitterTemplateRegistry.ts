/**
 * JITTER TEMPLATE REGISTRY
 *
 * Loader over the on-disk registry produced by
 * `generate-server/scripts/scrape-jitter-templates.ts`.
 *
 * Layout:
 *   generate-server/data/jitter-templates/index.json    — section map + summaries
 *   generate-server/data/jitter-templates/raw/<id>.json — full JitterDoc per id
 *
 * Loaders are lazy + cached. Safe to call from agents that only want a small
 * sample of templates as inspiration.
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { join, resolve } from "path";

export interface JitterTemplateSummary {
  id: string;
  name: string;
  sections: string[];
  jsonUrl: string;
  fps: number;
  width: number;
  height: number;
  totalDurationMs: number;
  artboardCount: number;
  layerCount: number;
  opCount: number;
  palette: string[];
}

export interface JitterTemplateIndex {
  updatedAt: string;
  /** sectionName → ids visible on /templates/<section>/ */
  sections: Record<string, string[]>;
  /** authorSlug → ids visible on /community/<author>/ */
  community: Record<string, string[]>;
  /** id → summary */
  items: Record<string, JitterTemplateSummary>;
}

const DATA_DIR = resolve(__dirname, "..", "..", "data", "jitter-templates");
const INDEX_PATH = join(DATA_DIR, "index.json");
const RAW_DIR = join(DATA_DIR, "raw");

let cachedIndex: JitterTemplateIndex | null = null;

export function loadJitterTemplateIndex(): JitterTemplateIndex {
  if (cachedIndex) return cachedIndex;
  if (!existsSync(INDEX_PATH)) {
    cachedIndex = {
      updatedAt: new Date(0).toISOString(),
      sections: {},
      community: {},
      items: {},
    };
    return cachedIndex;
  }
  cachedIndex = JSON.parse(readFileSync(INDEX_PATH, "utf8"));
  return cachedIndex!;
}

export function reloadJitterTemplateIndex(): JitterTemplateIndex {
  cachedIndex = null;
  return loadJitterTemplateIndex();
}

export function listSections(): string[] {
  const idx = loadJitterTemplateIndex();
  return Object.keys(idx.sections).sort();
}

export function listCommunityAuthors(): string[] {
  const idx = loadJitterTemplateIndex();
  return Object.keys(idx.community).sort();
}

export function getTemplateSummary(id: string): JitterTemplateSummary | null {
  return loadJitterTemplateIndex().items[id] ?? null;
}

/**
 * Return summaries that match a section. Sorted by descending complexity
 * (artboardCount + layerCount) so callers asking for "n samples" get the
 * meaningful ones first. Pass an empty section to draw from all items.
 */
export function getTemplatesForSection(
  section: string,
  opts: { limit?: number; minLayers?: number } = {},
): JitterTemplateSummary[] {
  const { limit = 10, minLayers = 0 } = opts;
  const idx = loadJitterTemplateIndex();
  const ids = section
    ? idx.sections[section] ?? idx.community[section] ?? []
    : Object.keys(idx.items);
  const list = ids
    .map((id) => idx.items[id])
    .filter((s): s is JitterTemplateSummary => Boolean(s) && s.layerCount >= minLayers);
  list.sort(
    (a, b) =>
      b.artboardCount + b.layerCount - (a.artboardCount + a.layerCount),
  );
  return list.slice(0, limit);
}

export function getTemplatesForCommunityAuthor(
  author: string,
  opts: { limit?: number } = {},
): JitterTemplateSummary[] {
  return getTemplatesForSection(author, opts);
}

/**
 * Pull a small set of summaries that match any of the supplied sections,
 * dedup'd by id. Useful when the composer caller wants "give me a few
 * examples from <devices> and <social-media>".
 */
export function pickTemplateInspirations(
  sections: string[],
  opts: { perSection?: number; minLayers?: number } = {},
): JitterTemplateSummary[] {
  const { perSection = 3, minLayers = 4 } = opts;
  const seen = new Set<string>();
  const out: JitterTemplateSummary[] = [];
  for (const s of sections) {
    for (const t of getTemplatesForSection(s, { limit: perSection, minLayers })) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }
  }
  return out;
}

/** Read the full JitterDoc for an id from disk (no validation). */
export function readTemplateDoc(id: string): any | null {
  const path = join(RAW_DIR, `${id}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Cheap stat: how many raw docs are on disk (regardless of index). */
export function countRawTemplates(): number {
  if (!existsSync(RAW_DIR)) return 0;
  return readdirSync(RAW_DIR).filter((f) => f.endsWith(".json")).length;
}

// ----- Background picker -----

export type Mood = "minimal" | "playful" | "premium" | "techy" | "warm" | "bold";

/** Stable string hash → 32-bit unsigned int (FNV-1a). Used as deterministic seed. */
function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/** Pick element from array using a seed; pure, no Math.random. */
function pickSeeded<T>(arr: readonly T[], seed: number): T {
  return arr[seed % arr.length];
}

const MOOD_TO_BG_VARIANT: Record<Mood, "blobs" | "mesh" | "grid" | "dots" | "lines"> = {
  minimal: "dots",
  premium: "mesh",
  techy: "grid",
  playful: "blobs",
  warm: "blobs",
  bold: "lines",
};

const MOOD_TO_INTENSITY: Record<Mood, number> = {
  minimal: 0.55,
  premium: 0.85,
  techy: 0.75,
  playful: 1.0,
  warm: 0.8,
  bold: 0.95,
};

interface BrandPalette {
  background: string;
  primary: string;
  secondary?: string;
  accent?: string;
  textColor: string;
}

/**
 * Blend the brand palette with a scraped bg-template's palette to produce a
 * recolored backdrop that *matches* the page mood without parroting the brand
 * (avoids "everything is one color" pages). Mostly brand, accents from template.
 */
function blendPalettes(brand: BrandPalette, templatePalette: string[]): string[] {
  const out: string[] = [];
  out.push(brand.background);
  if (brand.primary && brand.primary !== brand.background) out.push(brand.primary);
  if (brand.accent && brand.accent !== brand.primary) out.push(brand.accent);
  // Add 1-2 template accents that aren't pure white/black/transparent.
  const usable = templatePalette.filter(
    (c) =>
      typeof c === "string" &&
      /^#[0-9a-fA-F]{6,8}$/.test(c) &&
      !/^#0{6,8}$/.test(c) &&
      !/^#f{6,8}$/i.test(c) &&
      !/^#000000$/i.test(c) &&
      !/^#ffffff$/i.test(c),
  );
  for (const c of usable.slice(0, 2)) {
    const hex = c.length > 7 ? c.slice(0, 7) : c;
    if (!out.includes(hex)) out.push(hex);
  }
  while (out.length < 4) out.push(brand.primary || "#22d3ee");
  return out.slice(0, 5);
}

export interface PickedBackground {
  templateId: string;
  templateName: string;
  variant: "blobs" | "mesh" | "grid" | "dots" | "lines";
  palette: string[];
  intensity: number;
  /** ".jitter.video/file/?id=<id>" — for logs. */
  sourceUrl: string;
}

/**
 * Pick a scraped jitter.video bg-template (from
 * `generate-server/data/jitter-templates/index.json` -> `sections.backgrounds`),
 * blend its palette with the brand, and return the props needed to render
 * the `TemplateBackdrop` builtin.
 *
 * - Random across all 26 backgrounds, seeded by `<mood>:<brandPrimary>` so
 *   the same brand+mood gets the same bg across runs (stable).
 * - Variant chosen from mood (techy→grid, premium→mesh, playful→blobs, ...).
 * - Falls back to a deterministic default if the registry is empty.
 */
export function pickBackgroundForBrand(
  mood: string,
  brand: BrandPalette,
): PickedBackground {
  const m = (mood as Mood) || "minimal";
  const variant = MOOD_TO_BG_VARIANT[m] ?? "blobs";
  const intensity = MOOD_TO_INTENSITY[m] ?? 0.7;

  const idx = loadJitterTemplateIndex();
  const bgIds = idx.sections.backgrounds ?? [];
  if (bgIds.length === 0) {
    return {
      templateId: "fallback",
      templateName: "fallback",
      variant,
      palette: blendPalettes(brand, []),
      intensity,
      sourceUrl: "n/a",
    };
  }
  // Pure-random per call so each run feels fresh (user requested "from 0 each time").
  const templateId = bgIds[Math.floor(Math.random() * bgIds.length)];
  const summary = idx.items[templateId];
  return {
    templateId,
    templateName: summary?.name || templateId,
    variant,
    palette: blendPalettes(brand, summary?.palette ?? []),
    intensity,
    sourceUrl: `https://jitter.video/file/?id=${templateId}`,
  };
}
