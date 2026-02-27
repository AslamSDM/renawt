/**
 * IMAGE ENRICHMENT
 *
 * Provides high-quality images for video generation by:
 * 1. Filtering out low-quality scraped images (favicons, og images, tiny files)
 * 2. Fetching relevant stock photos from Unsplash
 * 3. Falling back gracefully when APIs are unavailable
 */

import type { ProductData } from "../types";

// ─────────────────────────────────────────────
// IMAGE QUALITY FILTERS
// ─────────────────────────────────────────────

/** Patterns that indicate a low-quality or unusable image */
const BAD_IMAGE_PATTERNS = [
  /favicon/i,
  /logo\.(svg|ico|png)$/i,
  /\/(icon|apple-touch|touch-icon)/i,
  /og[-_]?image/i,
  /opengraph/i,
  /social[-_]?card/i,
  /twitter[-_]?(card|image)/i,
  /\.ico$/i,
  /\/badge[s]?\//i,
  /sprite/i,
  /placeholder/i,
  /blank\.png/i,
  /pixel\.png/i,
  /1x1/i,
  // Common CDN thumbnail paths
  /\/thumb\//i,
  /size=\d{1,2}x\d{1,2}/i,
];

/** Patterns that indicate a likely good content image */
const GOOD_IMAGE_PATTERNS = [
  /hero/i,
  /banner/i,
  /feature/i,
  /screenshot/i,
  /product/i,
  /preview/i,
  /cover/i,
  /\/blog\//i,
  /\/media\//i,
  /\/images\//i,
  /\/assets\//i,
];

