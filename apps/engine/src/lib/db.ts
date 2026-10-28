import { PrismaClient } from "@remawt/db";

const g = globalThis as unknown as { __enginePrisma?: PrismaClient };

/** Lazily-created Prisma singleton (so importing modules never opens a connection). */
export function db(): PrismaClient {
  if (!g.__enginePrisma) g.__enginePrisma = new PrismaClient();
  return g.__enginePrisma;
}

export async function disconnectDb(): Promise<void> {
  if (g.__enginePrisma) await g.__enginePrisma.$disconnect();
}
