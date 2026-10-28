import * as React from "react";
import Link from "next/link";
import { Plus, Tv } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";

/** Shown by every channel-scoped page until the user has a channel. */
export function NoChannel({ what }: { what: string }) {
  return (
    <EmptyState
      icon={Tv}
      title={`Your ${what} will show up here`}
      description="Everything in Remawt belongs to a channel: its niche, look, voice and accounts. Set one up in about three minutes."
      action={
        <Button asChild>
          <Link href="/onboarding">
            <Plus /> Create a channel
          </Link>
        </Button>
      }
    />
  );
}