export function filterImageUrls(urls: string[]): string[] {
  if (!urls || urls.length === 0) return [];

  const valid = urls.filter((url) => {
    if (!url || !url.startsWith("http")) return false;

    // Reject known bad patterns
    if (BAD_IMAGE_PATTERNS.some((p) => p.test(url))) return false;

    // Reject data URIs
    if (url.startsWith("data:")) return false;

    // Only allow common image extensions (or no extension — likely a CDN)
    const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
    if (
      ext &&
      !["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(ext) &&
      ext.length <= 5
    ) {
      return false;
    }

    return true;
  });

  // Prefer images that match good patterns
  const preferred = valid.filter((url) =>
    GOOD_IMAGE_PATTERNS.some((p) => p.test(url)),
  );
  const rest = valid.filter(
    (url) => !GOOD_IMAGE_PATTERNS.some((p) => p.test(url)),
  );

  return [...preferred, ...rest].slice(0, 6);
}

// ─────────────────────────────────────────────
// UNSPLASH STOCK PHOTOS
// ─────────────────────────────────────────────

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

interface UnsplashPhoto {
  id: string;
  urls: { regular: string; small: string; thumb: string };
  alt_description: string | null;
  description: string | null;
}

/**
 * Search Unsplash for stock photos matching a query.
 * Returns up to `count` photo URLs (regular size, ~1080px wide).
 */
export async function searchUnsplashPhotos(
  query: string,
  count: number = 3,
): Promise<string[]> {
  if (!UNSPLASH_ACCESS_KEY) {
    console.log("[ImageEnrich] No UNSPLASH_ACCESS_KEY — skipping Unsplash");
    return getUnsplashFallbackUrls(query, count);
  }

  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape&content_filter=high`;
    const response = await fetch(url, {
      headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
    });

    if (!response.ok) {
      console.warn(`[ImageEnrich] Unsplash API error: ${response.status}`);
      return getUnsplashFallbackUrls(query, count);
    }

    const data = (await response.json()) as { results: UnsplashPhoto[] };
    const photoUrls = data.results.map((p) => p.urls.regular);
    console.log(
      `[ImageEnrich] Unsplash returned ${photoUrls.length} photos for "${query}"`,
    );
    return photoUrls.slice(0, count);
  } catch (error) {
    console.error("[ImageEnrich] Unsplash fetch error:", error);
    return getUnsplashFallbackUrls(query, count);
  }
}

/**
 * Source-stable Unsplash URLs when API key is not available.
 * These are real, high-quality landscape photos from Unsplash's collection.
 */
function getUnsplashFallbackUrls(query: string, count: number): string[] {
  // Category-specific curated photo IDs from Unsplash
  const categoryPhotos: Record<string, string[]> = {
    tech: [
      "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80",
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&q=80",
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80",
      "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=1200&q=80",
    ],
    business: [
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=80",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80",
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80",
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&q=80",
    ],
    abstract: [
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80",
      "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&q=80",
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&q=80",
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80",
    ],
    productivity: [
      "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=1200&q=80",
      "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&q=80",
      "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=1200&q=80",
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&q=80",
    ],
    saas: [
      "https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&q=80",
      "https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=1200&q=80",
      "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&q=80",
      "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=1200&q=80",
    ],
    ecommerce: [
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200&q=80",
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&q=80",
      "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=1200&q=80",
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80",
    ],
  };

  // Pick the best category match
  const lq = query.toLowerCase();
  let photos = categoryPhotos.tech; // default
  if (lq.match(/shop|store|product|market|ecommerce|retail/))
    photos = categoryPhotos.ecommerce;
  else if (lq.match(/saas|software|app|platform|api|code|dev/))
    photos = categoryPhotos.saas;
  else if (lq.match(/business|corporate|team|office|startup/))
    photos = categoryPhotos.business;
  else if (lq.match(/product|work|task|manage|project|plan/))
    photos = categoryPhotos.productivity;
  else if (lq.match(/gradient|abstract|art|design/))
    photos = categoryPhotos.abstract;

  return photos.slice(0, count);
}

// ─────────────────────────────────────────────
// MAIN ENRICHMENT FUNCTION
// ─────────────────────────────────────────────

/**
 * Enrich a ProductData object with high-quality images.
 * - Filters bad scraped images
 * - Adds Unsplash stock photos based on product description
 * Returns a new array of image URLs for use in prompts.
 */
export async function enrichProductImages(
  productData: ProductData,
  count: number = 4,
): Promise<string[]> {
  console.log("[ImageEnrich] Enriching product images...");

  // 1. Filter the scraped images
  const filteredScraped = filterImageUrls(productData.images || []);
  console.log(
    `[ImageEnrich] Filtered scraped images: ${filteredScraped.length} of ${productData.images?.length || 0} kept`,
  );

  // 2. Build a smart search query from product data
  const searchQuery = buildImageSearchQuery(productData);
  console.log(`[ImageEnrich] Unsplash search query: "${searchQuery}"`);

  // 3. Fetch Unsplash stock photos
  const stockPhotos = await searchUnsplashPhotos(searchQuery, count);

  // 4. Combine: prefer stock photos, supplement with good scraped if needed
  const combined = [...stockPhotos];
  for (const url of filteredScraped) {
    if (combined.length >= count) break;
    combined.push(url);
  }

  console.log(`[ImageEnrich] Final image set: ${combined.length} images`);
  return combined;
}

/**
 * Build a search query for Unsplash based on product data
 */
function buildImageSearchQuery(productData: ProductData): string {
  const name = productData.name || "";
  const tone = productData.tone || "professional";
  const type = (productData as any).productType || "saas";
  const description = productData.description || "";

  // Extract key themes from description
  const keywords: string[] = [];

  if (type === "ecommerce") keywords.push("product", "lifestyle");
  else if (type === "saas") keywords.push("software", "productivity", "tech");
  else if (type === "service")
    keywords.push("professional", "service", "business");

  if (tone === "playful") keywords.push("colorful", "fun");
  else if (tone === "minimal") keywords.push("minimal", "clean");
  else if (["professional", "bold"].includes(tone))
    keywords.push("modern", "professional");

  // Pull a distinctive keyword from description
  const descWords = description
    .toLowerCase()
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 5 &&
        !["their", "these", "those", "about", "which", "where"].includes(w),
    );
  if (descWords.length > 0) keywords.push(descWords[0]);

  const query = keywords.slice(0, 3).join(" ") || "technology professional";
  return query;
}
