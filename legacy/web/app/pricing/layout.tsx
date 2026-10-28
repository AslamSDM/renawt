import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Simple Credit-Based Plans",
  description:
    "Pay-as-you-go credit packages for AI video creation. Starting at $20 for 100 credits. Save 10% with annual billing. No subscriptions, credits never expire.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Remawt Pricing — AI Video Creation from $0.07/video",
    description:
      "Simple credit-based pricing. Create professional SaaS demos and explainer videos with AI. Credits never expire.",
    url: "https://remawt.com/pricing",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "What are credits?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Credits are used to generate videos. Each video export costs 1 credit, regardless of length or quality.",
                },
              },
              {
                "@type": "Question",
                name: "Do credits expire?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "No, your credits never expire. Use them whenever you're ready to create.",
                },
              },
              {
                "@type": "Question",
                name: "What's the difference between monthly and annual?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Annual plans give you 10% off compared to paying monthly. You get the same credits each month, just at a lower total cost.",
                },
              },
              {
                "@type": "Question",
                name: "Can I get a refund?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Credits are non-refundable once purchased, but they never expire so you can use them whenever you need.",
                },
              },
            ],
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: "Remawt AI Video Credits",
            description:
              "AI-powered video creation credits for SaaS product demos, explainer videos, and motion graphics.",
            brand: { "@type": "Brand", name: "Remawt" },
            offers: [
              {
                "@type": "Offer",
                name: "Starter — 100 credits",
                price: "20",
                priceCurrency: "USD",
                availability: "https://schema.org/InStock",
                url: "https://remawt.com/pricing",
              },
              {
                "@type": "Offer",
                name: "Creator — 500 credits",
                price: "39",
                priceCurrency: "USD",
                availability: "https://schema.org/InStock",
                url: "https://remawt.com/pricing",
              },
              {
                "@type": "Offer",
                name: "Studio — 2000 credits",
                price: "149",
                priceCurrency: "USD",
                availability: "https://schema.org/InStock",
                url: "https://remawt.com/pricing",
              },
            ],
          }),
        }}
      />
      {children}
    </>
  );
}
