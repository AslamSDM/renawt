import { getDodoClient } from "./client";

const productIdMap: Record<string, string> = {
    STARTER: "pdt_0NXgVkOCld7OPSxqFhJpX",
}

export async function createCheckoutSession(
    subscription: string,
    userId: string
) {
    try {
        const dodo = getDodoClient();
        const session = await dodo.checkoutSessions.create({
            product_cart: [
                {
                    product_id: productIdMap[subscription],
                    quantity: 1
                }
            ],
            metadata: {
                userId: userId,
                subscription: subscription
            },

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
