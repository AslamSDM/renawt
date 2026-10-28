import * as React from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface PageShellProps {
  children: React.ReactNode;
  /** Hide the footer (auth pages). */
  bare?: boolean;
  /**
   * Offset content below the fixed 64px navbar. Turn off when the first
   * section is a hero that handles its own top padding.
   */
  offsetNav?: boolean;
  className?: string;
}

/** Marketing page frame: fixed Navbar, main, Footer. */
export function PageShell({ children, bare = false, offsetNav = true, className }: PageShellProps) {
  return (
    <TooltipProvider>
      <div className={cn("relative flex min-h-dvh flex-col overflow-x-clip bg-surface text-ink", className)}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[2px] focus:bg-ink focus:px-3 focus:py-2 focus:text-ink-inverse"
        >
          Skip to content
        </a>
        <Navbar />
        <main id="main" className={cn("flex-1", offsetNav && "pt-16")}>
          {children}
        </main>
        {!bare && <Footer />}
      </div>
    </TooltipProvider>
  );
}
