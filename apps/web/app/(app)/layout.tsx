import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: { default: "App", template: "%s | Remawt" },
  robots: { index: false, follow: false },
};

/**
 * Authenticated app frame. Channel list, plan and usage are pushed into the
 * shell by the web-app agent with <AppShellData /> (see components/layout/app-shell.tsx).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
