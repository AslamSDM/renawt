/**
 * SCRAPE JITTER TEMPLATES
 *
 * Crawls jitter.video template + community pages, harvests every project id
 * referenced as `/file/?id=<ID>`, hits the public projects backend
 * (`https://projects-backend-prod.jitter.video/v2/project/<ID>`) which returns
 * either the JitterDoc inline or `{ source: "S3", url }` — we follow that S3
 * URL and store the JitterDoc to disk.
 *
 * Outputs:
 *   generate-server/data/jitter-templates/index.json   — section map + summaries
 *   generate-server/data/jitter-templates/raw/<id>.json — full JitterDoc per id
 *
 *   tsx generate-server/scripts/scrape-jitter-templates.ts
 *   tsx generate-server/scripts/scrape-jitter-templates.ts --sections websites,devices
 *   tsx generate-server/scripts/scrape-jitter-templates.ts --max 25         # cap ids per section
 *   tsx generate-server/scripts/scrape-jitter-templates.ts --skip-fetch     # only harvest ids
 *   tsx generate-server/scripts/scrape-jitter-templates.ts --refresh        # re-fetch existing raw json
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";

const TEMPLATE_SECTIONS = [
  "new",
  "jitter-ai",
  "websites",
  "devices",
  "social-media",
  "video-titles",
  "ads",
  "logos",
  "icons",
  "text",
  "buttons",
  "charts",
  "backgrounds",
  "ui-elements",
  "showreels",
];

const COMMUNITY_AUTHORS = [
  "anagram",
  "antinomy",
  "clint",
  "config",
  "fons-mans",
  "herve-studio",
  "luc-chaissac",
  "rico",
  "savee",
  "studio-size",
  "vendredi-society",
];

const BACKEND = "https://projects-backend-prod.jitter.video/v2/project";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface CliArgs {
  sections: string[] | null;
  authors: string[] | null;
  max: number;
  skipFetch: boolean;
  refresh: boolean;
  concurrency: number;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const out: CliArgs = {
    sections: null,
    authors: null,
    max: 0,
    skipFetch: false,
    refresh: false,
    concurrency: 6,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--sections") out.sections = (args[++i] || "").split(",").filter(Boolean);
    else if (a === "--authors") out.authors = (args[++i] || "").split(",").filter(Boolean);
    else if (a === "--max") out.max = parseInt(args[++i] || "0", 10) || 0;
    else if (a === "--concurrency") out.concurrency = parseInt(args[++i] || "6", 10) || 6;
    else if (a === "--skip-fetch") out.skipFetch = true;
    else if (a === "--refresh") out.refresh = true;
  }
  return out;
}

interface Browser {
  close(): Promise<void>;
  newPage(): Promise<any>;
}

async function launchBrowser(): Promise<Browser> {
  const puppeteer = await import("puppeteer");
  return puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  }) as unknown as Browser;
}

/**
 * Render a jitter listing page in puppeteer, scroll to the bottom repeatedly
 * until no new template ids appear, then return the harvested id set.
 */
async function harvestIdsFromPage(
  browser: Browser,
  url: string,
): Promise<string[]> {
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1440, height: 900 });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await new Promise((r) => setTimeout(r, 1500));

    const seen = new Set<string>();
    let stale = 0;
    for (let scroll = 0; scroll < 40 && stale < 3; scroll++) {
      const ids: string[] = await page.evaluate(() => {
        const out = new Set<string>();
        document
          .querySelectorAll<HTMLAnchorElement>('a[href*="/file/?id="]')
          .forEach((a) => {
            const m = a.href.match(/[?&]id=([A-Za-z0-9_-]+)/);
            if (m) out.add(m[1]);
          });
        return [...out];
      });
      const before = seen.size;
      ids.forEach((id) => seen.add(id));
      if (seen.size === before) stale++;
      else stale = 0;

      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.9));
      await new Promise((r) => setTimeout(r, 800));
    }
    return [...seen];
  } finally {
    await page.close();
  }
}

interface Resolved {
  id: string;
  jsonUrl: string;
  json: any | null;
}

async function resolveProjectJson(id: string): Promise<Resolved> {
  const meta = await fetch(`${BACKEND}/${id}`, {
    headers: { "user-agent": UA, accept: "application/json" },
  });
  if (!meta.ok) throw new Error(`backend ${meta.status} for ${id}`);
  const ct = meta.headers.get("content-type") ?? "";
  let jsonUrl = `${BACKEND}/${id}`;
  let payload: any;

  if (ct.includes("application/json")) {
    payload = await meta.json();
    if (
      payload &&
      typeof payload === "object" &&
      payload.source === "S3" &&
      typeof payload.url === "string"
    ) {
      jsonUrl = payload.url;
      const s3 = await fetch(payload.url, { redirect: "follow" });
      if (!s3.ok) throw new Error(`s3 ${s3.status} for ${id}`);
      payload = await s3.json();
    }
  } else {
    payload = await meta.text();
  }
  return { id, jsonUrl, json: payload };
}

