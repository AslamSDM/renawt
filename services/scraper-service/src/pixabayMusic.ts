/**
 * Pixabay music scraper — Pixabay's public API does not expose audio.
 * This module scrapes pixabay.com/music search + track-detail pages with
 * puppeteer and extracts the JSON-LD AudioObject (which contains the
 * direct mp3 download URL).
 */

import puppeteer, { type Browser, type Page } from "puppeteer";

export interface PixabayTrack {
  title: string;
  artist: string;
  durationSec: number;
  /** Direct mp3 download URL from JSON-LD `contentUrl`. */
  mp3Url: string;
  thumbnailUrl?: string;
  tags: string[];
  /** Slug-based unique id from the detail URL. */
  pixabayId: string;
}

interface SearchHit {
  title: string;
  artist: string;
  durationText: string;
  detailUrl: string;
  tags: string[];
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function configurePage(page: Page) {
  await page.setViewport({ width: 1280, height: 1800 });
  await page.setUserAgent(UA);
}

function parseDurationText(text: string): number {
  // "2:02" → 122
  const m = text.trim().match(/^(\d+):(\d+)$/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function parseIsoDuration(iso: string): number {
  // "PT2M2.044062999999994S" → 122
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/);
  if (!m) return 0;
  const h = Number(m[1] || 0);
  const min = Number(m[2] || 0);
  const sec = Math.floor(Number(m[3] || 0));
  return h * 3600 + min * 60 + sec;
}

function pixabayIdFromUrl(url: string): string {
  const m = url.match(/-(\d+)\/?$/);
  return m ? m[1] : url.replace(/[^a-z0-9]/gi, "-").slice(-40);
}

async function scrapeSearchPage(
  browser: Browser,
  query: string,
  limit: number,
): Promise<SearchHit[]> {
  const page = await browser.newPage();
  try {
    await configurePage(page);
    const url = `https://pixabay.com/music/search/${encodeURIComponent(query)}/`;
    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
    await page.waitForSelector(".audioRow--et3ac", { timeout: 30000 });

    // Scroll to lazy-load more rows
    await page.evaluate(async (max) => {
      let last = 0;
      for (let i = 0; i < 6; i++) {
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise((r) => setTimeout(r, 800));
        const count = document.querySelectorAll(".audioRow--et3ac").length;
        if (count >= max || count === last) break;
        last = count;
      }
    }, limit);

    return await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll(".audioRow--et3ac"));
      return rows.map((row) => {
        const titleEl = row.querySelector(".title--nya0C, a[class*='title']");
        const artistEl = row.querySelector(".name--GoJoZ, a[class*='name']");
        const tagEls = Array.from(row.querySelectorAll("a[class*='tag']"));
        const durationEl = row.querySelector("[class*='duration']");

        return {
          title: titleEl?.textContent?.trim() || "",
          artist: artistEl?.textContent?.trim() || "",
          durationText: durationEl?.textContent?.trim() || "",
          detailUrl:
            (titleEl as HTMLAnchorElement | null)?.href ||
            "",
          tags: tagEls
            .map((t) => t.textContent?.trim().toLowerCase() || "")
            .filter(Boolean),
        };
      });
    });
  } finally {
    await page.close();
  }
}

async function scrapeDetailPage(
  browser: Browser,
  hit: SearchHit,
): Promise<PixabayTrack | null> {
  const page = await browser.newPage();
  try {
    await configurePage(page);
    await page.goto(hit.detailUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    const data = await page.evaluate(() => {
      const scripts = Array.from(
        document.querySelectorAll('script[type="application/ld+json"]'),
      );
      for (const s of scripts) {
        const txt = s.textContent || "";
        if (txt.includes('"AudioObject"')) {
          try {
            return JSON.parse(txt) as Record<string, unknown>;
          } catch {}
        }
      }
      return null;
    });

    if (!data || data["@type"] !== "AudioObject") return null;

    const contentUrl = typeof data.contentUrl === "string" ? data.contentUrl : "";
    if (!contentUrl) return null;

    const creator =
      typeof data.creator === "object" && data.creator
        ? ((data.creator as Record<string, unknown>).name as string)
        : hit.artist;

    const durationIso = typeof data.duration === "string" ? data.duration : "";
    const durationSec =
      parseIsoDuration(durationIso) || parseDurationText(hit.durationText);

    const thumb = typeof data.thumbnailUrl === "string" ? data.thumbnailUrl : "";
    const titleClean = (
      typeof data.name === "string"
        ? data.name.replace(/\s*\|\s*Royalty-free Music\s*$/i, "")
        : hit.title
    ).trim();

    return {
      title: titleClean || hit.title,
      artist: creator || hit.artist,
      durationSec,
      mp3Url: contentUrl,
      thumbnailUrl: thumb || undefined,
      tags: hit.tags,
      pixabayId: pixabayIdFromUrl(hit.detailUrl),
    };
  } finally {
    await page.close();
  }
}

export async function scrapePixabayMusic(
  query: string,
  limit: number = 20,
): Promise<PixabayTrack[]> {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  try {
    const hits = await scrapeSearchPage(browser, query, limit);
    const sliced = hits.slice(0, limit).filter((h) => h.detailUrl);

    // Detail pages — limited concurrency to avoid rate limits
    const out: PixabayTrack[] = [];
    const batchSize = 3;
    for (let i = 0; i < sliced.length; i += batchSize) {
      const batch = sliced.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((h) =>
          scrapeDetailPage(browser, h).catch((err) => {
            console.warn(`[pixabayMusic] detail failed: ${err?.message || err}`);
            return null;
          }),
        ),
      );
      for (const r of results) if (r) out.push(r);
    }
    return out;
  } finally {
    await browser.close();
  }
}
