import { producibleFormat, UNKNOWN_FORMAT } from "./taxonomy";
import { clamp, jaccard, keywordSet, topicKey } from "./text";
import type { RadarPlatform, TaggedTrendItem, TrendCardDraft } from "./types";

/**
 * Lexical clustering of tagged items into trend cards (embedding/HDBSCAN can replace
 * this later behind the same signature). Items are visited in score order; each joins
 * the first cluster whose normalised topic key matches exactly, else the best cluster
 * with Jaccard ≥ threshold against the cluster seed's keyword set, else seeds a new one.
 */
export interface ClusterOptions { threshold?: number; minItems?: number; maxCards?: number; niche?: string; weekKey?: string }

/** Per-item contribution to card score: outlier × velocity weight × corroboration. */
export function itemWeight(it: TaggedTrendItem): number {
  if (it.kind === "evidence") return 0;
  return clamp(it.outlier, 0, 50) * Math.log10(1 + Math.max(0, it.velocity)) * (1 + 0.25 * ((it.corroboration ?? 1) - 1));
}

function mode<T extends string>(values: Array<{ v: T; w: number }>): T | undefined {
  const tally = new Map<T, { n: number; w: number }>();
  for (const { v, w } of values) {
    const t = tally.get(v) ?? { n: 0, w: 0 };
    t.n++; t.w += w;
    tally.set(v, t);
  }
  let best: T | undefined; let bn = -1; let bw = -1;
  for (const [v, t] of tally) if (t.n > bn || (t.n === bn && t.w > bw)) { best = v; bn = t.n; bw = t.w; }
  return best;
}

interface Cluster { key: string; seed: Set<string>; items: TaggedTrendItem[] }

export function clusterItems(tagged: TaggedTrendItem[], opts: ClusterOptions = {}): TrendCardDraft[] {
  const threshold = opts.threshold ?? 0.5;
  const minItems = opts.minItems ?? 2;
  const sorted = [...tagged].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const clusters: Cluster[] = [];
  const byKey = new Map<string, Cluster>();
  for (const it of sorted) {
    const key = topicKey(it.tags.topic);
    if (!key) continue;
    let c = byKey.get(key);
    if (!c) {
      const kw = keywordSet(it.tags.topic);
      let best: Cluster | undefined; let bestJ = threshold - 1e-9;
      for (const cand of clusters) {
        const j = jaccard(cand.seed, kw);
        if (j > bestJ) { best = cand; bestJ = j; }
      }
      c = best;
      if (!c) { c = { key, seed: kw, items: [] }; clusters.push(c); }
      byKey.set(key, c);
    }
    c.items.push(it);
  }

  const cards: TrendCardDraft[] = [];
  for (const c of clusters) {
    const content = c.items.filter((i) => i.kind !== "evidence");
    const breakoutCount = content.filter((i) => i.breakout).length;
    if (c.items.length < minItems && breakoutCount === 0) continue;
    if (content.length === 0) continue; // evidence-only clusters are not trends
    const score = c.items.reduce((s, i) => s + itemWeight(i), 0);
    const exemplarPool = content.filter((i) => i.kind !== "signal" || content.every((x) => x.kind === "signal"));
    const exemplars = [...exemplarPool].sort((a, b) => itemWeight(b) - itemWeight(a)).slice(0, 3)
      .map((i) => ({ url: i.url, title: i.title, views: i.views, platform: i.platform }));
    const formats = content.map((i) => ({ v: i.tags.format, w: itemWeight(i) })).filter((x) => x.v !== UNKNOWN_FORMAT);
    const format = mode(formats) ?? UNKNOWN_FORMAT;
    const hookType = mode(content.map((i) => ({ v: i.tags.hookType, w: itemWeight(i) })));
    const topic = mode(c.items.map((i) => ({ v: i.tags.topic.toLowerCase().trim(), w: itemWeight(i) })))!;
    const platforms = [...new Set(c.items.map((i) => i.platform))] as RadarPlatform[];
    const evidence = c.items.filter((i) => i.kind === "evidence" || i.platform === "GOOGLE_TRENDS")
      .slice(0, 5).map((i) => ({ url: i.url, title: i.title, source: i.platform === "NEWS" ? (i.creator ?? "news") : i.platform.toLowerCase() }));
    const top = exemplars[0];
    const summary = `${content.length} item${content.length === 1 ? "" : "s"} on ${platforms.map((p) => p.toLowerCase()).join(" + ")}` +
      `${breakoutCount ? `, ${breakoutCount} breakout${breakoutCount === 1 ? "" : "s"} (≥5× creator median)` : ""}` +
      `${top ? `; top: "${top.title.slice(0, 80)}" (${Math.round(top.views).toLocaleString("en-US")} ${top.platform === "REDDIT" ? "upvotes" : "views"})` : ""}`;
    cards.push({
      niche: opts.niche, weekKey: opts.weekKey, topic, format, hookType, score: Number(score.toFixed(4)), summary, exemplars, evidence,
      keywords: [...c.seed], itemCount: c.items.length, breakoutCount, platforms, producibleFormat: producibleFormat(format),
    });
  }
  return cards.sort((a, b) => b.score - a.score).slice(0, opts.maxCards ?? 30);
}

export interface FormatTrend { format: string; shareThis: number; shareLast: number; delta: number; countThis: number; countLast: number }
type CardLike = { format: string; itemCount?: number; breakoutCount?: number };

/** Weight = breakout items when any, else all items, else 1 per card (DB-loaded cards). */
function cardWeight(c: CardLike): number { return c.breakoutCount ? c.breakoutCount : c.itemCount ?? 1; }

function shares(cards: CardLike[]): { share: Map<string, number>; count: Map<string, number> } {
  const count = new Map<string, number>();
  for (const c of cards) count.set(c.format, (count.get(c.format) ?? 0) + cardWeight(c));
  const total = [...count.values()].reduce((a, b) => a + b, 0) || 1;
  return { share: new Map([...count].map(([k, v]) => [k, v / total])), count };
}

/** Week-over-week format share deltas, biggest risers first. */
export function formatTrends(cardsThisWeek: CardLike[], cardsLastWeek: CardLike[]): FormatTrend[] {
  const a = shares(cardsThisWeek), b = shares(cardsLastWeek);
  const formats = new Set([...a.count.keys(), ...b.count.keys()]);
  const out: FormatTrend[] = [];
  for (const f of formats) {
    const shareThis = a.share.get(f) ?? 0, shareLast = b.share.get(f) ?? 0;
    out.push({ format: f, shareThis, shareLast, delta: shareThis - shareLast, countThis: a.count.get(f) ?? 0, countLast: b.count.get(f) ?? 0 });
  }
  return out.sort((x, y) => y.delta - x.delta || y.shareThis - x.shareThis);
}
