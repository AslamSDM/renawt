import { getDodoClient } from "./client";
import { productToIdMap, Product } from "./subscription";

export type Metadata = {
    userId: string
    product: Product
    quantity: string
}

export async function createCheckoutSession(
    userId: string,
    product: Product,
    quantity: number
) {

    const metadata = {
        userId,
        product,
        quantity: quantity.toString()
    }

    try {
        const dodo = getDodoClient();
        const session = await dodo.checkoutSessions.create({
            product_cart: [
                {
                    product_id: productToIdMap[product],
                    quantity: quantity
                }
            ],
            metadata: metadata,

            // Where to redirect after successful payment
            return_url: 'https://yoursite.com/checkout/success',
        });

        // Redirect your customer to this URL to complete payment
        console.log('Checkout URL:', session.checkout_url);
        console.log('Session ID:', session.session_id);

        return session;

    } catch (error) {
        console.error('Failed to create checkout session:', error);
        throw error;
    }
}
