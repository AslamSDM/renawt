"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { DodoPayments } from "dodopayments-checkout";

export default function ProductPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/api/auth/signin');
        }
    }, [status, router]);

    useEffect(() => {
        DodoPayments.Initialize({
            mode: "test",
            displayType: "inline",
            onEvent: (event) => {
                if (event.event_type === "checkout.breakdown") {
                    const breakdown = event.data?.message;
                    // Update your UI with breakdown.subTotal, breakdown.tax, breakdown.total, etc.
                }
            },
        });
    }, []);

    const handleBuyStarter = async () => {
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
                    product: 'SUBSCRIPTION_STARTER',
                    userId: session.user.id,
                    quantity: 1
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to create checkout session');
            }

            const data = await response.json();
            console.log('Checkout URL:', data.checkout_url);

            DodoPayments.Checkout.open({
                checkoutUrl: data.checkout_url,
                elementId: "dodo-inline-checkout"
            });

        } catch (err) {
            console.error('Checkout error:', err);
            setError('Something went wrong. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0a0a0a',
            color: '#ffffff',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <div style={{
                padding: '2rem',
                borderRadius: '1.5rem',
                backgroundColor: '#161616',
                border: '1px solid #333',
                textAlign: 'center',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                maxWidth: '400px',
                width: '90%'
            }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '1rem', fontWeight: '700' }}>Starter Plan</h1>
                <p style={{ color: '#aaa', marginBottom: '2rem' }}>
                    Unlock essential features and start your journey with our Starter subscription.
                </p>

                {error && (
                    <div style={{ color: '#ff4d4d', marginBottom: '1rem', fontSize: '0.875rem' }}>
                        {error}
                    </div>
                )}

                <button
                    onClick={handleBuyStarter}
                    disabled={isLoading}
                    style={{
                        padding: '1rem 2rem',
                        fontSize: '1rem',
                        fontWeight: '600',
                        backgroundColor: '#ffffff',
                        color: '#000000',
                        border: 'none',
                        borderRadius: '0.75rem',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        opacity: isLoading ? 0.7 : 1,
                        width: '100%',
                        transform: 'scale(1)',
                    }}
                    onMouseOver={(e) => !isLoading && (e.currentTarget.style.transform = 'scale(1.02)')}
                    onMouseOut={(e) => !isLoading && (e.currentTarget.style.transform = 'scale(1)')}
                >
                    {isLoading ? 'Processing...' : 'Buy STARTER'}
                </button>
                <div id="dodo-inline-checkout"></div>
            </div>
        </div>
    );
}