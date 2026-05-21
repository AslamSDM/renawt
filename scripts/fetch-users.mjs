import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const users = await prisma.user.findMany({
  where: { email: { not: null } },
  select: { id: true, email: true, name: true, creditBalance: true },
  orderBy: { creditBalance: "desc" },
});

console.log(JSON.stringify(users, null, 2));
console.log(`\nTotal: ${users.length}`);

await prisma.$disconnect();
