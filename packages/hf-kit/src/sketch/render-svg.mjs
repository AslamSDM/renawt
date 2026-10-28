#!/usr/bin/env node
// Excalidraw element lists → static SVG strings, rendered by Excalidraw's own `exportToSvg`
// (@excalidraw/utils) in headless Chrome. Run by `excalidraw.ts` as a child process:
//
//   stdin  {"executablePath": "...", "fontDataUrl": "data:font/woff2;base64,...", "jobs": [{"key","prefix","width","height","elements":[...]}]}
//   stdout {"results": {"<key>": {"svg": "<svg ...>", "els": [{"strokes": [{"id","len"}], "fills": ["id"], "text": "id"|null}]}}}
//
// Same serving pattern as contentgen/yt/tools/excalidraw/render.mjs (local route to the utils dist).
// Each job gets an invisible frame rectangle at (0,0,width,height) so the SVG maps 1:1 onto the
// video frame; that frame's <g> is removed afterwards. Stroke paths are given ids and their exact
// length (getTotalLength) plus a stroke-dasharray/offset that hides them; the GSAP timeline in
// the scene draws them on. Nothing here is random: roughjs is seeded from each element's seed.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const utilsDir = path.dirname(require.resolve('@excalidraw/utils')); // …/dist/prod

const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const puppeteer = (await import('puppeteer')).default;
const browser = await puppeteer.launch({
  executablePath: input.executablePath || undefined,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.host !== 'local') return req.abort();
    const file = path.join(utilsDir, u.pathname);
    if (u.pathname !== '/' && file.startsWith(utilsDir) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      return req.respond({ status: 200, contentType: file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream', body: fs.readFileSync(file) });
    }
    return req.respond({
      status: 200,
      contentType: 'text/html',
      body: `<!doctype html><html><head><style>@font-face{font-family:"Excalifont";src:url(${input.fontDataUrl}) format("woff2");}</style></head><body style="margin:0"><div id="stage"></div></body></html>`,
    });
  });
  await page.goto('http://local/', { waitUntil: 'load' });

  const results = await page.evaluate(async (jobs) => {
    await document.fonts.load('40px Excalifont');
    const U = await import('http://local/index.js');
    const out = {};
    for (const job of jobs) {
      const frame = {
        id: '__frame', type: 'rectangle', x: 0, y: 0, width: job.width, height: job.height, angle: 0,
        strokeColor: 'transparent', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 1, strokeStyle: 'solid',
        roughness: 0, opacity: 100, groupIds: [], frameId: null, roundness: null, seed: 1, version: 1, versionNonce: 1,
        isDeleted: false, boundElements: [], updated: 1, link: null, locked: false,
      };
      const elements = [frame, ...job.elements];
      const svg = await U.exportToSvg({
        data: { elements, appState: { exportBackground: false, viewBackgroundColor: 'transparent' }, files: null },
        config: { padding: 0, skipInliningFonts: true },
      });
      document.getElementById('stage').replaceChildren(svg);
      const groups = [...svg.children].filter((n) => n.tagName === 'g');
      if (groups.length !== elements.length) throw new Error(`exportToSvg produced ${groups.length} groups for ${elements.length} elements`);
      groups[0].remove();
      svg.querySelectorAll('metadata').forEach((n) => n.remove());
      const els = groups.slice(1).map((g, i) => {
        const el = job.elements[i];
        const gid = `${job.prefix}-e${i}`;
        g.setAttribute('id', gid);
        const strokes = [], fills = [];
        let j = 0;
        g.querySelectorAll('path').forEach((p) => {
          const id = `${gid}p${j++}`;
          p.setAttribute('id', id);
          const fill = p.getAttribute('fill');
          const stroke = p.getAttribute('stroke');
          if (fill && fill !== 'none' && (!stroke || stroke === 'none')) { fills.push(id); return; }
          if (fill && fill !== 'none') { fills.push(id); return; }
          const L = p.getTotalLength();
          if (!(L > 0)) return;
          const D = Math.ceil(L + 4);
          p.setAttribute('stroke-dasharray', `${D} ${D}`);
          p.setAttribute('stroke-dashoffset', String(D));
          strokes.push({ id, len: Math.round(L * 10) / 10, dash: D });
        });
        return { type: el.type, strokes, fills, text: el.type === 'text' ? gid : null };
      });
      svg.setAttribute('width', String(job.width));
      svg.setAttribute('height', String(job.height));
      svg.setAttribute('viewBox', `0 0 ${job.width} ${job.height}`);
      svg.setAttribute('overflow', 'visible');
      svg.removeAttribute('style');
      out[job.key] = { svg: svg.outerHTML, els };
    }
    return out;
  }, input.jobs);
  if (errors.length) process.stderr.write(errors.join('\n') + '\n');
  process.stdout.write(JSON.stringify({ results }));
} finally {
  await browser.close();
}
