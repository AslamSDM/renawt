import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Stable JSON stringify (sorted keys) so hashes don't change with key order. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
}

export function hashOf(...parts: unknown[]): string {
  return createHash("sha256").update(parts.map(stableStringify).join("|")).digest("hex").slice(0, 16);
}

/** Idempotency key for a paid external call: (videoId, step, contentHash). */
export function idemKey(videoId: string, step: string, content: unknown): string {
  return `${videoId}:${step}:${hashOf(content)}`;
}

export function signToken(secret: string, payload: string): string {
  return createHmac("sha256", secret || "dev").update(payload).digest("hex").slice(0, 32);
}

export function verifyToken(secret: string, payload: string, token: string | undefined): boolean {
  if (!token) return false;
  const want = Buffer.from(signToken(secret, payload));
  const got = Buffer.from(token);
  return want.length === got.length && timingSafeEqual(want, got);
}
