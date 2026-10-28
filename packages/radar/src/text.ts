/** Small text utilities: tokenising, stopwords, stem-lite, set similarity. */

export const STOPWORDS = new Set(
  ("a an the and or but if then so of in on at to for from by with without about into over under " +
    "is are was were be been being am do does did done have has had having i me my we our you your yours he she it its they them their " +
    "this that these those there here what which who whom whose why how when where all any each every some more most less few many much " +
    "not no nor only own same than too very can will just should would could may might must shall s t don now new vs versus " +
    "get got gets make makes made one two three via up down out off again once also even ever really still yet like").split(/\s+/),
);

/** Very light stemmer: strips common English suffixes while keeping short words intact. */
export function stemLite(word: string): string {
  let w = word;
  if (w.length > 5 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("es") && /(ches|shes|xes|sses|zes)$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) w = w.slice(0, -1);
  return w;
}

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#@]/g, " ")
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();
}

export function tokenize(s: string): string[] {
  return normalizeText(s)
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map(stemLite)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

export function keywordSet(s: string): Set<string> { return new Set(tokenize(s)); }

/** Canonical topic key: sorted unique stemmed tokens. */
export function topicKey(s: string): string { return [...keywordSet(s)].sort().join(" "); }

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Overlap coefficient |A∩B| / min(|A|,|B|) and raw intersection size. */
export function overlap(a: Set<string>, b: Set<string>): { coef: number; inter: number } {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const m = Math.min(a.size, b.size);
  return { coef: m === 0 ? 0 : inter / m, inter };
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function mean(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }

export function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

/** Normalise a URL for dedupe: lowercase host, drop www/m., trailing slash, tracking params; keep YouTube v=. */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase().replace(/^(www|m|old)\./, "");
    let path = u.pathname.replace(/\/+$/, "");
    if (host === "youtu.be") return `youtube.com/watch?v=${path.slice(1)}`;
    if (host === "youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return `youtube.com/watch?v=${v}`;
      const shorts = path.match(/^\/shorts\/([^/]+)/);
      if (shorts) return `youtube.com/watch?v=${shorts[1]}`;
    }
    const keep = new URLSearchParams();
    for (const [k, v] of u.searchParams) if (!/^(utm_|ref|si|feature|fbclid|gclid|is_from_webapp|sender_device)/i.test(k)) keep.set(k, v);
    const q = keep.toString();
    return `${host}${path}${q ? `?${q}` : ""}`;
  } catch {
    return raw.trim().toLowerCase();
  }
}

export function clamp(x: number, lo: number, hi: number): number { return Math.min(hi, Math.max(lo, x)); }

export function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}
