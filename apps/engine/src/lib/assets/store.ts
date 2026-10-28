/** Shared R2 persistence + idempotency for asset providers: key = assets/{videoId}/{sceneId}-{hash}.{ext}. */
import { existingObject, putObject, fetchBuffer } from "../r2.js";
import { hashOf } from "../hash.js";
import type { AssetRequest } from "./types.js";

export function assetKey(req: AssetRequest, provider: string, ext: string): string {
  return `assets/${req.videoId}/${req.sceneId}-${provider}-${hashOf(req.kind, req.prompt, req.query, req.style)}.${ext}`;
}

export async function cachedAsset(req: AssetRequest, provider: string, ext: string) {
  return existingObject(assetKey(req, provider, ext));
}

export async function storeAsset(req: AssetRequest, provider: string, ext: string, body: Buffer, contentType: string, meta: Record<string, string>): Promise<string> {
  const clean = Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, encodeURIComponent(v).slice(0, 512)]));
  return putObject(assetKey(req, provider, ext), body, contentType, clean);
}

export async function downloadAndStore(req: AssetRequest, provider: string, url: string, meta: Record<string, string>, headers?: Record<string, string>): Promise<string> {
  const buf = await fetchBuffer(url, headers ? { headers } : undefined);
  const ext = (url.split("?")[0].match(/\.(jpe?g|png|webp|mp4|svg)$/i)?.[1] ?? (req.kind === "stock-video" ? "mp4" : "jpg")).toLowerCase();
  const ct = ext === "mp4" ? "video/mp4" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "svg" ? "image/svg+xml" : "image/jpeg";
  return storeAsset(req, provider, ext, buf, ct, meta);
}

export function decodeMeta(m: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, safeDecode(v)]));
}
function safeDecode(v: string): string {
  try { return decodeURIComponent(v); } catch { return v; }
}
