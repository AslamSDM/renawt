import { PrismaClient, Prisma } from "./generated/prisma/index.js";

const prisma = new PrismaClient();

// Credit costs per endpoint
export const COSTS = {
  generate: 1,
  continue: 4,
  render: 4,
  editVideo: 1,
  editScript: 1,
  freestyle: 5,
};

// Credit deduction via Prisma (shared production DB)
export async function checkAndDeductCredits(
  userId: string,
  amount: number,
): Promise<{ ok: true; balance: number } | { ok: false; error: string }> {
  if (process.env.DISABLE_CREDIT_CHECK === "true" || userId === "dev-user") {
    return { ok: true, balance: 999 };
  }
  try {
    const balance = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user || user.creditBalance < amount) {
          throw new Error("INSUFFICIENT_CREDITS");
        }
        const updated = await tx.user.update({
          where: { id: userId },
          data: { creditBalance: { decrement: amount } },
        });
        return updated.creditBalance;
      },
    );
    return { ok: true, balance };
  } catch (e) {
    if (e instanceof Error && e.message === "INSUFFICIENT_CREDITS") {
      return { ok: false, error: "Insufficient credits" };
    }
    console.error("[Credits] DB error:", e);
    return { ok: false, error: "Credit check failed" };
  }
}
