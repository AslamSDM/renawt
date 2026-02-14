"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";

interface NavbarProps {
  showLogo?: boolean;
  showNavLinks?: boolean;
  showCTA?: boolean;
  transparent?: boolean;
}

export function Navbar({
  showLogo = true,
  showNavLinks = true,
  showCTA = true,
  transparent = false
}: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => pathname === path;

  // Close dropdown when clicking outside
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
      <nav className={`fixed top-0 left-0 right-0 z-40 px-6 py-6 flex items-center justify-between ${
        transparent ? "bg-transparent" : "bg-[#0a0a0a]/80 backdrop-blur-sm"
      }`}>
        {/* Logo */}
        {showLogo && (
          <Link href="/" className="flex items-center gap-3 group">
            <img
              src="/logo/remawt logo .svg"
              alt="Remawt"
              className="h-8 w-auto"
            />
            <span className="text-xl font-light tracking-[0.2em] uppercase hidden sm:block">
              Remawt
            </span>
          </Link>
        )}

        {/* Desktop Navigation */}
        {showNavLinks && (
          <div className="hidden md:flex items-center gap-8 text-sm tracking-wider">
            <Link
              href="/projects"
              className={`hover:text-gray-400 transition-colors uppercase ${
                isActive('/projects') ? 'text-white' : 'text-gray-400'
              }`}
            >
              Projects
            </Link>
            <Link
              href="/pricing"
              className={`hover:text-gray-400 transition-colors uppercase ${
                isActive('/pricing') ? 'text-white' : 'text-gray-400'
              }`}
            >
              Pricing
            </Link>
            <Link
              href="/creative"
              className={`hover:text-gray-400 transition-colors uppercase ${
                isActive('/creative') ? 'text-white' : 'text-gray-400'
              }`}
            >
              Create
            </Link>
          </div>
        )}

        {/* Auth / CTA */}
        <div className="hidden md:flex items-center gap-4">
          {status === "loading" ? (
            <div className="w-8 h-8 rounded-full bg-gray-700 animate-pulse" />
          ) : session?.user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                {/* Credit badge */}
                <span className="text-xs tracking-wider bg-white/10 border border-white/20 px-3 py-1 rounded-full">
                  {session.user.creditBalance ?? 0} credits
                </span>
                {/* Avatar */}
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || "User"}
                    className="w-8 h-8 rounded-full border border-white/20"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-medium">
                    {session.user.name?.[0]?.toUpperCase() || "U"}
                  </div>
                )}
              </button>

              {/* Dropdown */}
              {dropdownOpen && (
                <div className="absolute right-0 top-12 w-56 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl py-2 z-50">
                  <div className="px-4 py-2 border-b border-white/10">
                    <p className="text-sm font-medium truncate">{session.user.name}</p>
                    <p className="text-xs text-gray-400 truncate">{session.user.email}</p>
                  </div>
                  <div className="px-4 py-2 border-b border-white/10">
                    <p className="text-xs text-gray-400">Credits</p>
                    <p className="text-lg font-semibold">{session.user.creditBalance ?? 0}</p>
                  </div>
                  <Link
                    href="/profile"
                    className="block px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                    onClick={() => setDropdownOpen(false)}
                  >
                    Profile
                  </Link>
                  <Link
                    href="/projects"
                    className="block px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                    onClick={() => setDropdownOpen(false)}
                  >
                    My Projects
                  </Link>
                  <Link
                    href="/pricing"
                    className="block px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                    onClick={() => setDropdownOpen(false)}
                  >
                    Buy Credits
                  </Link>
                  <button
                    onClick={() => signOut()}
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/5 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            showCTA && (
              <button
                onClick={() => signIn("google")}
                className="px-6 py-2 border border-white hover:bg-white hover:text-black transition-all uppercase text-xs tracking-widest"
              >
                Sign In
              </button>
            )
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <div className="w-6 h-5 flex flex-col justify-between">
            <span className={`w-full h-0.5 bg-white transition-transform ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`w-full h-0.5 bg-white transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`w-full h-0.5 bg-white transition-transform ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </div>
        </button>
      </nav>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="fixed inset-0 bg-[#0a0a0a] z-30 flex flex-col items-center justify-center gap-8 md:hidden pt-20">
          <div className="flex flex-col items-center gap-8">
            {showLogo && (
              <img
                src="/logo/remawt logo .svg"
                alt="Remawt"
                className="h-16 w-auto mb-4"
              />
            )}
            {showNavLinks && (
              <>
                <Link
                  href="/projects"
                  className="text-2xl tracking-wider uppercase"
                  onClick={() => setMenuOpen(false)}
                >
                  Projects
                </Link>
                <Link
                  href="/pricing"
                  className="text-2xl tracking-wider uppercase"
                  onClick={() => setMenuOpen(false)}
                >
                  Pricing
                </Link>
                <Link
                  href="/creative"
                  className="text-2xl tracking-wider uppercase"
                  onClick={() => setMenuOpen(false)}
                >
                  Create
                </Link>
              </>
            )}

            {/* Mobile auth */}
            {session?.user ? (
              <>
                <div className="text-center">
                  <p className="text-sm text-gray-400">{session.user.email}</p>
                  <p className="text-lg font-semibold mt-1">{session.user.creditBalance ?? 0} credits</p>
                </div>
                <Link
                  href="/profile"
                  className="text-2xl tracking-wider uppercase"
                  onClick={() => setMenuOpen(false)}
                >
                  Profile
                </Link>
                <button
                  onClick={() => { signOut(); setMenuOpen(false); }}
                  className="px-8 py-3 border border-red-400 text-red-400 text-lg tracking-wider uppercase mt-4"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={() => { signIn("google"); setMenuOpen(false); }}
                className="px-8 py-3 border border-white text-lg tracking-wider uppercase mt-4"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default Navbar;
