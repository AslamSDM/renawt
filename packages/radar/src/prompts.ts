import { z } from "zod";
import { FORMATS, FORMAT_IDS, type IdentityKit, type Niche } from "./shared";
import { guessFormat, TAXONOMY, TAXONOMY_IDS, UNKNOWN_FORMAT } from "./taxonomy";
import { jaccard, keywordSet } from "./text";
import type { IdeaDraft, ScoredTrendItem, TrendCardDraft } from "./types";

/**
 * LLM prompt builders + zod result schemas. The radar never calls a model itself: the
 * engine runs `{system, prompt}` through its model router with `schema` as the
 * structured-output schema, then hands the raw result back to `parse*Result`.
 * Result roots are objects (`{tags: [...]}`, `{ideas: [...]}`) because most providers'
 * structured-output modes require an object root; the parsers also accept a bare array.
 */
export interface LlmPrompt<S extends z.ZodTypeAny> { system: string; prompt: string; schema: S; maxOutputTokens: number }

export const HOOK_TYPES = ["question", "shocking-stat", "bold-claim", "pov", "list-promise", "challenge", "story-open", "contrarian", "how-to", "news", "other"] as const;

// ───────────────────────────── pass 1: tagging ─────────────────────────────

export const TagItemSchema = z.object({
  id: z.string(),
  topic: z.string().min(1).max(80).describe("2–5 word topic, lowercase, no format words (e.g. 'index fund fees')"),
  format: z.enum([...TAXONOMY_IDS, UNKNOWN_FORMAT]),
  hookType: z.enum(HOOK_TYPES),
  lengthSec: z.number().min(0).max(3600).optional(),
  visualStyle: z.string().max(60).optional(),
});
export type TagItem = z.infer<typeof TagItemSchema>;
export const TagResultSchema = z.object({ tags: z.array(TagItemSchema) });
export type TagResult = z.infer<typeof TagResultSchema>;

export function taxonomyBlock(): string {
  return TAXONOMY.map((t) => `- ${t.id}: ${t.name} — ${t.structure}`).join("\n");
}

export function buildTagPrompt(items: Array<ScoredTrendItem & { id: string }>, opts: { niche?: string } = {}): LlmPrompt<typeof TagResultSchema> {
  const system = [
    "You label short-form video trend items for a faceless-video content radar.",
    "For EACH item return {id, topic, format, hookType, lengthSec?, visualStyle?}.",
    "topic: the subject in 2–5 lowercase words, stripped of format words (no 'top 5', 'pov', 'explained'). Items about the same subject MUST share the same topic string.",
    `format: one of the taxonomy ids below, or "${UNKNOWN_FORMAT}" if none fits. A regex hint is provided; override it when wrong.`,
    `hookType: one of ${HOOK_TYPES.join(", ")}.`,
    "visualStyle: short phrase (e.g. 'kinetic text', '3d animation', 'stock b-roll', 'screen recording', 'stickman', 'chart').",
    "Return every id exactly once. Do not invent ids.",
    "",
    "Format taxonomy:",
    taxonomyBlock(),
  ].join("\n");
  const lines = items.map((it) => {
    const g = guessFormat(it.title, it.caption);
    return JSON.stringify({
      id: it.id,
      platform: it.platform,
      title: it.title.slice(0, 200),
      caption: it.caption?.replace(/\s+/g, " ").slice(0, 200),
      lengthSec: it.lengthSec,
      hint: g?.id,
    });
  });
  const prompt = `${opts.niche ? `Niche: ${opts.niche}\n` : ""}Items (JSON lines):\n${lines.join("\n")}\n\nReturn {"tags": [...]} with ${items.length} entries.`;
  return { system, prompt, schema: TagResultSchema, maxOutputTokens: Math.min(8000, 120 + items.length * 70) };
}

/** Lenient parse: accepts `{tags}` or a bare array, drops invalid rows instead of failing the batch. */
export function parseTagResult(raw: unknown): TagItem[] {
  const arr = Array.isArray(raw) ? raw : (raw as { tags?: unknown })?.tags;
  if (!Array.isArray(arr)) return [];
  const out: TagItem[] = [];
  for (const row of arr) {
    const r = TagItemSchema.safeParse(row);
    if (r.success) out.push(r.data);
    else {
      // tolerate unknown format/hookType strings by coercing to "other"
      const loose = z.object({ id: z.string(), topic: z.string().min(1) }).passthrough().safeParse(row);
      if (loose.success) {
        const o = loose.data as Record<string, unknown>;
        out.push({
          id: loose.data.id,
          topic: loose.data.topic.slice(0, 80),
          format: (TAXONOMY_IDS as string[]).includes(String(o.format)) ? String(o.format) : UNKNOWN_FORMAT,
          hookType: (HOOK_TYPES as readonly string[]).includes(String(o.hookType)) ? (o.hookType as TagItem["hookType"]) : "other",
          lengthSec: typeof o.lengthSec === "number" ? o.lengthSec : undefined,
          visualStyle: typeof o.visualStyle === "string" ? o.visualStyle.slice(0, 60) : undefined,
        });
      }
    }
  }
  return out;
}

