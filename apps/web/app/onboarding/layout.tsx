import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { Container } from "@/components/layout/container";
import { skinFontVars } from "@/app/_landing/fonts";

export const metadata: Metadata = { title: "Set up your channel", robots: { index: false, follow: false } };

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell bare focused className={skinFontVars}>
      <Container width="app" className="py-8 lg:py-10">
        {children}
      </Container>
    </PageShell>
  );
}
