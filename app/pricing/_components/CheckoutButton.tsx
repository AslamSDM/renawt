"use client";

import { DodoPayments } from "dodopayments-checkout";
import { Button } from "@/components/ui/Button";
import { useEffect, useState } from "react";
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ProductType } from "@/lib/dodo/subscription";

type Props = {
    text: string
    isPopular: boolean
    product: ProductType
    quantity: number
    billing?: "monthly" | "annual"
}

function CheckoutButton({
    text,
    isPopular,
    product,
    quantity,
    billing = "monthly"
}: Props) {

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        const mode = process.env.NEXT_PUBLIC_DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live" : "test";
        DodoPayments.Initialize({
            mode,
            displayType: "overlay",
            onEvent: (event) => {
                if (event.event_type === "checkout.closed") {
                    setIsLoading(false);
                }
            },
        });
    }, []);


    const handleCheckout = async () => {

        if (status === 'unauthenticated') {
            router.push('/api/auth/signin');
            return;
        }

        if (!session?.user?.id) {
            setError('User session not found. Please log in again.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/dodo/checkout_session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    product: product.name,
                    userId: session.user.id,
                    quantity: quantity,
                    billing,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to create checkout session');
            }

            const data = await response.json();

            DodoPayments.Checkout.open({
                checkoutUrl: data.checkout_url,
            });

        } catch (err) {
            console.error('Checkout error:', err);
            setError('Something went wrong. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }


    return (
        <div>
            <Button
                className="w-full rounded-none cursor-pointer"
                variant={isPopular ? "default" : "outline"}
                size="lg"
                onClick={handleCheckout}
                disabled={isLoading}
            >
                {isLoading ? "Loading..." : text}
            </Button>
            {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
        </div>
    )
}

export default CheckoutButton