// ───────────────────────────── pass 2: ideation ─────────────────────────────

const PRODUCIBLE_IDS = FORMAT_IDS as [string, ...string[]];

export const IdeaDraftSchema = z.object({
  hook: z.string().min(3).max(160),
  title: z.string().min(3).max(100),
  format: z.enum(PRODUCIBLE_IDS),
  angle: z.string().min(3).max(400),
  beats: z.array(z.object({ label: z.string(), durationSec: z.number().min(0.5).max(60), note: z.string() })).min(2).max(10),
  evidence: z.array(z.object({ url: z.string().url(), title: z.string() })).max(6),
  risk: z.object({ level: z.enum(["low", "medium", "high"]), flags: z.array(z.string()).max(8) }),
  score: z.number().min(0).max(1),
  cardId: z.string().optional(),
});
export const IdeaResultSchema = z.object({ ideas: z.array(IdeaDraftSchema) });
export type IdeaResult = z.infer<typeof IdeaResultSchema>;

export interface IdeaCardInput extends Pick<TrendCardDraft, "topic" | "format" | "score" | "summary" | "exemplars" | "evidence"> { id?: string; hookType?: string | null }
export type IdeaNicheInput = Pick<Niche, "slug" | "name"> & Partial<Pick<Niche, "group" | "riskNotes" | "keywords">>;

export interface BuildIdeaPromptInput {
  kit: Partial<IdentityKit>;
  niche: IdeaNicheInput;
  cards: IdeaCardInput[];
  count: number;
  recentTitles: string[];
  /** Bandit-recommended format counts, e.g. {"x-vs-y": 4, "mythbust": 3}. */
  formatMix?: Record<string, number>;
}

/** Niches where an "AI advisor" persona is never allowed (policy guardrail §4.8.4). */
export const ADVICE_GROUPS = new Set(["finance", "health"]);
export const ADVICE_SLUGS = new Set(["law", "mental-health", "personal-finance", "investing", "crypto", "real-estate", "health"]);
export function isAdviceNiche(n: IdeaNicheInput): boolean { return ADVICE_SLUGS.has(n.slug) || (n.group ? ADVICE_GROUPS.has(n.group) : false); }

export function allowedFormats(niche: IdeaNicheInput): typeof FORMATS {
  const tags = new Set([niche.slug, niche.group ?? "", ...niche.slug.split("-")]);
  const ok = FORMATS.filter((f) => f.niches.includes("*") || f.niches.some((n) => tags.has(n)));
  return ok.length ? ok : FORMATS.filter((f) => f.niches.includes("*"));
}

