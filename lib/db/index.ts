import { prisma } from "@/lib/prisma";

export async function upsertUserSubscription(
    userId: string,
    subscription: string,
    status: string,
    dodoSubId: string
) {
    return prisma.subscription.upsert({
        where: { userId: userId },
        update: {
            subscription: subscription,
            status: status,
            dodoSubId: dodoSubId,
        },
        create: {
            userId: userId,
            subscription: subscription,
            status: status,
            dodoSubId: dodoSubId,
        },
    });
}