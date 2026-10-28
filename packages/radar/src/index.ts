import { getNiche, IdentityKitSchema, type IdentityKit, type Niche } from "./shared";
import { ANY_TOPIC, ensureArms, sampleMix, updateFromMetrics, type Arm, type Rng } from "./bandit";
import { clusterItems } from "./cluster";
import {
  createIdeas, loadChannelOutcomes, loadRecentTitles, loadTrendCards, upsertTrendItems, writeTrendCards, type RadarDb, type StoredCard,
} from "./persist";
import { allowedFormats, buildIdeaPrompt, buildTagPrompt, IdeaResultSchema, parseIdeaResult, parseTagResult, TagResultSchema, type LlmPrompt } from "./prompts";
import { scoreItems, type NicheBaseline } from "./score";
import { configuredSources, SOURCES } from "./sources";
import { guessFormat, UNKNOWN_FORMAT } from "./taxonomy";
import { chunk, tokenize } from "./text";
import type { IdeaDraft, NicheInput, RadarEnv, RawTrendItem, ScoredTrendItem, SourceContext, TaggedTrendItem, TrendSource, TrendTags } from "./types";
import { previousWeekKey, weekKey as toWeekKey } from "./week";

export * from "./types";
export * from "./text";
export * from "./week";
export * from "./cache";
export * from "./quota";
export * from "./score";
export * from "./taxonomy";
export * from "./prompts";
export * from "./cluster";
export * from "./bandit";
export * from "./persist";
export * from "./sources";

export type RunLlm<S> = (prompt: { system: string; prompt: string; maxOutputTokens: number }, schema: S) => Promise<unknown>;

/** Heuristic tags used when the tagger is unavailable or skips an item. */
export function heuristicTags(it: Pick<RawTrendItem, "title" | "caption" | "lengthSec" | "query">): TrendTags {
  const g = guessFormat(it.title, it.caption);
  const formatWords = new Set(["top", "pov", "explain", "explained", "vs", "quiz", "guess", "thing", "wish", "knew", "know", "fact", "story", "chart", "how", "why", "what", "every", "best", "worst", "shorts", "short", "video", "viral"]);
  const topic = tokenize(it.title).filter((w) => !formatWords.has(w) && !/^\d+$/.test(w)).slice(0, 4).join(" ") || (it.query ?? it.title).toLowerCase().slice(0, 40);
  return { topic, format: g?.id ?? UNKNOWN_FORMAT, hookType: /\?\s*$/.test(it.title) ? "question" : "other", lengthSec: it.lengthSec };
}

export interface RefreshNicheInput {
  niche: string | Niche | NicheInput;
  env: RadarEnv;
  prisma?: RadarDb;                       // omit for a dry run (no persistence)
  runTagger?: RunLlm<typeof TagResultSchema>;
  sources?: TrendSource[];
  cadences?: Array<TrendSource["cadence"]>;
  ctx?: Omit<SourceContext, "env">;
  now?: Date;
  weekKey?: string;
  baseline?: NicheBaseline;
  maxTagItems?: number;
  tagBatchSize?: number;
}

export interface RefreshNicheResult {
  niche: string;
  weekKey: string;
  itemsFetched: number;
  itemsScored: number;
  itemsPersisted: number;
  cards: Array<StoredCard | (ReturnType<typeof clusterItems>[number] & { id?: string })>;
  sources: Array<{ id: string; items: number; error?: string }>;
  tagger: { batches: number; failed: number; heuristic: number };
}

function resolveNiche(n: RefreshNicheInput["niche"]): NicheInput {
  if (typeof n !== "string") return n;
  const found = getNiche(n);
  if (!found) throw new Error(`Unknown niche: ${n}`);
  return found;
}

