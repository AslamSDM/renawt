import { prisma } from "@/lib/db/prisma";

export async function updateUserSubscription(
    userId: string,
    product: string,
    status: string,
    dodoSubId: string
) {
    return prisma.subscription.upsert({
        where: { userId: userId },
        update: {
            plan: product,
            status: status,
            dodoSubId: dodoSubId,
        },
        create: {
            userId: userId,
            plan: product,
            status: status,
            dodoSubId: dodoSubId,
        },
    });
}

export async function addCredits(
    webhookEventId: string,
    userId: string,
    credits: number,
    dodoPurchaseId: string,
) {
    return await prisma.$transaction(async (tx) => {

        // Leverage DB Lock to prevent idempotency issue
        await tx.webhookEvent.create({
            data: {
                id: webhookEventId,
            },
        });

        // Record the purchase
        await tx.creditPurchase.create({
            data: {
                userId,
                amount: credits,
                dodoPurchaseId,
            },
        });

        // add credits
        await tx.user.update({
            where: { id: userId },
            data: {
                creditBalance: { increment: credits },
            },
        });
    });
}

export async function decreaseCredits(
    userId: string,
    credits: number,
) {
    return await prisma.user.update({
        where: { id: userId },
        data: {
            creditBalance: { decrement: credits },
        },
    });
}

export async function checkAndDeductCredits(userId: string, amount: number) {
    return await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user || user.creditBalance < amount) {
            throw new Error("INSUFFICIENT_CREDITS");
        }
        const updated = await tx.user.update({
            where: { id: userId },
            data: { creditBalance: { decrement: amount } },
        });
        return updated.creditBalance;
    });
}