export function buildIdeaPrompt(input: BuildIdeaPromptInput): LlmPrompt<typeof IdeaResultSchema> {
  const { kit, niche, cards, count, recentTitles } = input;
  const formats = allowedFormats(niche);
  const advice = isAdviceNiche(niche);
  const persona = kit.persona;
  const rules = [
    `Return exactly ${count} ideas as {"ideas": [...]}.`,
    `format MUST be one of: ${formats.map((f) => f.id).join(", ")}. Beats MUST follow that format's beat grammar and sum to ~${kit.defaultDurationSec ?? 45}s.`,
    "evidence: ONLY URLs that appear in the trend cards below (exemplars or evidence). Never invent URLs. Ideas making factual claims need ≥1 evidence item.",
    "cardId: set to the id of the trend card the idea is based on (omit for evergreen ideas). At least 70% of ideas should ride a card.",
    "hook: the first spoken/on-screen line, ≤12 words, no clickbait the video cannot pay off.",
    "Ideas must be original angles — do not copy exemplar titles; add a new insight, comparison or data point.",
    "risk.level/flags: flag 'misinformation' for unverified claims, 'copyright' if it relies on others' footage/music, 'ypp-originality' if templated/low-effort, 'sensitive' for tragedy/health/minors, 'financial-advice' / 'medical-advice' / 'legal-advice' when it could read as advice.",
    "score: 0–1, your estimate of breakout potential for THIS channel (trend strength × persona fit × originality).",
    "Never use 'as an AI' phrasing or reference being an AI.",
  ];
  if (advice) rules.push(
    "This is a regulated-advice niche: NO 'AI advisor' / expert / coach persona. The narrator explains and cites; it never tells the viewer what they personally should buy, take, sign or do. Phrase as information ('here is what the data shows'), cite a named source on screen for every claim, and include risk flag 'needs-citation'.",
  );
  if (niche.riskNotes) rules.push(`Niche rules: ${niche.riskNotes}.`);
  if (kit.forbiddenTopics?.length) rules.push(`Never cover: ${kit.forbiddenTopics.join("; ")}.`);
  if (persona?.avoid?.length) rules.push(`Persona avoids: ${persona.avoid.join("; ")}.`);
  if (input.formatMix && Object.keys(input.formatMix).length) {
    const mix = Object.entries(input.formatMix).filter(([f]) => formats.some((x) => x.id === f)).map(([f, n]) => `${f}×${n}`).join(", ");
    if (mix) rules.push(`Target format mix (from this channel's performance data): ${mix}. Deviate only if a format cannot fit any card.`);
  }

  const system = [
    "You are the ideation desk for a faceless short-form video channel. You turn this week's trend cards into concrete, original video ideas written in the channel's voice.",
    "",
    "Rules:",
    ...rules.map((r) => `- ${r}`),
    "",
    "Formats (id — tagline — beats):",
    ...formats.map((f) => `- ${f.id} — ${f.tagline} — ${f.beats.map((b) => `${b.label} ${Math.round(b.share * 100)}%`).join(" / ")}${f.scriptRules.length ? ` — rules: ${f.scriptRules.join("; ")}` : ""}`),
  ].join("\n");

  const channel = {
    niche: niche.name,
    audience: kit.audience,
    promise: kit.promise,
    persona: persona ? { name: persona.name, pov: persona.pov, tone: persona.tone, signaturePhrases: persona.signaturePhrases } : undefined,
    formatPrefs: kit.formatPrefs,
    durationSec: kit.defaultDurationSec ?? 45,
  };
  const cardLines = cards.slice(0, 20).map((c, i) => JSON.stringify({
    id: c.id ?? `card-${i + 1}`,
    topic: c.topic,
    trendFormat: c.format,
    hookType: c.hookType ?? undefined,
    score: Number(c.score.toFixed(2)),
    summary: c.summary,
    exemplars: c.exemplars.slice(0, 3).map((e) => ({ url: e.url, title: e.title, views: e.views, platform: e.platform })),
    evidence: (c.evidence ?? []).slice(0, 4),
  }));
  const prompt = [
    `Channel: ${JSON.stringify(channel)}`,
    "",
    `Trend cards this week (${cards.length}):`,
    ...cardLines,
    "",
    recentTitles.length ? `Avoid these recent titles and close variants of them (already made or suggested):\n${recentTitles.slice(0, 40).map((t) => `- ${t}`).join("\n")}` : "No recent titles.",
    "",
    `Write ${count} ideas.`,
  ].join("\n");
  return { system, prompt, schema: IdeaResultSchema, maxOutputTokens: Math.min(12000, 400 + count * 450) };
}

export interface ValidateIdeasOptions { cards: IdeaCardInput[]; recentTitles: string[]; niche: IdeaNicheInput; similarity?: number }

/**
 * Post-process model output: schema-validate each idea, keep only evidence URLs that
 * exist in the cards, drop ideas too close to recent titles (Jaccard ≥ 0.6) or to each
 * other, enforce advice-niche risk flags, and clear unknown cardIds.
 */
export function parseIdeaResult(raw: unknown, opts: ValidateIdeasOptions): IdeaDraft[] {
  const arr = Array.isArray(raw) ? raw : (raw as { ideas?: unknown })?.ideas;
  if (!Array.isArray(arr)) return [];
  const allowed = new Set(allowedFormats(opts.niche).map((f) => f.id));
  const urls = new Map<string, string>();
  for (const c of opts.cards) {
    for (const e of c.exemplars) urls.set(e.url, e.title);
    for (const e of c.evidence ?? []) urls.set(e.url, e.title);
  }
  const cardIds = new Set(opts.cards.map((c) => c.id).filter(Boolean) as string[]);
  const threshold = opts.similarity ?? 0.6;
  const taken = opts.recentTitles.map((t) => keywordSet(t));
  const advice = isAdviceNiche(opts.niche);
  const out: IdeaDraft[] = [];
  for (const row of arr) {
    const r = IdeaDraftSchema.safeParse(row);
    if (!r.success) continue;
    const idea = r.data;
    if (!allowed.has(idea.format)) continue;
    const kw = keywordSet(idea.title);
    if (taken.some((t) => jaccard(t, kw) >= threshold)) continue;
    taken.push(kw);
    const evidence = idea.evidence.filter((e) => urls.has(e.url));
    const flags = new Set(idea.risk.flags);
    let level = idea.risk.level;
    if (advice) { flags.add("needs-citation"); if (level === "low") level = "medium"; }
    if (evidence.length === 0) flags.add("no-evidence");
    out.push({ ...idea, evidence, risk: { level, flags: [...flags] }, cardId: idea.cardId && cardIds.has(idea.cardId) ? idea.cardId : undefined });
  }
  return out;
}
