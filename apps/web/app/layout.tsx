import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, EB_Garamond } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-eb-garamond",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#07070a",
};

const TITLE = "Remawt — Faceless videos that look designed";
const DESCRIPTION =
  "Pick a niche, build a channel identity once, and get motion-graphics shorts for TikTok, YouTube Shorts and Reels. Trend-driven ideas, scheduled posting, monetization-safe by design.";

export const metadata: Metadata = {
  title: {
    default: TITLE,
    template: "%s | Remawt",
  },
  description: DESCRIPTION,
  keywords: [
    "faceless youtube channel",
    "faceless tiktok",
    "faceless video generator",
    "ai shorts generator",
    "motion graphics shorts",
    "explainer video maker",
    "youtube shorts automation",
    "tiktok scheduler",
    "kinetic typography video",
    "faceless content creator",
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
    title: TITLE,
    description: "Faceless, not soulless. Motion-graphics shorts with a persistent channel identity, trend-driven ideas and scheduled posting.",
    images: [
      {
        url: "/logo/remwat full logo .svg",
        width: 1116,
        height: 479,
        alt: "Remawt",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@remawt",
    creator: "@remawt",
    title: TITLE,
    description: "Faceless, not soulless. Explainer shorts that look designed, not generated.",
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
import { Toaster } from "@/components/ui/toast";
import { CookieConsent } from "@/components/CookieConsent";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${ebGaramond.variable}`}
    >
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
                "Motion-graphics shorts for faceless channels: persistent channel identity, trend-driven ideas and scheduled posting to TikTok, YouTube Shorts and Reels.",
              offers: {
                "@type": "AggregateOffer",
                lowPrice: "0",
                highPrice: "199",
                priceCurrency: "USD",
                offerCount: 5,
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
          <CookieConsent />
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
