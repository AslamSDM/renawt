"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "remawt-cookie-consent";

function subscribeStorage(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}
function readChoice(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return "unavailable";
  }
}

export function CookieConsent() {
  const [dismissed, setDismissed] = useState(false);
  // "ssr" on the server and during hydration, the stored choice after; unavailable storage skips the banner.
  const stored = useSyncExternalStore(subscribeStorage, readChoice, () => "ssr");
  const visible = !dismissed && stored === null;

  function choose(value: "accepted" | "rejected") {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore
    }
    setDismissed(true);
  }

  if (!visible) return null;

  return (
    <div role="region" aria-label="Cookie consent" className="fixed inset-x-0 bottom-0 z-[100] px-4 pb-4 sm:px-6 sm:pb-6">
      <div className="mx-auto flex max-w-[720px] flex-col gap-4 rounded-[2px] border border-rule-strong bg-paper/95 p-5 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="type-small text-muted">
          We use essential cookies to run Remawt and optional analytics cookies to improve it. See our{" "}
          <Link href="/cookies" className="text-ink underline decoration-rule-strong underline-offset-4 hover:decoration-ink">
            cookie policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => choose("rejected")}>
            Reject
          </Button>
          <Button size="sm" onClick={() => choose("accepted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
