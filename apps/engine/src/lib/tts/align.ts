/**
 * Snap recognised (ASR / TTS-alignment) word timings onto the known script so captions show the
 * script's exact words (no ASR typos, numbers stay "2026" not "twenty twenty six").
 *
 * Weighted LCS over normalised tokens with fuzzy equality picks anchor pairs; script words between
 * anchors get the span of the unmatched recognised words in that gap (or the silence between the
 * anchors), split by word length. Output is monotone and has exactly one entry per script token.
 */
import { estimateWordTimings, type Word } from "../captions.js";

/** Remove inline Fish S2 cue tags like `[pause]` / `[whispers sweetly]`: they are never spoken. */
export function stripCueTags(text: string): string {
  return text.replace(/\[[^\]\n]{0,40}\]/g, " ").replace(/\s+/g, " ").trim();
}

export function normToken(t: string): string {
  return t.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]/gu, "");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** 0..1 similarity; 0 when below the fuzzy threshold. */
export function tokenSim(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const r = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  return r >= 0.7 ? r : 0;
}

/** Spread `tokens` across [s, e] weighted by length (pure function, monotone). */
function spread(tokens: string[], s: number, e: number): Word[] {
  if (!tokens.length) return [];
  const span = Math.max(0, e - s);
  const weights = tokens.map((t) => 1 + normToken(t).length / 5);
  const sum = weights.reduce((a, b) => a + b, 0);
  let t = s;
  return tokens.map((w, i) => {
    const d = (weights[i] / sum) * span;
    const word = { w, s: Math.round(t), e: Math.round(t + d) };
    t += d;
    return word;
  });
}

/**
 * @param script     the exact narration text (display words come from here)
 * @param recognised word timings (ms) from TTS alignment or ASR
 * @param totalMs    audio duration, used to bound trailing unmatched words
 */
export function snapToScript(script: string, recognised: Word[], totalMs?: number): Word[] {
  const tokens = stripCueTags(script).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const rec = recognised.filter((w) => normToken(w.w));
  if (!rec.length) return estimateWordTimings(tokens.join(" "), totalMs);

  const A = tokens.map(normToken);
  const B = rec.map((w) => normToken(w.w));
  const n = A.length;
  const m = B.length;
  // Weighted LCS DP (n,m ≈ a few hundred → fine).
  const dp: Float64Array[] = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const sim = tokenSim(A[i], B[j]);
      dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1], sim ? sim + dp[i + 1][j + 1] : 0);
    }
  }
  const pairs: Array<[number, number]> = [];
  for (let i = 0, j = 0; i < n && j < m; ) {
    const sim = tokenSim(A[i], B[j]);
    if (sim && Math.abs(dp[i][j] - (sim + dp[i + 1][j + 1])) < 1e-9) { pairs.push([i, j]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }

  const out: Word[] = new Array(n);
  const end = totalMs ?? rec[m - 1].e;
  // Walk anchor-to-anchor, filling the gaps.
  const anchors = [[-1, -1] as [number, number], ...pairs, [n, m] as [number, number]];
  for (let k = 0; k < anchors.length - 1; k++) {
    const [ai, aj] = anchors[k];
    const [bi, bj] = anchors[k + 1];
    if (ai >= 0) out[ai] = { w: tokens[ai], s: rec[aj].s, e: rec[aj].e };
    const gapTokens = tokens.slice(ai + 1, bi);
    if (!gapTokens.length) continue;
    const gapRec = rec.slice(aj + 1, bj);
    const prevEnd = ai >= 0 ? rec[aj].e : 0;
    const nextStart = bi < n ? rec[bj].s : Math.max(prevEnd, end);
    let s: number;
    let e: number;
    if (gapRec.length) { s = gapRec[0].s; e = gapRec[gapRec.length - 1].e; }
    else if (ai < 0) { s = Math.max(0, nextStart - 320 * gapTokens.length); e = nextStart; }
    else if (bi >= n) { s = prevEnd; e = Math.max(nextStart, prevEnd + 320 * gapTokens.length); if (totalMs) e = Math.min(e, Math.max(prevEnd, totalMs)); }
    else { s = prevEnd; e = nextStart; }
    spread(gapTokens, s, e).forEach((w, idx) => { out[ai + 1 + idx] = w; });
  }

  // Enforce monotonicity (fuzzy anchors can cross a few ms after rounding).
  let last = 0;
  for (const w of out) {
    w.s = Math.max(w.s, last);
    w.e = Math.max(w.e, w.s);
    last = w.e;
  }
  return out;
}
