/**
 * Jitter screenshot capture — delegates to the scraper microservice.
 * The PNG is captured by puppeteer in the scraper container and uploaded to R2;
 * we get back the public URL so Remotion can fetch it without disk I/O.
 */

import { captureJitter } from "../scraper/scraperClient";

export interface JitterCaptureResult {
  /** R2 public URL (e.g. https://pub-…/jitter/<id>.png). */
  url: string;
  /** R2 key (e.g. jitter/<id>.png). */
  key: string;
  /** Same as `url` — kept for backwards compatibility with old callers. */
  publicUrl: string;
  /** Empty string — file no longer exists locally. Kept for back-compat. */
  path: string;
}

export async function captureForJitter(
  url: string,
  id: string,
  opts: { width?: number; height?: number; settleMs?: number } = {},
): Promise<JitterCaptureResult> {
  const r = await captureJitter({
    url,
    id,
    width: opts.width,
    height: opts.height,
    settleMs: opts.settleMs,
  });
  return { url: r.url, key: r.key, publicUrl: r.url, path: "" };
}
