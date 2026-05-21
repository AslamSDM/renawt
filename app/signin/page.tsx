"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/projects";
  const error = searchParams.get("error");

  return (
    <div className="min-h-screen bg-surface text-ink">
      <nav className="fixed inset-x-0 top-0 z-40 border-b border-rule bg-paper">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center" aria-label="Remawt">
            <img
              src="/logo/remwat full logo .svg"
              alt="Remawt"
              className="h-7 w-auto"
            />
          </Link>
          <span className="mono-tick">SCENE · SIGN IN</span>
        </div>
      </nav>

      <section className="flex min-h-screen flex-col justify-center px-6 pt-24">
        <div className="mx-auto w-full max-w-[1400px]">
          <div className="mb-10 flex flex-wrap items-center gap-3 border-b border-rule pb-4">
            <span className="mono-label rounded-sm border border-ink px-2 py-1">
              SCENE · AUTH · TAKE 01
            </span>
            <span className="mono-tick">PROVIDER GOOGLE</span>
            <span className="text-rule-strong">·</span>
            <span className="mono-tick">SECURE OAUTH</span>
          </div>

          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <h1 className="text-[clamp(3rem,9vw,8rem)] font-medium leading-[0.92] tracking-[-0.02em]">
                Welcome back,
                <br />
                <span className="font-serif-italic">sign in.</span>
              </h1>
              <p className="mt-8 max-w-lg text-lg text-muted">
                Pick up where you left off. Your projects, credits and renders
                are waiting.
              </p>
            </div>

            <div className="lg:col-span-5">
              <div className="border border-ink p-8">
                <p className="mono-label">CONTINUE</p>

                {error && (
                  <div className="mt-6 border border-destructive bg-paper px-4 py-3 text-sm text-destructive">
                    {error === "OAuthAccountNotLinked"
                      ? "This email is already linked to another provider. Use the original to sign in."
                      : "An error occurred during sign in. Please try again."}
                  </div>
                )}

                <button
                  onClick={() => signIn("google", { callbackUrl })}
                  className="group mt-6 flex w-full items-center justify-center gap-3 rounded-full border border-ink bg-paper px-6 py-4 text-sm text-ink transition-colors hover:bg-ink hover:text-ink-inverse"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continue with Google
                </button>

                <p className="mt-6 text-xs text-muted">
                  By continuing you agree to the{" "}
                  <Link
                    href="/terms"
                    className="text-ink underline decoration-rule-strong underline-offset-2"
                  >
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    className="text-ink underline decoration-rule-strong underline-offset-2"
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>
              </div>

              <Link
                href="/"
                className="mt-6 inline-flex items-center gap-2 text-sm text-muted hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.6} />
                Back to home
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-paper">
          <div className="h-8 w-8 animate-spin rounded-full border border-rule border-t-ink" />
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
