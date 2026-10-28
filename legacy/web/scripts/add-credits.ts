#!/usr/bin/env npx tsx
/**
 * Add credits to a user's account.
 *
 * Usage:
 *   npx tsx scripts/add-credits.ts <email-or-userId> <amount>
 *
 * Examples:
 *   npx tsx scripts/add-credits.ts user@example.com 100
 *   npx tsx scripts/add-credits.ts clxyz123abc 50
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [identifier, amountStr] = process.argv.slice(2);

  if (!identifier || !amountStr) {
    console.error(
      "Usage: npx tsx scripts/add-credits.ts <email-or-userId> <amount>",
    );
    process.exit(1);
  }

  const amount = parseInt(amountStr, 10);
  if (isNaN(amount) || amount <= 0) {
    console.error(
      `Invalid amount: "${amountStr}" — must be a positive integer`,
    );
    process.exit(1);
  }

  // Find the user by email or ID
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { id: identifier }],
    },
  });

  if (!user) {
    console.error(`User not found: ${identifier}`);
    process.exit(1);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { creditBalance: { increment: amount } },
  });

  console.log(`✅ Added ${amount} credits to ${user.email ?? user.id}`);
  console.log(`   Balance: ${user.creditBalance} → ${updated.creditBalance}`);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
