/**
 * Jitter screenshot capture — uses puppeteer to grab a viewport screenshot
 * of any URL and writes it to public/jitter/<id>.png so the renderer can
 * serve it via Remotion's staticFile().
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";

export interface JitterCaptureResult {
  /** Absolute path on disk (for vision analysis). */
  path: string;
  /** Public URL path the renderer will use (e.g. "/jitter/<id>.png"). */
  publicUrl: string;
}

/** Repo root — three levels up from this file. */
function repoRoot(): string {
  return resolve(__dirname, "../../..");
}

export async function captureForJitter(
  url: string,
  id: string,
  opts: { width?: number; height?: number; settleMs?: number } = {},
): Promise<JitterCaptureResult> {
  const width = opts.width ?? 1920;
  const height = opts.height ?? 1080;
  const settleMs = opts.settleMs ?? 2500;

  const publicDir = join(repoRoot(), "public", "jitter");
  if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });
  const filename = `${id}.png`;
  const absPath = join(publicDir, filename);

  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((r) => setTimeout(r, settleMs));
    const buf = await page.screenshot({ fullPage: false, type: "png" });
    writeFileSync(absPath, Buffer.from(buf));
  } finally {
    await browser.close();
  }

  return { path: absPath, publicUrl: `/jitter/${filename}` };
}
