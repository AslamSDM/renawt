/**
 * Redis-based cache for scrape results.
 * Caches full ProductData (including LLM-analyzed results) by URL hash.
 * TTL: 24 hours.
 */

import { createHash } from "crypto";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const CACHE_TTL = 60 * 60 * 24; // 24 hours in seconds

// Lazy Redis connection
let redisClient: any = null;
let redisAvailable: boolean | null = null;

async function getRedisClient() {
  if (redisClient) return redisClient;

  try {
    // Dynamic import to avoid hard dependency
    const { createClient } = await import("redis");
    redisClient = createClient({ url: REDIS_URL });

    redisClient.on("error", (err: Error) => {
      console.warn("[ScrapeCache] Redis error:", err.message);
      redisAvailable = false;
    });

    await redisClient.connect();
    redisAvailable = true;
    console.log("[ScrapeCache] Redis connected");
    return redisClient;
  } catch (error) {
    console.warn("[ScrapeCache] Redis unavailable:", error);
    redisAvailable = false;
    return null;
  }
}

function getCacheKey(url: string): string {
  const hash = createHash("sha256").update(url.toLowerCase().trim()).digest("hex").slice(0, 16);
  return `scrape:${hash}`;
}

/**
 * Get cached scrape result for a URL
 */
export async function getCachedScrapeResult(url: string): Promise<any | null> {
  try {
    const client = await getRedisClient();
    if (!client) return null;

    const key = getCacheKey(url);
    const cached = await client.get(key);

    if (cached) {
      console.log(`[ScrapeCache] Cache HIT for ${url}`);
      return JSON.parse(cached);
    }

    console.log(`[ScrapeCache] Cache MISS for ${url}`);
    return null;
  } catch (error) {
    console.warn("[ScrapeCache] Get error:", error);
    return null;
  }
}

/**
 * Cache a scrape result for a URL
 */
export async function setCachedScrapeResult(url: string, data: any): Promise<void> {
  try {
    const client = await getRedisClient();
    if (!client) return;

    const key = getCacheKey(url);
    await client.setEx(key, CACHE_TTL, JSON.stringify(data));
    console.log(`[ScrapeCache] Cached result for ${url} (TTL: ${CACHE_TTL}s)`);
  } catch (error) {
    console.warn("[ScrapeCache] Set error:", error);
  }
}

/**
 * Check if Redis cache is available
 */
export async function isCacheAvailable(): Promise<boolean> {
  if (redisAvailable !== null) return redisAvailable;
  const client = await getRedisClient();
  return client !== null;
}
