"use client";

import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Primary CTA that adapts to session: "Open app" when signed in, Google sign-in otherwise. */
export function PrimaryCta({ label = "Build your channel", size = "lg" }: { label?: string; size?: "md" | "lg" }) {
  const { data: session, status } = useSession();
  if (session?.user) {
    return (
      <Button asChild size={size}>
        <Link href="/app">
          Open app <ArrowUpRight />
        </Link>
      </Button>
    );
  }
  return (
    <Button size={size} loading={status === "loading"} onClick={() => signIn("google", { callbackUrl: "/onboarding" })}>
      {label} <ArrowUpRight />
    </Button>
  );
}
