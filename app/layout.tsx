import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
  title: {
    default: "Remawt — AI Video Creation Platform for SaaS",
    template: "%s | Remawt",
  },
  description:
    "Create professional product demos, explainer videos, and motion graphics in minutes. Remawt uses AI to transform your SaaS website or idea into stunning videos — no timeline editing required.",
  keywords: [
    "AI video generator",
    "SaaS demo video",
    "product demo creator",
    "AI motion graphics",
    "explainer video maker",
    "automated video production",
    "SaaS marketing videos",
    "product launch video",
    "AI video creation platform",
    "no-code video maker",
    "remotion video",
    "video from URL",
  ],
  authors: [{ name: "Remawt", url: "https://remawt.com" }],
  creator: "Remawt",
  publisher: "Remawt",
  metadataBase: new URL("https://remawt.com"),
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [{ url: "/logo/remawt logo .svg", type: "image/svg+xml" }],
    shortcut: "/logo/remawt logo .svg",
    apple: "/logo/remawt logo .svg",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://remawt.com",
    siteName: "Remawt",
    title: "Remawt — AI Video Creation Platform for SaaS",
    description:
      "Create professional product demos, explainer videos, and motion graphics in minutes with AI. No timeline editing required.",
    images: [
      {
        url: "/logo/remwat full logo .svg",
        width: 1116,
        height: 479,
        alt: "Remawt — AI-Powered Video Creation Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@remawt",
    creator: "@remawt",
    title: "Remawt — AI Video Creation Platform for SaaS",
    description:
      "Create professional product demos, explainer videos, and motion graphics in minutes with AI.",
    images: ["/logo/remwat full logo .svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "technology",
};

import { Providers } from "@/components/Providers";
import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="icon" type="image/svg+xml" href="/logo/remawt logo .svg" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Remawt",
              url: "https://remawt.com",
              applicationCategory: "MultimediaApplication",
              operatingSystem: "Web",
              description:
                "AI-powered video creation platform for SaaS. Create professional product demos, explainer videos, and motion graphics in minutes.",
              offers: {
                "@type": "AggregateOffer",
                lowPrice: "20",
                highPrice: "149",
                priceCurrency: "USD",
                offerCount: 3,
              },
              creator: {
                "@type": "Organization",
                name: "Remawt",
                url: "https://remawt.com",
                email: "support@remawt.com",
              },
            }),
          }}
        />
      </head>
      <body className="antialiased">
        <Providers>
          {children}
          <Toaster theme="dark" position="top-right" richColors />
        </Providers>
      </body>
    </html>
  );
}
