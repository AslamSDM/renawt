/**
 * Word timings and caption chunking. Times are milliseconds throughout (VoiceTrack.words[].s/e are ms).
 */

export interface Word { w: string; s: number; e: number }
export interface CaptionChunk { text: string; s: number; e: number; words: Word[] }

/** Aggregate ElevenLabs character alignment (seconds) into words (ms). Whitespace splits words. */
export function wordsFromCharAlignment(chars: string[], startsSec: number[], endsSec: number[]): Word[] {
  const words: Word[] = [];
  let cur = "";
  let s = 0;
  let e = 0;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (/\s/.test(c)) {
      if (cur.trim()) words.push({ w: cur.trim(), s: Math.round(s * 1000), e: Math.round(e * 1000) });
      cur = "";
      continue;
    }
    if (cur === "") s = startsSec[i] ?? e;
    cur += c;
    e = endsSec[i] ?? s;
  }
  if (cur.trim()) words.push({ w: cur.trim(), s: Math.round(s * 1000), e: Math.round(e * 1000) });
  return words;
}

/** Estimate word timings evenly when a provider gives none (~2.6 words/s, weighted by length). */
export function estimateWordTimings(text: string, totalMs?: number): Word[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const weights = tokens.map((t) => 1 + t.length / 6 + (/[.!?]$/.test(t) ? 0.8 : /[,;:]$/.test(t) ? 0.35 : 0));
  const sum = weights.reduce((a, b) => a + b, 0);
  const total = totalMs ?? Math.round((tokens.length / 2.6) * 1000);
  let t = 0;
  return tokens.map((w, i) => {
    const d = (weights[i] / sum) * total;
    const word = { w, s: Math.round(t), e: Math.round(t + d * 0.92) };
    t += d;
    return word;
  });
}

export interface ChunkOptions { maxWords?: number; maxChars?: number; maxGapMs?: number; maxDurMs?: number }

/**
 * Group words into on-screen caption lines. Breaks on: sentence-ending punctuation, word/char limits,
 * pauses longer than maxGapMs, or chunk duration over maxDurMs. Commas break only when the chunk has ≥2 words.
 */
export function chunkCaptions(words: Word[], opts: ChunkOptions = {}): CaptionChunk[] {
  const maxWords = opts.maxWords ?? 4;
  const maxChars = opts.maxChars ?? 22;
  const maxGapMs = opts.maxGapMs ?? 350;
  const maxDurMs = opts.maxDurMs ?? 1800;
  const out: CaptionChunk[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (!cur.length) return;
    out.push({ text: cur.map((w) => w.w).join(" "), s: cur[0].s, e: cur[cur.length - 1].e, words: cur });
    cur = [];
  };
  for (const w of words) {
    if (cur.length) {
      const prev = cur[cur.length - 1];
      const chars = cur.map((x) => x.w).join(" ").length + 1 + w.w.length;
      if (w.s - prev.e > maxGapMs || cur.length >= maxWords || chars > maxChars || w.e - cur[0].s > maxDurMs) flush();
    }
    cur.push(w);
    if (/[.!?…]["')\]]?$/.test(w.w) || (/[,;:—]$/.test(w.w) && cur.length >= 2)) flush();
  }
  flush();
  return out;
}

/** Index of the word boundary (word end) nearest to `ms`. Returns the boundary time in ms. */
export function nearestWordBoundary(words: Word[], ms: number): number {
  if (!words.length) return ms;
  let best = words[0].e;
  for (const w of words) {
    for (const t of [w.s, w.e]) if (Math.abs(t - ms) < Math.abs(best - ms)) best = t;
  }
  return best;
}
