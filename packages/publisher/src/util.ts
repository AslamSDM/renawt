/** FNV-1a 32-bit hash → unsigned int. */
export function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function hashHex(input: string, len = 12): string {
  // two rounds for a longer, still deterministic id
  const a = fnv1a(input).toString(16).padStart(8, "0");
  const b = fnv1a(`${input}::${a}`).toString(16).padStart(8, "0");
  return (a + b).slice(0, len);
}

/** Deterministic PRNG in [0,1). */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function b64urlEncode(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}
export function b64urlDecode(s: string): string {
  return Buffer.from(s, "base64url").toString("utf8");
}

export function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined;
}

/** First numeric value among keys of an object. */
export function pick(obj: Record<string, unknown> | undefined, ...keys: string[]): number | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = num(obj[k]);
    if (v !== undefined) return v;
  }
  return undefined;
}