interface ItemSummary {
  id: string;
  name: string;
  sections: string[];
  jsonUrl: string;
  fps: number;
  width: number;
  height: number;
  totalDurationMs: number;
  artboardCount: number;
  layerCount: number;
  opCount: number;
  palette: string[];
}

/** Two doc shapes seen in the wild:
 *  A) classic — { name, fps, conf: { artboards: [{ duration, layers:[], operations:[] }] } }
 *  B) graph   — { (project? wrapper), meta, nodes: [{ id, item:{type, ...}, position:{parentId} }] }
 */
function summarize(id: string, sections: string[], jsonUrl: string, doc: any): ItemSummary {
  const palette = new Set<string>();
  const innerDoc = doc?.project && typeof doc.project === "object" ? doc.project : doc;
  const conf = innerDoc?.conf ?? innerDoc;
  const artboards: any[] = Array.isArray(conf?.artboards) ? conf.artboards : [];

  if (artboards.length) {
    let layers = 0;
    let ops = 0;
    let totalMs = 0;
    const first = artboards[0] ?? {};
    function walkLayers(arr: any[]) {
      for (const l of arr || []) {
        if (!l || typeof l !== "object") continue;
        layers++;
        if (typeof l.fillColor === "string") palette.add(l.fillColor);
        if (typeof l.color === "string") palette.add(l.color);
        if (Array.isArray(l.layers)) walkLayers(l.layers);
      }
    }
    for (const a of artboards) {
      totalMs += Number(a?.duration) || 0;
      if (typeof a?.fillColor === "string") palette.add(a.fillColor);
      if (Array.isArray(a?.layers)) walkLayers(a.layers);
      if (Array.isArray(a?.operations)) ops += a.operations.length;
    }
    return {
      id,
      name: doc?.name || innerDoc?.name || id,
      sections,
      jsonUrl,
      fps: Number(doc?.fps || innerDoc?.fps) || 30,
      width: Number(first?.width) || 1920,
      height: Number(first?.height) || 1080,
      totalDurationMs: totalMs,
      artboardCount: artboards.length,
      layerCount: layers,
      opCount: ops,
      palette: [...palette].slice(0, 8),
    };
  }

  // Graph variant: { nodes: [{ id, item:{type,...}, position:{parentId} }] }
  const nodes: any[] = Array.isArray(innerDoc?.nodes) ? innerDoc.nodes : [];
  let artCount = 0;
  let layers = 0;
  let ops = 0;
  let totalMs = 0;
  let width = 1920;
  let height = 1080;
  const LAYER_TYPES = new Set([
    "text",
    "image",
    "rect",
    "ellipse",
    "polygon",
    "vector",
    "layerGrp",
    "group",
    "custom",
    "video",
  ]);
  for (const n of nodes) {
    const item = n?.item ?? {};
    const t = item?.type;
    if (!t) continue;
    if (t === "artboard") {
      artCount++;
      totalMs += Number(item.duration) || 0;
      if (typeof item.fillColor === "string") palette.add(item.fillColor);
      if (artCount === 1) {
        width = Number(item.width) || width;
        height = Number(item.height) || height;
      }
    } else if (t === "op" || t === "opGrp" || /Op$/.test(String(t))) {
      ops++;
    } else if (LAYER_TYPES.has(t)) {
      layers++;
      if (typeof item.fillColor === "string") palette.add(item.fillColor);
      if (typeof item.color === "string") palette.add(item.color);
    }
  }

  return {
    id,
    name: doc?.name || innerDoc?.name || id,
    sections,
    jsonUrl,
    fps: Number(doc?.fps || innerDoc?.fps) || 30,
    width,
    height,
    totalDurationMs: totalMs,
    artboardCount: artCount,
    layerCount: layers,
    opCount: ops,
    palette: [...palette].slice(0, 8),
  };
}

interface Index {
  updatedAt: string;
  sections: Record<string, string[]>;
  community: Record<string, string[]>;
  items: Record<string, ItemSummary>;
}

function emptyIndex(): Index {
  return {
    updatedAt: new Date().toISOString(),
    sections: {},
    community: {},
    items: {},
  };
}

function loadOrEmptyIndex(path: string): Index {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Index;
  } catch {
    return emptyIndex();
  }
}

