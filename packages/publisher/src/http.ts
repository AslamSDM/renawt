import { fetchWithRetry, type RetryOptions } from "./retry";
import { PublisherError, type FetchLike } from "./types";

export interface HttpClientOptions {
  baseUrl: string;
  headers: Record<string, string>;
  fetch?: FetchLike;
  retry?: RetryOptions;
  provider: string;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | string[] | undefined>;
  json?: unknown;
  form?: FormData;
  idempotencyKey?: string;
  /** Return null instead of throwing on 404. */
  allow404?: boolean;
  headers?: Record<string, string>;
}

export function buildUrl(baseUrl: string, path: string, query?: RequestOptions["query"]): URL {
  const url = new URL(baseUrl.replace(/\/+$/, "") + (path.startsWith("/") ? path : `/${path}`));
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, x));
    else url.searchParams.set(k, String(v));
  }
  return url;
}

export function errorFromResponse(provider: string, status: number, body: unknown): PublisherError {
  const msg = typeof body === "object" && body !== null
    ? String((body as Record<string, unknown>).message ?? (body as Record<string, unknown>).error ?? JSON.stringify(body)).slice(0, 500)
    : String(body ?? "").slice(0, 500);
  const code = status === 401 || status === 403 ? "auth" : status === 404 ? "not_found" : status === 429 ? "rate_limited" : status === 400 || status === 409 || status === 422 ? "validation" : "provider";
  return new PublisherError(code, `${provider} ${status}: ${msg}`, { status, body, retryable: status === 429 || status >= 500 });
}

export function createHttp(opts: HttpClientOptions) {
  const f: FetchLike = opts.fetch ?? ((i, init) => fetch(i, init));
  async function request<T = unknown>(method: string, path: string, ro: RequestOptions = {}): Promise<T> {
    const url = buildUrl(opts.baseUrl, path, ro.query);
    const headers: Record<string, string> = { Accept: "application/json", ...opts.headers, ...ro.headers };
    let body: BodyInit | undefined;
    if (ro.form) body = ro.form;
    else if (ro.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(ro.json);
    }
    const res = await fetchWithRetry(f, url, { method, headers, body }, { ...opts.retry, idempotencyKey: ro.idempotencyKey });
    const text = await res.text();
    let parsed: unknown = text;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* keep text */ }
    if (res.status === 404 && ro.allow404) return null as T;
    if (!res.ok) throw errorFromResponse(opts.provider, res.status, parsed);
    return parsed as T;
  }
  return { request };
}
export type HttpClient = ReturnType<typeof createHttp>;
