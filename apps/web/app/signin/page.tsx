"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

function GoogleMark() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/app";
  const error = searchParams.get("error");
  const [pending, setPending] = React.useState(false);

  return (
    <div className="flex min-h-dvh flex-col bg-surface text-ink">
      <header className="h-16 border-b border-rule">
        <Container className="flex h-full items-center justify-between">
          <Link href="/" aria-label="Remawt home" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo/remwat full logo .svg" alt="Remawt" className="h-9 w-auto" />
          </Link>
          <Link href="/" className="type-small inline-flex items-center gap-1.5 text-muted transition-colors hover:text-ink">
            <ArrowLeft className="size-3.5" aria-hidden /> Back to home
          </Link>
        </Container>
      </header>

      <main className="flex flex-1 items-center py-20 md:py-32">
        <Container className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="flex flex-col gap-6 lg:col-span-7">
            <h1 className="type-display-xl text-ink">
              Your channel is <span className="font-serif-italic text-muted">waiting.</span>
            </h1>
            <p className="type-body-lg max-w-[48ch] text-muted">
              Sign in to pick up your Identity Kit, this week’s Radar ideas and everything scheduled to post.
            </p>
          </div>

          <div className="lg:col-span-5">
            <Card padding="md" className="gap-6">
              <div className="flex flex-col gap-1.5">
                <h2 className="type-heading text-ink">Sign in or create an account</h2>
                <p className="type-small text-muted">One click with Google. New accounts start on the Free plan.</p>
              </div>

              {error && (
                <div role="alert" className="type-small flex items-start gap-3 rounded-[2px] border border-danger/30 bg-danger-soft p-4 text-ink">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                  {error === "OAuthAccountNotLinked"
                    ? "This email is already linked to a different sign-in method. Use that one to continue."
                    : "Sign-in did not complete. Try again, and if it keeps failing, email support@remawt.com."}
                </div>
              )}

              <Button
                size="lg"
                variant="secondary"
                block
                loading={pending}
                onClick={() => {
                  setPending(true);
                  void signIn("google", { callbackUrl });
                }}
              >
                {!pending && <GoogleMark />}
                Continue with Google
              </Button>

              <p className="type-caption text-subtle">
                By continuing you agree to the{" "}
                <Link href="/terms" className="text-muted underline decoration-rule-strong hover:text-ink">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-muted underline decoration-rule-strong hover:text-ink">
                  Privacy Policy
                </Link>
                .
              </p>
            </Card>
          </div>
        </Container>
      </main>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-surface text-muted">
          <Spinner size="md" />
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