async function pool<T>(items: T[], n: number, work: (t: T, i: number) => Promise<void>) {
  let cursor = 0;
  const workers: Promise<void>[] = [];
  for (let w = 0; w < n; w++) {
    workers.push(
      (async () => {
        while (cursor < items.length) {
          const i = cursor++;
          try {
            await work(items[i], i);
          } catch (err) {
            console.warn(
              `[scrape-jitter] item ${i} failed: ${err instanceof Error ? err.message : err}`,
            );
          }
        }
      })(),
    );
  }
  await Promise.all(workers);
}

async function main() {
  const args = parseArgs();
  const sections = args.sections ?? TEMPLATE_SECTIONS;
  const authors = args.authors ?? COMMUNITY_AUTHORS;

  const dataDir = resolve(__dirname, "..", "data", "jitter-templates");
  const rawDir = join(dataDir, "raw");
  if (!existsSync(rawDir)) mkdirSync(rawDir, { recursive: true });
  const indexPath = join(dataDir, "index.json");
  const idx = loadOrEmptyIndex(indexPath);

  const browser = await launchBrowser();
  const idToSections = new Map<string, Set<string>>();
  const idToAuthors = new Map<string, Set<string>>();

  function tag(map: Map<string, Set<string>>, id: string, key: string) {
    let bag = map.get(id);
    if (!bag) {
      bag = new Set();
      map.set(id, bag);
    }
    bag.add(key);
  }

  try {
    console.log(`[scrape-jitter] Crawling /templates/ root for master id list…`);
    const rootIds = await harvestIdsFromPage(browser, "https://jitter.video/templates/");
    console.log(`[scrape-jitter] root: ${rootIds.length} ids`);
    for (const id of rootIds) tag(idToSections, id, "all");

    for (const section of sections) {
      const url = `https://jitter.video/templates/${section}/`;
      console.log(`[scrape-jitter] section ${section}: ${url}`);
      const ids = await harvestIdsFromPage(browser, url);
      console.log(`[scrape-jitter]   → ${ids.length} ids`);
      idx.sections[section] = ids;
      for (const id of ids) tag(idToSections, id, section);
    }

    for (const author of authors) {
      const url = `https://jitter.video/community/${author}/`;
      console.log(`[scrape-jitter] community ${author}: ${url}`);
      const ids = await harvestIdsFromPage(browser, url);
      console.log(`[scrape-jitter]   → ${ids.length} ids`);
      idx.community[author] = ids;
      for (const id of ids) tag(idToAuthors, id, author);
    }
  } finally {
    await browser.close();
  }

  const allIds = [...idToSections.keys()];
  console.log(`[scrape-jitter] total unique ids harvested: ${allIds.length}`);

  if (args.skipFetch) {
    idx.updatedAt = new Date().toISOString();
    writeFileSync(indexPath, JSON.stringify(idx, null, 2));
    console.log(`[scrape-jitter] index written (skip-fetch): ${indexPath}`);
    return;
  }

  const targets = args.max > 0 ? allIds.slice(0, args.max) : allIds;
  console.log(`[scrape-jitter] fetching ${targets.length} project JSONs (concurrency=${args.concurrency})…`);

  let done = 0;
  await pool(targets, args.concurrency, async (id) => {
    const rawPath = join(rawDir, `${id}.json`);
    const cached = !args.refresh && existsSync(rawPath);
    let doc: any;
    let jsonUrl = `${BACKEND}/${id}`;

    if (cached) {
      doc = JSON.parse(readFileSync(rawPath, "utf8"));
      jsonUrl = idx.items[id]?.jsonUrl ?? jsonUrl;
    } else {
      const r = await resolveProjectJson(id);
      doc = r.json;
      jsonUrl = r.jsonUrl;
      writeFileSync(rawPath, JSON.stringify(doc));
    }

    const sectionsForId = [
      ...(idToSections.get(id) ?? []),
      ...[...(idToAuthors.get(id) ?? [])].map((a) => `community:${a}`),
    ].filter((s) => s !== "all");

    idx.items[id] = summarize(id, sectionsForId, jsonUrl, doc);
    done++;
    if (done % 20 === 0) console.log(`[scrape-jitter]   resolved ${done}/${targets.length}`);
  });

  idx.updatedAt = new Date().toISOString();
  writeFileSync(indexPath, JSON.stringify(idx, null, 2));
  console.log(`[scrape-jitter] done. ${Object.keys(idx.items).length} items in ${indexPath}`);
}

main().catch((err) => {
  console.error("[scrape-jitter] fatal:", err);
  process.exit(1);
});
