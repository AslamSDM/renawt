import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Demo — See AI Video Creation in Action",
  description:
    "Watch how Remawt transforms any SaaS website into a professional product demo video in under 5 minutes using AI.",
  alternates: { canonical: "/demo" },
  openGraph: {
    title: "Remawt Demo — AI Video Creation in Action",
    description:
      "See how Remawt creates professional product demo videos from any URL in minutes.",
    url: "https://remawt.com/demo",
  },
};

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
