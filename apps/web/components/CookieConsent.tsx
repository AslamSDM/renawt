"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "remawt-cookie-consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // localStorage unavailable — skip banner
    }
  }, []);

  function choose(value: "accepted" | "rejected") {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] px-4 pb-4 sm:px-6 sm:pb-6">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 border border-rule bg-surface/95 p-5 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="text-sm leading-relaxed text-ink/85">
          <p className="mono-tick mb-1">COOKIES</p>
          <p>
            We use essential cookies to run Remawt and optional analytics cookies
            to improve it. See our{" "}
            <Link
              href="/cookies"
              className="text-ink underline decoration-rule-strong underline-offset-4 hover:decoration-ink"
            >
              Cookie Policy
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={() => choose("rejected")}
            className="btn-ghost"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => choose("accepted")}
            className="btn-accent"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
