/**
 * Originality score: max cosine similarity of this video's fingerprint vs the channel's last N videos,
 * using in-process TF-IDF (no embeddings API). Fingerprint = script text + scene block sequence
 * (block bigrams, so "same template, same order" is caught even with new words).
 */

const STOP = new Set("a an the and or but of to in on for with at by from is are was were be been it this that these those as you your we our they their i me my he she his her not no do does did so if then than there here what which who how why when can will just also".split(" "));

export function tokens(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 1 && !STOP.has(t));
}

export interface Fingerprint { text: string; blocks: string[] }

/** Terms for one doc: word unigrams + bigrams, plus block-sequence bigrams (prefixed so they never collide with words). */
export function docTerms(fp: Fingerprint): string[] {
  const t = tokens(fp.text);
  const out = [...t];
  for (let i = 1; i < t.length; i++) out.push(`${t[i - 1]}_${t[i]}`);
  const b = fp.blocks.map((x) => x.toLowerCase());
  for (let i = 0; i < b.length; i++) out.push(`§${b[i]}`);
  for (let i = 1; i < b.length; i++) out.push(`§${b[i - 1]}>${b[i]}`);
  return out;
}

type Vec = Map<string, number>;

export function tfidfVectors(docs: string[][]): Vec[] {
  const df = new Map<string, number>();
  for (const d of docs) for (const term of new Set(d)) df.set(term, (df.get(term) ?? 0) + 1);
  const n = docs.length;
  return docs.map((d) => {
    const tf = new Map<string, number>();
    for (const term of d) tf.set(term, (tf.get(term) ?? 0) + 1);
    const v: Vec = new Map();
    for (const [term, c] of tf) v.set(term, (c / d.length) * (Math.log((1 + n) / (1 + (df.get(term) ?? 0))) + 1));
    return v;
  });
}

export function cosine(a: Vec, b: Vec): number {
  let dot = 0, na = 0, nb = 0;
  for (const [, x] of a) na += x * x;
  for (const [, y] of b) nb += y * y;
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  for (const [k, x] of small) { const y = big.get(k); if (y) dot += x * y; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export interface OriginalityResult {
  /** 1 - max similarity: 1 = fully original, 0 = duplicate. */
  score: number;
  maxSimilarity: number;
  mostSimilarId?: string;
  comparedTo: number;
  flags: string[];
}

export function originality(current: Fingerprint, previous: Array<Fingerprint & { id: string }>, thresholds = { warn: 0.6, block: 0.85 }): OriginalityResult {
  if (!previous.length) return { score: 1, maxSimilarity: 0, comparedTo: 0, flags: [] };
  const vecs = tfidfVectors([docTerms(current), ...previous.map(docTerms)]);
  let max = 0;
  let id: string | undefined;
  for (let i = 1; i < vecs.length; i++) {
    const s = cosine(vecs[0], vecs[i]);
    if (s > max) { max = s; id = previous[i - 1].id; }
  }
  const flags: string[] = [];
  if (max >= thresholds.block) flags.push("near_duplicate");
  else if (max >= thresholds.warn) flags.push("similar_to_recent");
  return { score: Math.round((1 - max) * 1000) / 1000, maxSimilarity: Math.round(max * 1000) / 1000, mostSimilarId: id, comparedTo: previous.length, flags };
}
