import * as cheerio from "cheerio";
import pLimit from "p-limit";

export interface CrawledPage {
  url: string;
  title: string;
  text: string;
  headings: string[];
  links: string[];
  imageUrls: string[];
}

export interface CrawlResult {
  entryUrl: string;
  pages: CrawledPage[];
  logoUrl?: string;
  brandImages: string[];
  allLinks: string[];
  combinedText: string;
}

function sameOrigin(child: string, parent: string): boolean {
  try {
    return new URL(child).origin === new URL(parent).origin;
  } catch {
    return false;
  }
}

function normalizeUrl(raw: string, base: string): string | null {
  try {
    const u = new URL(raw, base);
    u.hash = "";
    u.search = "";
    let href = u.href;
    if (href.endsWith("/")) href = href.slice(0, -1);
    return href;
  } catch {
    return null;
  }
}

function isNavigable(url: string): boolean {
  try {
    const u = new URL(url);
    if (!u.protocol.startsWith("http")) return false;
    const ext = u.pathname.split(".").pop()?.toLowerCase();
    const blockedExts = ["pdf", "jpg", "jpeg", "png", "gif", "webp", "svg", "css", "js", "zip", "mp4", "mov", "webm", "mp3", "xml", "json"];
    return !blockedExts.includes(ext || "");
  } catch {
    return false;
  }
}

async function fetchAndParse(url: string): Promise<CrawledPage | null> {
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RemawtCrawler/1.0)" },
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    const $ = cheerio.load(html);

    const title = $("title").first().text().trim();
    const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 8000);
    const headings: string[] = [];
    $("h1,h2,h3").each((_, el) => {
      const t = $(el).text().trim();
      if (t) headings.push(t);
    });

    const links: string[] = [];
    $("a[href]").each((_, el) => {
      const h = $(el).attr("href");
      if (h) links.push(h);
    });

    const imageUrls: string[] = [];
    $("img").each((_, el) => {
      const src = $(el).attr("src");
      if (src && !src.startsWith("data:")) {
        try {
          const resolved = new URL(src, url).href;
          imageUrls.push(resolved);
        } catch {}
      }
    });
    const logoUrl = imageUrls.find((s) => /logo|brand|wordmark/i.test(s));

    return {
      url,
      title,
      text: bodyText,
      headings: headings.slice(0, 20),
      links,
      imageUrls: [...new Set(imageUrls)],
    };
  } catch (e) {
    console.warn("[crawl] fetch failed", url, e instanceof Error ? e.message : e);
    return null;
  }
}

function pickLogo(pages: CrawledPage[]): string | undefined {
  for (const p of pages) {
    const found = p.imageUrls.find((s) => /logo|brand|wordmark/i.test(s));
    if (found) return found;
    const firstImg = p.imageUrls.find((s) => /header|banner|hero|home/i.test(s) || p.title.toLowerCase().includes("home"));
    if (firstImg) return firstImg;
  }
  return pages[0]?.imageUrls[0];
}

export async function crawlSite(opts: {
  url: string;
  maxPages?: number;
  maxDepth?: number;
}): Promise<CrawlResult> {
  const { url: entryUrl, maxPages = 6, maxDepth = 2 } = opts;

  const seen = new Set<string>();
  const queue: { url: string; depth: number }[] = [{ url: entryUrl, depth: 0 }];
  const pages: CrawledPage[] = [];
  const limit = pLimit(4);

  while (queue.length > 0 && pages.length < maxPages) {
    const remain = maxPages - pages.length;
    const batch = queue.splice(0, Math.min(queue.length, remain));
    const results = await Promise.all(
      batch.map((item) =>
        limit(async () => {
          if (seen.has(item.url)) return null;
          seen.add(item.url);

          const data = await fetchAndParse(item.url);
          if (!data) return null;

          const discovered: string[] = [];
          if (item.depth < maxDepth) {
            let found = 0;
            for (const raw of data.links) {
              if (found >= 30) break;
              const normalized = normalizeUrl(raw, entryUrl);
              if (normalized && sameOrigin(normalized, entryUrl) && isNavigable(normalized) && !seen.has(normalized)) {
                discovered.push(normalized);
                found++;
              }
            }
          }

          return { data, discovered, depth: item.depth };
        }),
      ),
    );

    for (const r of results) {
      if (!r) continue;
      pages.push(r.data);
      for (const d of r.discovered) {
        if (!seen.has(d)) queue.push({ url: d, depth: r.depth + 1 });
      }
    }
  }

  const logoUrl = pickLogo(pages);
  const brandImages = [...new Set(pages.flatMap((p) => p.imageUrls))].slice(0, 20);

  return {
    entryUrl,
    pages,
    logoUrl,
    brandImages,
    allLinks: [...new Set(pages.flatMap((p) => p.links))],
    combinedText: pages
      .map(
        (p) =>
          `URL: ${p.url}\nTitle: ${p.title}\nHeadings: ${p.headings.join(" | ")}\nText: ${p.text}`,
      )
      .join("\n\n---\n\n"),
  };
}
