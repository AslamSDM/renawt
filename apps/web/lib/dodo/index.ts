import { getDodoClient } from "./client";
import { productToIdMap, annualProductToIdMap, Product } from "./subscription";

export type Metadata = {
    userId: string
    product: Product
    quantity: string
    billing?: string
}

export async function createCheckoutSession(
    userId: string,
    product: Product,
    quantity: number,
    billing: "monthly" | "annual" = "monthly"
) {

    const metadata = {
        userId,
        product,
        quantity: quantity.toString(),
        billing,
    }

    const idMap = billing === "annual" ? annualProductToIdMap : productToIdMap;

    try {
        const dodo = getDodoClient();
        const session = await dodo.checkoutSessions.create({
            product_cart: [
                {
                    product_id: idMap[product],
                    quantity: quantity
                }
            ],
            metadata: metadata,
            return_url: process.env.DODO_PAYMENTS_RETURN_URL || 'https://remawt.com/projects/',
        });

        console.log('Checkout URL:', session.checkout_url);
        console.log('Session ID:', session.session_id);

        return session;

    } catch (error) {
        console.error('Failed to create checkout session:', error);
        throw error;
    }
}