/** sources → score → tag (LLM pass 1, heuristic fallback) → cluster → persist. */
export async function refreshNiche(input: RefreshNicheInput): Promise<RefreshNicheResult> {
  const niche = resolveNiche(input.niche);
  const now = input.now ?? new Date();
  const wk = input.weekKey ?? toWeekKey(now);
  let sources = configuredSources(input.env, input.sources ?? SOURCES);
  if (input.cadences) sources = sources.filter((s) => input.cadences!.includes(s.cadence));
  const ctx: SourceContext = { ...input.ctx, env: input.env, now };

  const settled = await Promise.allSettled(sources.map((s) => s.fetch(niche, ctx)));
  const raw: RawTrendItem[] = [];
  const sourceReport = settled.map((r, i) => {
    if (r.status === "fulfilled") { raw.push(...r.value); return { id: sources[i]!.id, items: r.value.length }; }
    return { id: sources[i]!.id, items: 0, error: String((r.reason as Error)?.message ?? r.reason).slice(0, 300) };
  });

  const scored = scoreItems(raw, input.baseline, { now }).map((it, i) => ({ ...it, id: it.id ?? `i${i + 1}` }));
  const toTag = scored.slice(0, input.maxTagItems ?? 150);
  const tagMap = new Map<string, TrendTags>();
  const tagger = { batches: 0, failed: 0, heuristic: 0 };
  if (input.runTagger) {
    for (const batch of chunk(toTag, input.tagBatchSize ?? 40)) {
      tagger.batches++;
      try {
        const p: LlmPrompt<typeof TagResultSchema> = buildTagPrompt(batch, { niche: niche.name ?? niche.slug });
        const res = await input.runTagger({ system: p.system, prompt: p.prompt, maxOutputTokens: p.maxOutputTokens }, p.schema);
        const ids = new Set(batch.map((b) => b.id));
        for (const t of parseTagResult(res)) if (ids.has(t.id)) tagMap.set(t.id, { topic: t.topic, format: t.format, hookType: t.hookType, lengthSec: t.lengthSec, visualStyle: t.visualStyle });
      } catch {
        tagger.failed++;
      }
    }
  }
  const tagged: TaggedTrendItem[] = toTag.map((it) => {
    let tags = tagMap.get(it.id);
    if (!tags) { tagger.heuristic++; tags = heuristicTags(it); }
    return { ...it, tags };
  });

  const drafts = clusterItems(tagged, { niche: niche.slug, weekKey: wk });
  let cards: RefreshNicheResult["cards"] = drafts;
  let itemsPersisted = 0;
  if (input.prisma) {
    const tagById = new Map(tagged.map((t) => [t.id, t.tags]));
    itemsPersisted = await upsertTrendItems(input.prisma, niche.slug, scored.map((s: ScoredTrendItem & { id: string }) => ({ ...s, tags: tagById.get(s.id) })), { now });
    cards = await writeTrendCards(input.prisma, niche.slug, wk, drafts);
  }
  return { niche: niche.slug, weekKey: wk, itemsFetched: raw.length, itemsScored: scored.length, itemsPersisted, cards, sources: sourceReport, tagger };
}

export interface IdeasForChannelInput {
  channel: { id: string; niche: string; kit: unknown };
  prisma: RadarDb;
  runIdeator: RunLlm<typeof IdeaResultSchema>;
  count?: number;
  weekKey?: string;
  now?: Date;
  rng?: Rng;
  /** Pre-loaded bandit arms; when omitted they're rebuilt from MetricSnapshots. */
  arms?: Arm[];
  persist?: boolean;
}

export interface IdeasForChannelResult { ideaIds: string[]; drafts: IdeaDraft[]; formatMix: Record<string, number>; weekKey: string; cardsUsed: number }

/** LLM pass 2: cards (this week, else last week) + kit + bandit mix → validated IdeaDrafts → Idea rows. */
export async function ideasForChannel(input: IdeasForChannelInput): Promise<IdeasForChannelResult> {
  const { channel, prisma } = input;
  const niche = getNiche(channel.niche) ?? { slug: channel.niche, name: channel.niche, group: "", keywords: [], subreddits: [] };
  const parsedKit = IdentityKitSchema.safeParse(channel.kit);
  const kit: Partial<IdentityKit> = parsedKit.success ? parsedKit.data : ((channel.kit ?? {}) as Partial<IdentityKit>);
  const count = input.count ?? 10;
  let wk = input.weekKey ?? toWeekKey(input.now ?? new Date());
  let cards = await loadTrendCards(prisma, niche.slug, wk);
  if (cards.length === 0) {
    const prev = previousWeekKey(wk);
    const prevCards = await loadTrendCards(prisma, niche.slug, prev);
    if (prevCards.length) { cards = prevCards; wk = prev; }
  }
  const recentTitles = await loadRecentTitles(prisma, channel.id);

  const formats = allowedFormats(niche).map((f) => f.id);
  const preferred = (kit.formatPrefs ?? []).filter((f) => formats.includes(f));
  const candidateFormats = preferred.length ? preferred : formats;
  let arms = input.arms;
  if (!arms) {
    const outcomes = await loadChannelOutcomes(prisma, channel.id).catch(() => []);
    arms = updateFromMetrics([], outcomes.map((o) => ({ ...o, topic: ANY_TOPIC })));
  }
  arms = ensureArms(arms.filter((a) => candidateFormats.includes(a.format)), candidateFormats.map((format) => ({ format, topic: ANY_TOPIC })));
  const mix = sampleMix(arms, count, { rng: input.rng });

  const p = buildIdeaPrompt({ kit, niche, cards, count, recentTitles, formatMix: mix.formats });
  const raw = await input.runIdeator({ system: p.system, prompt: p.prompt, maxOutputTokens: p.maxOutputTokens }, p.schema);
  const drafts = parseIdeaResult(raw, { cards, recentTitles, niche }).slice(0, count);
  const ideaIds = input.persist === false ? [] : await createIdeas(prisma, channel.id, drafts);
  return { ideaIds, drafts, formatMix: mix.formats, weekKey: wk, cardsUsed: cards.length };
}
