import type { Platform } from "./types";

/** Runtime mirror of the Prisma `Platform` enum (kept local so this package never loads @prisma/client at runtime). */
export const PLATFORMS = ["TIKTOK", "YOUTUBE", "INSTAGRAM", "FACEBOOK", "THREADS", "LINKEDIN", "X", "PINTEREST"] as const satisfies readonly Platform[];

export function isPlatform(v: unknown): v is Platform {
  return typeof v === "string" && (PLATFORMS as readonly string[]).includes(v);
}

/** Lowercase provider keys shared by Post for Me and Upload-Post. */
export const PLATFORM_KEY: Record<Platform, string> = {
  TIKTOK: "tiktok",
  YOUTUBE: "youtube",
  INSTAGRAM: "instagram",
  FACEBOOK: "facebook",
  THREADS: "threads",
  LINKEDIN: "linkedin",
  X: "x",
  PINTEREST: "pinterest",
};

export function platformFromKey(key: string): Platform | undefined {
  const k = key.toLowerCase();
  if (k === "tiktok_business") return "TIKTOK";
  if (k === "twitter") return "X";
  return (Object.keys(PLATFORM_KEY) as Platform[]).find((p) => PLATFORM_KEY[p] === k);
}
