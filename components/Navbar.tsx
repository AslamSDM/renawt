"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { ArrowUpRight } from "lucide-react";

interface NavbarProps {
  showLogo?: boolean;
  showNavLinks?: boolean;
  showCTA?: boolean;
  transparent?: boolean;
}

const NAV_LINKS = [
  { label: "Product", href: "/#product" },
  { label: "Showcase", href: "/#showcase" },
  { label: "Pricing", href: "/pricing" },
  { label: "Customers", href: "/#customers" },
];

export function Navbar({
  showLogo = true,
  showNavLinks = true,
  showCTA = true,
  transparent = false,
}: NavbarProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => pathname === path;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-40 ${
          transparent ? "bg-surface/60 backdrop-blur-md" : "bg-surface"
        }`}
        style={{ borderBottom: transparent ? "none" : "1px solid var(--rule)" }}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3 md:px-6 md:py-4">
          {/* Left: logo + status pill */}
          <div className="flex items-center gap-3 md:gap-4">
            {showLogo && (
              <Link href="/" className="flex shrink-0 items-center" aria-label="Remawt">
                <img
                  src="/logo/remawt logo .svg"
                  alt="Remawt"
                  className="block h-10 w-auto md:hidden"
                />
                <img
                  src="/logo/remwat full logo .svg"
                  alt="Remawt"
                  className="hidden h-8 w-auto md:block"
                />
              </Link>
            )}
            <span className="hidden md:inline-flex kinetic-pill !py-1.5 !px-2.5">
              <span className="accent-dot" />
              <span className="mono-tick" style={{ color: "var(--ink)" }}>
                STUDIO · v4.2
              </span>
            </span>
          </div>

          {/* Center: nav pill */}
          {showNavLinks && (
            <div
              className="hidden items-center gap-1 rounded-full p-1 md:flex"
              style={{ background: "var(--paper)", border: "1px solid var(--rule)" }}
            >
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className={`rounded-full px-3 py-1.5 text-[13px] tracking-tight transition-colors ${
                    isActive(l.href)
                      ? "text-ink"
                      : "text-muted hover:text-ink"
                  }`}
                  style={{
                    background: isActive(l.href) ? "rgba(245,245,247,0.06)" : "transparent",
                  }}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          )}

          {/* Right: auth / CTA */}
          <div className="hidden md:flex items-center gap-4">
            {status === "loading" ? (
              <div className="h-8 w-8 animate-pulse rounded-full bg-paper-3" />
            ) : session?.user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-3 transition-opacity hover:opacity-80"
                >
                  <span
                    className="kinetic-pill !py-1 !px-2.5"
                    style={{ background: "var(--accent-soft)", borderColor: "rgba(59,130,246,0.40)" }}
                  >
                    <span className="mono-tick" style={{ color: "var(--accent)" }}>
                      {session.user.creditBalance ?? 0} CREDITS
                    </span>
                  </span>
                  {session.user.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name || "User"}
                      className="h-8 w-8 rounded-full border border-rule-strong"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-rule-strong bg-paper-2 text-xs font-medium text-ink">
                      {session.user.name?.[0]?.toUpperCase() || "U"}
                    </div>
                  )}
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-12 z-50 w-60 rounded-sm border border-rule-strong bg-paper py-2 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.25)]">
                    <div className="border-b border-rule px-4 py-3">
                      <p className="truncate text-sm font-medium text-ink">
                        {session.user.name}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {session.user.email}
                      </p>
                    </div>
                    <div className="border-b border-rule px-4 py-3">
                      <p className="mono-tick">Credits</p>
                      <p className="font-serif-italic text-2xl text-ink">
                        {session.user.creditBalance ?? 0}
                      </p>
                    </div>
                    {[
                      { href: "/profile", label: "Profile" },
                      { href: "/projects", label: "My Projects" },
                      { href: "/pricing", label: "Buy Credits" },
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block px-4 py-2 text-sm text-ink transition-colors hover:bg-paper-2"
                        onClick={() => setDropdownOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                    <button
                      onClick={() => signOut()}
                      className="w-full px-4 py-2 text-left text-sm text-destructive transition-colors hover:bg-paper-2"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              showCTA && (
                <>
                  <button
                    onClick={() => signIn("google")}
                    className="text-sm text-muted transition-colors hover:text-ink"
                  >
                    Sign in
                  </button>
                  <Link
                    href="/projects"
                    className="group btn-accent !px-4 !py-2 !text-sm"
                  >
                    Open Studio
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                </>
              )
            )}
          </div>

          {/* Mobile button */}
          <button
            className="p-2 md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <div className="flex h-5 w-6 flex-col justify-between">
              <span
                className={`h-0.5 w-full bg-ink transition-transform ${
                  menuOpen ? "translate-y-2 rotate-45" : ""
                }`}
              />
              <span
                className={`h-0.5 w-full bg-ink transition-opacity ${
                  menuOpen ? "opacity-0" : ""
                }`}
              />
              <span
                className={`h-0.5 w-full bg-ink transition-transform ${
                  menuOpen ? "-translate-y-2 -rotate-45" : ""
                }`}
              />
            </div>
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-8 bg-paper pt-20 md:hidden">
          {showLogo && (
            <img
              src="/logo/remwat full logo .svg"
              alt="Remawt"
              className="mb-4 h-12 w-auto"
            />
          )}
          {showNavLinks &&
            NAV_LINKS.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="text-2xl tracking-tight text-ink"
                onClick={() => setMenuOpen(false)}
              >
                {l.label}
              </Link>
            ))}
          {session?.user ? (
            <>
              <div className="text-center">
                <p className="text-sm text-muted">{session.user.email}</p>
                <p className="font-serif-italic text-2xl text-ink">
                  {session.user.creditBalance ?? 0} credits
                </p>
              </div>
              <Link
                href="/profile"
                className="text-xl text-ink"
                onClick={() => setMenuOpen(false)}
              >
                Profile
              </Link>
              <button
                onClick={() => {
                  signOut();
                  setMenuOpen(false);
                }}
                className="mt-4 border border-destructive px-8 py-3 text-destructive"
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              href="/projects"
              onClick={() => setMenuOpen(false)}
              className="mt-4 rounded-full bg-ink px-8 py-3 text-ink-inverse"
            >
              Start free
            </Link>
          )}
        </div>
      )}
    </>
  );
}

export default Navbar;
