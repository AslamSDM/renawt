import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
export function fixture<T = unknown>(name: string): T { return JSON.parse(readFileSync(join(here, "fixtures", name), "utf8")) as T; }

/** Fake fetch routing by URL substring → JSON body. Records calls. */
export function fakeFetch(routes: Array<[RegExp, unknown | ((url: string, init?: RequestInit) => unknown)]>) {
  const calls: string[] = [];
  const f = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push(url);
    for (const [re, body] of routes) {
      if (re.test(url)) {
        const payload = typeof body === "function" ? (body as (u: string, i?: RequestInit) => unknown)(url, init) : body;
        return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
      }
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  return { fetch: f, calls };
}
