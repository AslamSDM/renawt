import { topicKey } from "./text";

/**
 * Per-channel Thompson sampling over arms = format × topic cluster.
 * Reward is fractional Beta-Bernoulli: r = outlier / (outlier + 1), so a video at the
 * channel median (outlier 1) is a coin flip (0.5), 3× median ≈ 0.75, 0.2× ≈ 0.17.
 * Arms are plain data so the engine can persist them anywhere (Channel.kit side-car,
 * Redis) or rebuild them from MetricSnapshots each run.
 */
export interface Arm { format: string; topic: string; alpha: number; beta: number; pulls: number }
export interface Outcome { format: string; topic: string; outlierScore: number }
export type Rng = () => number;

export const ANY_TOPIC = "*";
export function armKey(format: string, topic: string): string { return `${format}::${topic === ANY_TOPIC ? ANY_TOPIC : topicKey(topic)}`; }

export function rewardFromOutlier(outlier: number): number {
  if (!Number.isFinite(outlier) || outlier <= 0) return 0;
  return outlier / (outlier + 1);
}

/** Returns a new arm list with outcomes applied (prior Beta(1,1) for unseen arms). */
export function updateFromMetrics(arms: Arm[], outcomes: Outcome[], opts: { decay?: number } = {}): Arm[] {
  const map = new Map(arms.map((a) => [armKey(a.format, a.topic), { ...a }]));
  if (opts.decay && opts.decay < 1) for (const a of map.values()) { a.alpha = 1 + (a.alpha - 1) * opts.decay; a.beta = 1 + (a.beta - 1) * opts.decay; }
  for (const o of outcomes) {
    const k = armKey(o.format, o.topic);
    const a = map.get(k) ?? { format: o.format, topic: o.topic === ANY_TOPIC ? ANY_TOPIC : topicKey(o.topic), alpha: 1, beta: 1, pulls: 0 };
    const r = rewardFromOutlier(o.outlierScore);
    a.alpha += r; a.beta += 1 - r; a.pulls += 1;
    map.set(k, a);
  }
  return [...map.values()];
}

/** Add Beta(1,1) arms for candidates not yet present (e.g. this week's card formats × topics). */
export function ensureArms(arms: Arm[], candidates: Array<{ format: string; topic?: string }>): Arm[] {
  const map = new Map(arms.map((a) => [armKey(a.format, a.topic), a]));
  for (const c of candidates) {
    const topic = c.topic ?? ANY_TOPIC;
    const k = armKey(c.format, topic);
    if (!map.has(k)) map.set(k, { format: c.format, topic: topic === ANY_TOPIC ? ANY_TOPIC : topicKey(topic), alpha: 1, beta: 1, pulls: 0 });
  }
  return [...map.values()];
}

/** Deterministic PRNG for tests/replays. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rng: Rng): number {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Marsaglia–Tsang gamma sampler (shape k > 0, scale 1). */
export function sampleGamma(k: number, rng: Rng): number {
  if (k < 1) return sampleGamma(k + 1, rng) * Math.pow(rng() || 1e-12, 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do { x = normal(rng); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

export function sampleBeta(alpha: number, beta: number, rng: Rng): number {
  const x = sampleGamma(alpha, rng), y = sampleGamma(beta, rng);
  return x / (x + y);
}

export interface MixPick { format: string; topic: string }
export interface Mix { picks: MixPick[]; formats: Record<string, number> }

/**
 * Draw `count` Thompson samples (with replacement) → recommended format mix.
 * `maxShare` caps any one format so a hot arm can't take the whole batch (diversity
 * guardrail against detectable template clusters).
 */
export function sampleMix(arms: Arm[], count: number, opts: { rng?: Rng; maxShare?: number } = {}): Mix {
  const rng = opts.rng ?? Math.random;
  const cap = Math.max(1, Math.ceil(count * (opts.maxShare ?? 0.5)));
  const formats: Record<string, number> = {};
  const picks: MixPick[] = [];
  if (arms.length === 0) return { picks, formats };
  for (let i = 0; i < count; i++) {
    let best: Arm | undefined; let bestS = -1;
    for (const a of arms) {
      if ((formats[a.format] ?? 0) >= cap && arms.some((b) => (formats[b.format] ?? 0) < cap)) continue;
      const s = sampleBeta(a.alpha, a.beta, rng);
      if (s > bestS) { bestS = s; best = a; }
    }
    if (!best) break;
    formats[best.format] = (formats[best.format] ?? 0) + 1;
    picks.push({ format: best.format, topic: best.topic });
  }
  return { picks, formats };
}

/** Posterior mean per arm, for dashboards. */
export function armMeans(arms: Arm[]): Array<Arm & { mean: number }> {
  return arms.map((a) => ({ ...a, mean: a.alpha / (a.alpha + a.beta) })).sort((x, y) => y.mean - x.mean);
}
