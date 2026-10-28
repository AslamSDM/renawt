import { PrismaClient, type Prisma } from "@prisma/client";

/**
 * Singleton Prisma client shared by Next (apps/web) and Node ESM (apps/engine).
 * Cached on globalThis so Next dev HMR and repeated imports reuse one pool.
 */
const globalForPrisma = globalThis as unknown as { __remawtPrisma?: PrismaClient };

function logLevels(): Prisma.LogLevel[] {
  const env = process.env.NODE_ENV;
  if (process.env.PRISMA_LOG_QUERIES === "true") return ["query", "info", "warn", "error"];
  if (env === "development") return ["warn", "error"];
  if (env === "test") return ["error"];
  return ["error"];
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.__remawtPrisma) {
    globalForPrisma.__remawtPrisma = new PrismaClient({ log: logLevels() });
  }
  return globalForPrisma.__remawtPrisma;
}

/** Retry wrapper for transient Neon cold-start / connection errors. */
export async function withDbRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 2000): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      const transient = msg.includes("Can't reach database server") || msg.includes("P1001") || msg.includes("P1017");
      if (!transient || i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}
