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
  title: "Remawt | AI-Powered Video Creation",
  description: "Create stunning motion graphics, product launch videos, info videos, and explainer videos in minutes with AI.",
  keywords: ["video creation", "AI video", "motion graphics", "explainer videos", "product videos"],
  authors: [{ name: "Remawt" }],
  creator: "Remawt",
  publisher: "Remawt",
  metadataBase: new URL("https://remawt.com"),
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/logo/remawt logo .svg", type: "image/svg+xml" },
    ],
    shortcut: "/logo/remawt logo .svg",
    apple: "/logo/remawt logo .svg",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://remawt.com",
    siteName: "Remawt",
    title: "Remawt | AI-Powered Video Creation",
    description: "Create stunning motion graphics, product launch videos, info videos, and explainer videos in minutes with AI.",
    images: [
      {
        url: "/logo/remwat full logo .svg",
        width: 1116,
        height: 479,
        alt: "Remawt - AI-Powered Video Creation Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Remawt | AI-Powered Video Creation",
    description: "Create stunning motion graphics, product launch videos, info videos, and explainer videos in minutes with AI.",
    images: ["/logo/remwat full logo .svg"],
    creator: "@remawt",
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
};

import { Providers } from "@/components/Providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="icon" type="image/svg+xml" href="/logo/remawt logo .svg" />
        <link rel="shortcut icon" type="image/svg+xml" href="/logo/remawt logo .svg" />
        <link rel="apple-touch-icon" type="image/svg+xml" href="/logo/remawt logo .svg" />
      </head>
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
