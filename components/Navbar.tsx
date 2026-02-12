"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path: string) => pathname === path;

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

        {/* CTA Button */}
        {showCTA && (
          <div className="hidden md:block">
            <button 
              onClick={() => router.push('/creative')}
              className="px-6 py-2 border border-white hover:bg-white hover:text-black transition-all uppercase text-xs tracking-widest"
            >
              Start Creating
            </button>
          </div>
        )}

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
            {showCTA && (
              <button 
                onClick={() => {router.push('/creative'); setMenuOpen(false);}}
                className="px-8 py-3 border border-white text-lg tracking-wider uppercase mt-4"
              >
                Start Creating
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default Navbar;
