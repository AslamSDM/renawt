import { readFileSync } from "fs";
import { join } from "path";
import indexJson from "@/generate-server/data/jitter-templates/index.json";

/** Optional render manifest produced by scripts/render-jitter-previews.ts.
 *  Read lazily; absent until previews have been rendered. */
let previewsCache: Record<string, string> | null = null;
function loadPreviews(): Record<string, string> {
  if (previewsCache) return previewsCache;
  try {
    const p = join(
      process.cwd(),
      "generate-server/data/jitter-templates/previews.json",
    );
    previewsCache = JSON.parse(readFileSync(p, "utf8"));
  } catch {
    previewsCache = {};
  }
  return previewsCache!;
}

export interface TemplateSummary {
  id: string;
  name: string;
  sections: string[];
  fps: number;
  width: number;
  height: number;
  totalDurationMs: number;
  artboardCount: number;
  layerCount: number;
  opCount: number;
  palette: string[];
}

interface RawIndex {
  updatedAt: string;
  sections: Record<string, string[]>;
  community: Record<string, string[]>;
  items: Record<string, TemplateSummary>;
}

const index = indexJson as unknown as RawIndex;

const SECTION_LABELS: Record<string, string> = {
  websites: "Website",
  new: "New",
  "jitter-ai": "AI",
  devices: "Device",
  "social-media": "Social",
  "video-titles": "Title",
  ads: "Ad",
  logos: "Logo",
  icons: "Icon",
  text: "Text",
  buttons: "Button",
  charts: "Chart",
  backgrounds: "Background",
  "ui-elements": "UI",
  showreels: "Showreel",
};

function labelFor(section: string): string {
  return (
    SECTION_LABELS[section] ??
    section.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** Stable, human-friendly display name derived from a template's primary
 *  section and its position within that section (the raw `name` is a gibberish
 *  id). e.g. "Social 03". */
function displayName(item: TemplateSummary): string {
  const section = item.sections[0] ?? "template";
  const ids = index.sections[section] ?? [];
  const ordinal = ids.indexOf(item.id);
  const n = ordinal >= 0 ? ordinal + 1 : 1;
  return `${labelFor(section)} ${String(n).padStart(2, "0")}`;
}

/** Sections that have at least one item, with display labels and counts. */
export function listSections(): { id: string; label: string; count: number }[] {
  return Object.entries(index.sections)
    .filter(([, ids]) => ids.length > 0)
    .map(([id, ids]) => ({ id, label: labelFor(id), count: ids.length }))
    .sort((a, b) => b.count - a.count);
}

export interface TemplateCard {
  id: string;
  title: string;
  section: string;
  sectionLabel: string;
  palette: string[];
  width: number;
  height: number;
  durationMs: number;
  layerCount: number;
  /** Rendered mp4 preview URL, if one has been produced. */
  previewUrl?: string;
}

function toCard(item: TemplateSummary, previews: Record<string, string>): TemplateCard {
  const section = item.sections[0] ?? "template";
  return {
    id: item.id,
    title: displayName(item),
    section,
    sectionLabel: labelFor(section),
    palette: (item.palette ?? []).slice(0, 6),
    width: item.width,
    height: item.height,
    durationMs: item.totalDurationMs,
    layerCount: item.layerCount,
    previewUrl: previews[item.id],
  };
}

/** All templates as lightweight cards, richest (most layers) first.
 *  Cards with a rendered preview are surfaced before swatch-only ones. */
export function listTemplateCards(): TemplateCard[] {
  const previews = loadPreviews();
  return Object.values(index.items)
    .map((item) => toCard(item, previews))
    .sort((a, b) => {
      const pv = Number(Boolean(b.previewUrl)) - Number(Boolean(a.previewUrl));
      return pv !== 0 ? pv : b.layerCount - a.layerCount;
    });
}

export function templateCount(): number {
  return Object.keys(index.items).length;
}
