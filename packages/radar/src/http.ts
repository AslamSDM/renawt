export class HttpError extends Error {
  constructor(public status: number, public url: string, public body: string) {
    super(`HTTP ${status} for ${url.replace(/([?&](key|token)=)[^&]+/g, "$1***")}: ${body.slice(0, 200)}`);
    this.name = "HttpError";
  }
}

export interface RequestOpts { method?: string; headers?: Record<string, string>; body?: unknown; timeoutMs?: number; fetch?: typeof fetch }

export async function requestJson<T = unknown>(url: string, opts: RequestOpts = {}): Promise<T> {
  const f = opts.fetch ?? globalThis.fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20_000);
  try {
    const res = await f(url, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers: { accept: "application/json", ...(opts.body !== undefined && typeof opts.body !== "string" ? { "content-type": "application/json" } : {}), ...opts.headers },
      body: opts.body === undefined ? undefined : typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new HttpError(res.status, url, text);
    return (text ? JSON.parse(text) : {}) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function basicAuth(user: string, pass: string): string { return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`; }
