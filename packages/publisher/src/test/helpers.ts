import type { FetchLike } from "../types";

export interface Call { url: URL; method: string; headers: Headers; body: unknown }

/** Mock fetch: routes by "METHOD path" (path without query) → response factory. Records every call. */
export function mockFetch(routes: Record<string, (c: Call) => { status?: number; json?: unknown; headers?: Record<string, string>; body?: BodyInit }>) {
  const calls: Call[] = [];
  const fetch: FetchLike = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = (init.method ?? "GET").toUpperCase();
    let body: unknown = init.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { /* keep */ } }
    const call = { url, method, headers: new Headers(init.headers), body };
    calls.push(call);
    const key = `${method} ${url.pathname}`;
    const route = routes[key] ?? routes[`${method} *`];
    if (!route) return new Response(JSON.stringify({ message: `no route ${key}` }), { status: 404 });
    const r = route(call);
    return new Response(r.body ?? (r.json === undefined ? null : JSON.stringify(r.json)), { status: r.status ?? 200, headers: { "content-type": "application/json", ...r.headers } });
  };
  return { fetch, calls };
}

export const noSleep = { retries: 3, sleep: async () => {}, random: () => 0 };
