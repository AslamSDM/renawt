import { basicAuth, requestJson } from "../http";
import type { NicheInput, RawTrendItem, RadarEnv, SourceContext } from "../types";

/**
 * Google Trends via DataForSEO `keywords_data/google_trends/explore/live`.
 * Uses the live endpoint for simplicity; the standard queue (task_post → task_get) is
 * ~3× cheaper (~$0.0027/task) and can be swapped in by the engine for batch jobs.
 * Each task takes up to 5 keywords. Rising queries become `signal` items whose `views`
 * is the rising value (% growth, or 5000 for "Breakout") — only comparable within source.
 */
export function googleTrendsConfigured(env: RadarEnv): boolean { return Boolean(env.DATAFORSEO_LOGIN && env.DATAFORSEO_PASSWORD); }

interface DfsQueryItem { query?: string; value?: number }
interface DfsItem { type?: string; keywords?: string[]; data?: { top?: DfsQueryItem[]; rising?: DfsQueryItem[] } }

export function parseGoogleTrendsExplore(json: unknown, opts: { now?: Date; includeTop?: boolean } = {}): RawTrendItem[] {
  const tasks = ((json as { tasks?: Array<{ status_code?: number; result?: Array<{ items?: DfsItem[] }> }> })?.tasks ?? []);
  const now = opts.now ?? new Date();
  const seen = new Set<string>();
  const out: RawTrendItem[] = [];
  for (const t of tasks) {
    for (const r of t.result ?? []) {
      for (const item of r.items ?? []) {
        if (item.type !== "google_trends_queries_list") continue;
        const lists: Array<[DfsQueryItem[] | undefined, string]> = [[item.data?.rising, "rising"]];
        if (opts.includeTop) lists.push([item.data?.top, "top"]);
        for (const [list, kind] of lists) {
          for (const q of list ?? []) {
            if (!q.query || seen.has(q.query.toLowerCase())) continue;
            seen.add(q.query.toLowerCase());
            out.push({
              platform: "GOOGLE_TRENDS",
              kind: "signal",
              url: `https://trends.google.com/trends/explore?date=now%207-d&q=${encodeURIComponent(q.query)}`,
              title: q.query,
              views: Number(q.value ?? 0),
              publishedAt: new Date(now.getTime() - 3.5 * 86400000), // window midpoint
              sourceId: `google-trends-${kind}`,
              query: (item.keywords ?? []).join(", "),
            });
          }
        }
      }
    }
  }
  return out;
}

export async function googleTrendsRising(niche: NicheInput, ctx: SourceContext = {}, opts: { location?: string; maxTasks?: number } = {}): Promise<RawTrendItem[]> {
  const env = ctx.env ?? process.env;
  if (!googleTrendsConfigured(env)) return [];
  const auth = basicAuth(env.DATAFORSEO_LOGIN!, env.DATAFORSEO_PASSWORD!);
  const groups: string[][] = [];
  for (let i = 0; i < niche.keywords.length && groups.length < (opts.maxTasks ?? 2); i += 5) groups.push(niche.keywords.slice(i, i + 5));
  const out: RawTrendItem[] = [];
  for (const keywords of groups) {
    const json = await requestJson("https://api.dataforseo.com/v3/keywords_data/google_trends/explore/live", {
      fetch: ctx.fetch,
      headers: { authorization: auth },
      body: [{ keywords, location_name: opts.location ?? "United States", time_range: "past_7_days", type: "web", item_types: ["google_trends_queries_list"] }],
      timeoutMs: 60_000,
    });
    out.push(...parseGoogleTrendsExplore(json, { now: ctx.now }));
  }
  return out;
}
