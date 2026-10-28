import { requestJson } from "../http";
import type { NicheInput, RawTrendItem, RadarEnv, SourceContext } from "../types";

/** Exa neural search for "this week in <niche>" news. Returns `evidence` items for trend cards. */
export function exaConfigured(env: RadarEnv): boolean { return Boolean(env.EXA_API_KEY); }

export interface EvidenceItem { url: string; title: string; source: string; publishedAt?: Date; snippet?: string }

interface ExaResult { url?: string; title?: string; publishedDate?: string; author?: string; text?: string; summary?: string; highlights?: string[] }

export function parseExaResults(json: unknown, query?: string): RawTrendItem[] {
  const results = ((json as { results?: ExaResult[] })?.results ?? []);
  const out: RawTrendItem[] = [];
  for (const r of results) {
    if (!r.url || !r.title) continue;
    let host = "web";
    try { host = new URL(r.url).hostname.replace(/^www\./, ""); } catch { /* keep default */ }
    out.push({
      platform: "NEWS",
      kind: "evidence",
      url: r.url,
      title: r.title.trim(),
      caption: (r.summary ?? r.highlights?.join(" … ") ?? r.text)?.slice(0, 500),
      creator: r.author || host,
      views: 0,
      publishedAt: r.publishedDate ? new Date(r.publishedDate) : undefined,
      sourceId: "exa-news",
      query,
    });
  }
  return out;
}

export function toEvidence(items: RawTrendItem[]): EvidenceItem[] {
  return items.map((i) => ({ url: i.url, title: i.title, source: i.creator ?? "web", publishedAt: i.publishedAt, snippet: i.caption }));
}

export async function exaNews(niche: NicheInput, ctx: SourceContext = {}, opts: { numResults?: number; days?: number } = {}): Promise<RawTrendItem[]> {
  const env = ctx.env ?? process.env;
  if (!env.EXA_API_KEY) return [];
  const now = ctx.now ?? new Date();
  const query = `this week in ${niche.name ?? niche.keywords[0] ?? niche.slug}: ${niche.keywords.slice(0, 3).join(", ")}`;
  const json = await requestJson("https://api.exa.ai/search", {
    fetch: ctx.fetch,
    headers: { "x-api-key": env.EXA_API_KEY },
    body: {
      query,
      type: "auto",
      category: "news",
      numResults: opts.numResults ?? 10,
      startPublishedDate: new Date(now.getTime() - (opts.days ?? 7) * 86400000).toISOString(),
      contents: { text: { maxCharacters: 600 } },
    },
  });
  return parseExaResults(json, query);
}
