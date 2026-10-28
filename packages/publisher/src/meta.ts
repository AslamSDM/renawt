import type { Platform, Privacy, PublishMeta } from "./types";

export interface PlatformLimits {
  /** Max title length (platforms with a separate title field). */
  title?: number;
  /** Max caption/description length INCLUDING hashtags. */
  caption: number;
  /** Max hashtags we emit (hard limit or recommendation). */
  hashtags: number;
  /** Hard platform limit on hashtags (exceeding = rejected), when known. */
  hashtagsHard?: number;
  /** YouTube: total chars of tags. */
  tagsTotal?: number;
}

/** Sources: docs/research/2026-10-28-distribution-trends.md §1, Upload-Post/Post for Me OpenAPI. */
export const PLATFORM_LIMITS: Record<Platform, PlatformLimits> = {
  YOUTUBE: { title: 100, caption: 5000, hashtags: 15, hashtagsHard: 60, tagsTotal: 500 },
  TIKTOK: { caption: 2200, hashtags: 5 },
  INSTAGRAM: { caption: 2200, hashtags: 30, hashtagsHard: 30 },
  FACEBOOK: { caption: 2200, hashtags: 10 },
  THREADS: { caption: 500, hashtags: 1, hashtagsHard: 1 },
  X: { caption: 280, hashtags: 2 },
  LINKEDIN: { title: 200, caption: 3000, hashtags: 5 },
  PINTEREST: { title: 100, caption: 500, hashtags: 5 },
};

export interface MetaInput {
  title?: string;
  caption?: string;
  hashtags?: string[];
  aiGenerated?: boolean;
  madeForKids?: boolean;
  commercial?: boolean;
  privacy?: Privacy;
  description?: string;
  tags?: string[];
}

export interface PlatformMeta {
  platform: Platform;
  /** YouTube/LinkedIn/Pinterest title. */
  title?: string;
  /** Final text: caption + hashtags, within the platform limit. For YouTube this is the description. */
  caption: string;
  hashtags: string[];
  /** YouTube tags (≤500 chars total). */
  tags?: string[];
  privacy?: Privacy;
  aiGenerated: boolean;
  madeForKids?: boolean;
  commercial?: boolean;
  warnings: string[];
}

export interface MetaOptions {
  /** Terms stripped from user-facing text. Default ["remawt"]. */
  brandTerms?: string[];
}

const len = (s: string) => [...s].length;

