/** Tiny in-memory TTL cache (per process). Inject a shared one via SourceContext.cache. */
export class TtlCache {
  private store = new Map<string, { value: unknown; expiresAt: number }>();
  constructor(private nowFn: () => number = () => Date.now()) {}
  get<T>(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= this.nowFn()) { this.store.delete(key); return undefined; }
    return hit.value as T;
  }
  set<T>(key: string, value: T, ttlMs: number): T {
    this.store.set(key, { value, expiresAt: this.nowFn() + ttlMs });
    return value;
  }
  /** Memoise `fn`. Empty arrays are not cached (e.g. a run starved by quota should retry). */
  async wrap<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    const hit = this.get<T>(key);
    if (hit !== undefined) return hit;
    const value = await fn();
    if (Array.isArray(value) && value.length === 0) return value;
    return this.set(key, value, ttlMs);
  }
  clear(): void { this.store.clear(); }
}

export const defaultCache = new TtlCache();
export const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
