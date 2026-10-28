import type { QuotaCounter } from "./types";

/**
 * Daily quota budgeter. YouTube quotas reset at midnight America/Los_Angeles, so the
 * day key is computed in that zone. Usage is always tracked in memory; when a
 * persistent `QuotaCounter` is injected it is the source of truth (shared across
 * processes), and the in-memory tally is a fallback.
 */
export interface QuotaBucket { limit: number; /** keep this fraction in reserve (0..1) */ reserve?: number }

export class QuotaExceededError extends Error {
  constructor(public bucket: string, public used: number, public limit: number) {
    super(`Quota bucket "${bucket}" exhausted (${used}/${limit})`);
    this.name = "QuotaExceededError";
  }
}

export function pacificDayKey(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return parts; // YYYY-MM-DD
}

export class QuotaBudgeter {
  private memory = new Map<string, number>();
  constructor(
    public readonly namespace: string,
    private buckets: Record<string, QuotaBucket>,
    private opts: { counter?: QuotaCounter; now?: () => Date } = {},
  ) {}

  private key(bucket: string): string {
    const now = this.opts.now?.() ?? new Date();
    return `quota:${this.namespace}:${bucket}:${pacificDayKey(now)}`;
  }

  private effectiveLimit(bucket: string): number {
    const b = this.buckets[bucket];
    if (!b) throw new Error(`Unknown quota bucket ${bucket}`);
    return Math.floor(b.limit * (1 - (b.reserve ?? 0)));
  }

  async used(bucket: string): Promise<number> {
    const k = this.key(bucket);
    if (this.opts.counter) {
      try { return await this.opts.counter.get(k); } catch { /* fall back to memory */ }
    }
    return this.memory.get(k) ?? 0;
  }

  async remaining(bucket: string): Promise<number> { return Math.max(0, this.effectiveLimit(bucket) - (await this.used(bucket))); }

  /** Reserve `units`; returns false (and does not consume) if it would exceed the budget. */
  async tryConsume(bucket: string, units = 1): Promise<boolean> {
    const limit = this.effectiveLimit(bucket);
    const k = this.key(bucket);
    const before = await this.used(bucket);
    if (before + units > limit) return false;
    this.memory.set(k, (this.memory.get(k) ?? 0) + units);
    if (this.opts.counter) {
      try {
        const after = await this.opts.counter.incr(k, units);
        if (after > limit) {
          // lost a race with another process: roll back our claim
          await this.opts.counter.incr(k, -units).catch(() => undefined);
          this.memory.set(k, (this.memory.get(k) ?? units) - units);
          return false;
        }
      } catch { /* counter offline: memory tally still applies */ }
    }
    return true;
  }

  async consume(bucket: string, units = 1): Promise<void> {
    if (!(await this.tryConsume(bucket, units))) throw new QuotaExceededError(bucket, await this.used(bucket), this.effectiveLimit(bucket));
  }
}

/**
 * YouTube Data API v3: the shared 10k-unit pool (videos.list / channels.list = 1 unit)
 * and the separate search.list bucket (100 calls/day). 10% kept in reserve for
 * publishing/analytics callers sharing the key.
 */
export const YOUTUBE_BUCKETS: Record<string, QuotaBucket> = {
  default: { limit: 10_000, reserve: 0.1 },
  search: { limit: 100, reserve: 0.1 },
};

export function createYoutubeQuota(counter?: QuotaCounter, now?: () => Date): QuotaBudgeter {
  return new QuotaBudgeter("youtube", YOUTUBE_BUCKETS, { counter, now });
}

export const defaultYoutubeQuota = createYoutubeQuota();
