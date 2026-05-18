"use client";

import React from "react";
import Link from "next/link";

const COLS = [
  {
    heading: "Product",
    items: [
      { label: "Editor", href: "/editor" },
      { label: "Templates", href: "/#features" },
      { label: "Brand kit", href: "/#features" },
      { label: "Integrations", href: "/#features" },
      { label: "Changelog", href: "/#changelog" },
    ],
  },
  {
    heading: "Solutions",
    items: [
      { label: "Product demos", href: "/#use-cases" },
      { label: "Launch videos", href: "/#use-cases" },
      { label: "Feature drops", href: "/#use-cases" },
      { label: "Onboarding", href: "/#use-cases" },
      { label: "Lifecycle", href: "/#use-cases" },
    ],
  },
  {
    heading: "Resources",
    items: [
      { label: "Showcase", href: "/#showcase" },
      { label: "Tutorials", href: "/#" },
      { label: "Brand assets", href: "/#" },
      { label: "Status", href: "/#" },
    ],
  },
  {
    heading: "Company",
    items: [
      { label: "About", href: "/#" },
      { label: "Customers", href: "/#customers" },
      { label: "Careers", href: "/#" },
      { label: "Press", href: "/#" },
      { label: "Contact", href: "mailto:support@remawt.com" },
    ],
  },
  {
    heading: "Legal",
    items: [
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
      { label: "Security", href: "/#" },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-rule" style={{ background: "var(--surface)" }}>
      {/* Big wordmark band */}
      <div className="relative border-b border-rule">
        <div
          className="pointer-events-none absolute kinetic-glow-soft"
          style={{ top: "-30%", left: "70%", width: 600, height: 500 }}
        />
        <div className="relative mx-auto max-w-[1400px] px-6 py-20">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="kinetic-pill mb-5">
                <span className="accent-dot" />
                <span className="mono-tick" style={{ color: "var(--ink)" }}>
                  READY · GENERATE · SHIP
                </span>
              </div>
              <h2 className="text-5xl font-medium leading-[0.96] tracking-[-0.04em] md:text-7xl">
                Your next launch,
                <br />
                <span style={{ color: "var(--accent)", fontStyle: "italic", fontWeight: 300 }}>
                  rendered in minutes.
                </span>
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/projects" className="btn-accent">
                Start rendering
              </Link>
              <a href="mailto:support@remawt.com" className="btn-ghost">
                Book a demo
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Columns */}
      <div className="mx-auto max-w-[1400px] px-6 py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-3 lg:grid-cols-6">
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center" aria-label="Remawt">
              <img
                src="/logo/remwat full logo .svg"
                alt="Remawt"
                className="h-9 w-auto"
              />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
              SaaS video engine. Prompt to broadcast, in minutes.
            </p>
            <a
              href="mailto:support@remawt.com"
              className="mt-4 inline-block text-sm text-ink underline decoration-rule-strong underline-offset-4 hover:decoration-ink"
            >
              support@remawt.com
            </a>
          </div>

          {COLS.map((c) => (
            <div key={c.heading}>
              <h4 className="mono-tick mb-5">{c.heading}</h4>
              <ul className="space-y-3">
                {c.items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-sm text-ink/80 transition-colors hover:text-ink"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Strip */}
        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-rule pt-6 text-xs md:flex-row md:items-center">
          <p className="mono-tick">
            © {year} Remawt · SaaS Video Engine · v4
          </p>
          <div className="flex items-center gap-4 mono-tick">
            <span>FPS 60</span>
            <span className="text-rule-strong">·</span>
            <span>RES 3840×2160</span>
            <span className="text-rule-strong">·</span>
            <span>CODEC PRORES</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
