import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { excalifontDataUrl } from "../skin/sketch";
import { hash } from "../util";
import type { ExEl } from "./board";

/**
 * Excalidraw element lists → static SVG via Excalidraw's own `exportToSvg` (@excalidraw/utils),
 * run in headless Chrome by `render-svg.mjs` in a child process. Synchronous (execFileSync) so
 * composeVideo stays synchronous; jobs are batched (one Chrome per batch) and cached in memory and
 * on disk under os.tmpdir() keyed by a hash of the element list, so recomposing is instant.
 */
export interface RenderedEl { type: string; strokes: Array<{ id: string; len: number; dash: number }>; fills: string[]; text: string | null }
export interface RenderedSvg { svg: string; els: RenderedEl[] }
export interface SvgJob { prefix: string; width: number; height: number; elements: ExEl[] }

const CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];
/** Same lookup as poster.ts (kept local to avoid an import cycle through blocks/index). */
function chromePath(): string | undefined {
  return process.env.PUPPETEER_EXECUTABLE_PATH || CHROME_PATHS.find((p) => existsSync(p));
}

const RENDERER_VERSION = "excalidraw-utils@0.1.5/r1";
const SCRIPT = fileURLToPath(new URL("./render-svg.mjs", import.meta.url));
const memo = new Map<string, RenderedSvg>();
const CACHE_DIR = join(tmpdir(), "remawt-sketch-cache");

export function jobKey(job: SvgJob): string {
  return hash(`${RENDERER_VERSION}|${job.prefix}|${job.width}x${job.height}|${JSON.stringify(job.elements)}`, 24);
}

function fromDisk(key: string): RenderedSvg | null {
  const f = join(CACHE_DIR, `${key}.json`);
  if (!existsSync(f)) return null;
  try { return JSON.parse(readFileSync(f, "utf8")) as RenderedSvg; } catch { return null; }
}

/** Render every job not already cached, in one Chrome. Returns results in job order. */
export function renderSvgs(jobs: SvgJob[]): RenderedSvg[] {
  const keys = jobs.map(jobKey);
  const missing: Array<{ key: string; job: SvgJob }> = [];
  keys.forEach((key, i) => {
    if (memo.has(key)) return;
    const hit = fromDisk(key);
    if (hit) { memo.set(key, hit); return; }
    if (!missing.some((m) => m.key === key)) missing.push({ key, job: jobs[i] });
  });
  if (missing.length) {
    const input = JSON.stringify({
      executablePath: chromePath(),
      fontDataUrl: excalifontDataUrl(),
      jobs: missing.map(({ key, job }) => ({ key, ...job })),
    });
    let out: Buffer;
    try {
      out = execFileSync(process.execPath, [SCRIPT], { input, maxBuffer: 1 << 29, timeout: 180_000, stdio: ["pipe", "pipe", "pipe"] });
    } catch (e) {
      const err = e as { stderr?: Buffer; message: string };
      throw new Error(`hf-kit sketch: Excalidraw render failed: ${(err.stderr?.toString() || err.message).trim().split("\n").slice(-6).join(" | ")}`);
    }
    const { results } = JSON.parse(out.toString("utf8")) as { results: Record<string, RenderedSvg> };
    mkdirSync(CACHE_DIR, { recursive: true });
    for (const { key } of missing) {
      const r = results[key];
      if (!r) throw new Error(`hf-kit sketch: renderer returned no result for ${key}`);
      memo.set(key, r);
      try { writeFileSync(join(CACHE_DIR, `${key}.json`), JSON.stringify(r)); } catch { /* cache is best effort */ }
    }
  }
  return keys.map((k) => memo.get(k)!);
}
