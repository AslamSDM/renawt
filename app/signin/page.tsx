"use client";

import React from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/projects";
  const error = searchParams.get("error");

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-white selection:text-black">
      {/* Film Grain Overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-50 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-40 px-6 py-6 flex items-center justify-between bg-transparent">
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
      </nav>

      {/* Sign In Section */}
      <section className="min-h-screen flex flex-col justify-center px-6 md:px-12 pt-24">
        <div className="max-w-7xl mx-auto w-full">
          {/* Top Info */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 md:mb-24">
            <div className="text-sm tracking-widest text-gray-500 uppercase">
              <span className="block">Welcome</span>
              <span className="block">Back</span>
            </div>
            <div className="text-sm tracking-widest text-gray-500 uppercase mt-4 md:mt-0 text-right">
              <span className="block">Sign In</span>
              <span className="block">To Continue</span>
            </div>
          </div>

          {/* Main Title */}
          <div className="mb-16 md:mb-24">
            <div className="overflow-hidden">
              <h1 className="text-[12vw] md:text-[10vw] font-light leading-[0.85] tracking-tight">
                Sign In
              </h1>
            </div>
          </div>

          {/* Subtitle */}
          <div className="max-w-2xl mb-12">
            <p className="text-lg md:text-xl text-gray-400">
              Continue creating stunning videos with AI
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="max-w-md mb-8 border border-red-500/30 bg-red-500/5 px-6 py-4">
              <p className="text-sm text-red-400">
                {error === "OAuthAccountNotLinked"
                  ? "This email is already associated with another account. Please sign in with the original provider."
                  : "An error occurred during sign in. Please try again."}
              </p>
            </div>
          )}

          {/* Sign In Button */}
          <div className="max-w-md mb-16">
            <button
              onClick={() => signIn("google", { callbackUrl })}
              className="w-full flex items-center justify-center gap-4 px-8 py-5 border border-white/30 hover:bg-white hover:text-black transition-all group"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                  className="group-hover:fill-[#4285F4]"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                  className="group-hover:fill-[#34A853]"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                  className="group-hover:fill-[#FBBC05]"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                  className="group-hover:fill-[#EA4335]"
                />
              </svg>
              <span className="text-lg tracking-wider uppercase">
                Continue with Google
              </span>
            </button>
          </div>

          {/* Description */}
          <p className="max-w-xl text-gray-500 leading-relaxed mb-12">
            Sign in to access your projects, create new videos, and manage your
            account. Your creative journey continues here.
          </p>

          {/* Back to Home */}
          <Link
            href="/"
            className="group flex items-center gap-4 text-lg tracking-wider uppercase hover:text-gray-400 transition-colors"
          >
            <span className="group-hover:-translate-x-2 transition-transform">&larr;</span>
            <span>Back to Home</span>
          </Link>
        </div>
      </section>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
          <div className="w-8 h-8 border border-white/30 border-t-white animate-spin" />
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