/** Truncate by code points, preferring a word boundary in the last 25%, adding "…" within the limit. */
export function truncate(s: string, max: number): string {
  const chars = [...s];
  if (chars.length <= max) return s;
  if (max <= 1) return chars.slice(0, max).join("");
  let cut = chars.slice(0, max - 1).join("");
  const sp = cut.search(/\s\S*$/);
  if (sp > (max - 1) * 0.75) cut = cut.slice(0, sp);
  return cut.replace(/[\s.,;:!?-]+$/u, "") + "…";
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Remove our brand (mentions, "made with X", domains, hashtags) from text. Never adds any watermark text. */
export function stripBrand(text: string, brandTerms: string[] = ["remawt"]): string {
  let out = text;
  for (const term of brandTerms) {
    const t = escapeRe(term);
    out = out
      .replace(new RegExp(`\\b(?:made|created|generated|powered|built)\\s+(?:with|by|using|on)\\s+@?#?${t}(?:\\.\\w+)?\\b`, "giu"), "")
      .replace(new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?${t}\\.[a-z]{2,}(?:\\/\\S*)?`, "giu"), "")
      .replace(new RegExp(`[#@]${t}\\w*`, "giu"), "")
      .replace(new RegExp(`\\b${t}\\b`, "giu"), "");
  }
  return out
    .replace(/[ \t]+([,.!?;:])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^[\s|·•:,;\-–—]+|[\s|·•:,;\-–—]+$/g, "")
    .trim();
}

/** Normalise hashtags: strip '#', keep letters/digits/_ (unicode), dedupe case-insensitively, drop brand + empty. */
export function normalizeHashtags(tags: string[], brandTerms: string[] = ["remawt"]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "");
    if (!t) continue;
    const k = t.toLowerCase();
    if (brandTerms.some((b) => k.includes(b.toLowerCase()))) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/** Hashtags already present inside a text (lowercased, without '#'). */
function hashtagsIn(text: string): Set<string> {
  return new Set([...text.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1].toLowerCase()));
}

/**
 * Build per-platform metadata within limits.
 * Order of degradation when over the caption limit: drop trailing hashtags first, then truncate the body.
 */
export function buildPlatformMeta(platform: Platform, input: MetaInput, opts: MetaOptions = {}): PlatformMeta {
  const brand = opts.brandTerms ?? ["remawt"];
  const lim = PLATFORM_LIMITS[platform];
  const warnings: string[] = [];

  let body = stripBrand(platform === "YOUTUBE" ? input.description ?? input.caption ?? "" : input.caption ?? "", brand);
  if (platform === "YOUTUBE") body = body.replace(/[<>]/g, ""); // YouTube rejects angle brackets
  const existing = hashtagsIn(body);
  let tags = normalizeHashtags(input.hashtags ?? [], brand).filter((t) => !existing.has(t.toLowerCase()));

  const maxTags = Math.max(0, lim.hashtags - existing.size);
  if (tags.length > maxTags) {
    warnings.push(`${platform}: hashtags reduced from ${tags.length} to ${maxTags} (limit ${lim.hashtags})`);
    tags = tags.slice(0, maxTags);
  }

  const compose = (b: string, t: string[]) => [b, t.map((x) => `#${x}`).join(" ")].filter(Boolean).join(b && t.length ? "\n\n" : "");
  let caption = compose(body, tags);
  while (len(caption) > lim.caption && tags.length > 0) {
    tags = tags.slice(0, -1);
    caption = compose(body, tags);
  }
  if (len(caption) > lim.caption) {
    warnings.push(`${platform}: caption truncated to ${lim.caption} chars`);
    caption = truncate(body, lim.caption);
  }

  let title: string | undefined;
  if (lim.title !== undefined) {
    let t = stripBrand(input.title ?? "", brand);
    if (platform === "YOUTUBE") t = t.replace(/[<>]/g, "");
    if (!t) t = stripBrand((input.caption ?? "").split("\n")[0] ?? "", brand).replace(/#[\p{L}\p{N}_]+/gu, "").trim();
    if (len(t) > lim.title) {
      warnings.push(`${platform}: title truncated to ${lim.title} chars`);
      t = truncate(t, lim.title);
    }
    title = t || undefined;
    if (platform === "YOUTUBE" && !title) warnings.push("YOUTUBE: title is empty (required)");
  }

  let ytTags: string[] | undefined;
  if (platform === "YOUTUBE") {
    const pool = normalizeHashtags([...(input.tags ?? []), ...(input.hashtags ?? [])], brand);
    ytTags = [];
    let total = 0;
    for (const t of pool) {
      const cost = len(t) + (t.includes(" ") ? 2 : 0) + (ytTags.length ? 1 : 0);
      if (total + cost > (lim.tagsTotal ?? 500)) break;
      ytTags.push(t);
      total += cost;
    }
  }

  return {
    platform,
    title,
    caption,
    hashtags: tags,
    tags: ytTags,
    privacy: input.privacy,
    aiGenerated: input.aiGenerated ?? false,
    madeForKids: platform === "YOUTUBE" ? input.madeForKids ?? false : input.madeForKids,
    commercial: input.commercial,
    warnings,
  };
}

/** Convenience: build from a PublishMeta. */
export function metaFor(platform: Platform, meta: PublishMeta, opts?: MetaOptions): PlatformMeta {
  return buildPlatformMeta(platform, meta, opts);
}
