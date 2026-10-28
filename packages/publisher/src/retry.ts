import { PublisherError, type FetchLike } from "./types";

export interface RetryOptions {
  /** Max retries after the first attempt. Default 4. */
  retries?: number;
  /** Base delay in ms. Default 500. */
  baseMs?: number;
  /** Delay cap in ms. Default 20_000. */
  maxMs?: number;
  /** Injected for tests. */
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Full-jitter exponential backoff: random(0, min(maxMs, baseMs * 2^attempt)). */
export function backoffDelay(attempt: number, opts: RetryOptions = {}): number {
  const base = opts.baseMs ?? 500;
  const max = opts.maxMs ?? 20_000;
  const rand = opts.random ?? Math.random;
  const ceiling = Math.min(max, base * 2 ** attempt);
  return Math.floor(rand() * ceiling);
}

export function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 408 || (status >= 500 && status <= 599);
}

/** Parse `Retry-After` (seconds or HTTP date) → ms, or undefined. */
export function retryAfterMs(h: string | null | undefined, now = Date.now()): number | undefined {
  if (!h) return undefined;
  const secs = Number(h);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const t = Date.parse(h);
  return Number.isFinite(t) ? Math.max(0, t - now) : undefined;
}

/** Retry an async fn while it throws a retryable PublisherError (or any error when `retryOn` says so). */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions & { retryOn?: (e: unknown) => boolean } = {}): Promise<T> {
  const retries = opts.retries ?? 4;
  const sleep = opts.sleep ?? defaultSleep;
  const retryOn = opts.retryOn ?? ((e) => e instanceof PublisherError && e.retryable);
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (e) {
      if (attempt >= retries || !retryOn(e)) throw e;
      await sleep(backoffDelay(attempt, opts));
    }
  }
}

export interface FetchRetryOptions extends RetryOptions {
  /** Sent as `Idempotency-Key`; also makes 5xx/network retries safe for POST/PATCH. */
  idempotencyKey?: string;
  /** Retry non-idempotent requests on 5xx/network even without an idempotency key. Default false. */
  retryUnsafe?: boolean;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "PUT", "DELETE"]);

/**
 * fetch with backoff for 429/408/5xx and network errors.
 * - 429 is always retried (the request was not processed).
 * - 5xx/network on POST/PATCH only when an idempotency key is passed (or retryUnsafe) to avoid double posts.
 * - honours Retry-After (capped by maxMs).
 * Returns the final Response (possibly non-ok); throws PublisherError("network") if every attempt failed to connect.
 */
export async function fetchWithRetry(fetchImpl: FetchLike, url: string | URL, init: RequestInit = {}, opts: FetchRetryOptions = {}): Promise<Response> {
  const retries = opts.retries ?? 4;
  const sleep = opts.sleep ?? defaultSleep;
  const method = (init.method ?? "GET").toUpperCase();
  const safe = SAFE_METHODS.has(method) || !!opts.idempotencyKey || !!opts.retryUnsafe;
  const headers = new Headers(init.headers);
  if (opts.idempotencyKey && !headers.has("Idempotency-Key")) headers.set("Idempotency-Key", opts.idempotencyKey);

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetchImpl(url, { ...init, headers });
    } catch (e) {
      if (attempt >= retries || !safe) throw new PublisherError("network", `network error: ${(e as Error).message}`, { retryable: true });
      await sleep(backoffDelay(attempt, opts));
      continue;
    }
    const retryable = res.status === 429 || (safe && isRetryableStatus(res.status));
    if (!retryable || attempt >= retries) return res;
    const ra = retryAfterMs(res.headers.get("retry-after"));
    const delay = ra !== undefined ? Math.min(ra, opts.maxMs ?? 20_000) : backoffDelay(attempt, opts);
    try { await res.body?.cancel(); } catch { /* ignore */ }
    await sleep(delay);
  }
}
