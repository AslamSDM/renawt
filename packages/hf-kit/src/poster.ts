import { existsSync } from "node:fs";
import type { VisualSkin } from "@remawt/shared";
import { Anim } from "./anim";
import { BLOCKS } from "./blocks/index";
import { contentBox, fontLinks, motionPreset, sceneBaseCss, typeScale } from "./skin/index";

const CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

export function chromePath(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  return CHROME_PATHS.find((p) => existsSync(p));
}

/**
 * Single-frame poster HTML: the skin + a kinetic-headline at its end state (block CSS is the
 * end state; the timeline only sets entrance from-states, so it is simply not run here).
 */
export function posterHtml(opts: { skin: VisualSkin; headline: string; sub?: string; niche: string; width?: number; height?: number }): string {
  const width = opts.width ?? 1080, height = opts.height ?? 1920;
  const sid = "poster";
  const motion = motionPreset(opts.skin);
  const out = BLOCKS["kinetic-headline"]({
    sid, index: 0, isFirst: true, isLast: true, headline: opts.headline, body: opts.sub, durationS: 3,
    data: { kicker: opts.niche, emphasis: [], align: "center" }, width, height, skin: opts.skin, motion,
    type: typeScale(width), box: contentBox(width, height), assets: [], anim: new Anim(motion, { instant: true }),
  });
  return `<!doctype html><html><head><meta charset="utf-8">${fontLinks(opts.skin)}
<style>html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:${opts.skin.palette.bg}}
${sceneBaseCss(sid, opts.skin, width, height)}
${out.css}
#root{position:relative;width:${width}px;height:${height}px}</style></head>
<body><div id="root"><div id="${sid}-bg"></div><div id="${sid}-stage">${out.html}</div></div></body></html>`;
}

/** Render a 1080×1920 PNG poster with puppeteer (system Chrome via PUPPETEER_EXECUTABLE_PATH or a known path). */
export async function renderPoster(opts: { skin: VisualSkin; headline: string; sub?: string; niche: string }): Promise<Buffer> {
  const puppeteer = (await import("puppeteer")).default;
  const browser = await puppeteer.launch({ executablePath: chromePath(), headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
    await page.setContent(posterHtml(opts), { waitUntil: "load", timeout: 30_000 });
    await page.waitForNetworkIdle({ idleTime: 300, timeout: 15_000 }).catch(() => undefined);
    await page.evaluate(async () => { await (document as Document & { fonts: FontFaceSet }).fonts.ready; });
    const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 1080, height: 1920 } });
    return Buffer.from(png);
  } finally {
    await browser.close();
  }
}
