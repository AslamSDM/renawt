"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";
import { ErrorState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";

/** Body of every app route's error.tsx. Names the problem and the recovery; never prints the raw error. */
export function RouteError({ what, error, reset }: { what: string; error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error(`[app] ${what}`, error);
  }, [error, what]);
  return (
    <ErrorState
      title={`Couldn’t load ${what}.`}
      description={
        <>
          Something went wrong on our side. Try again; if it keeps happening, the reference below helps us find it.
          {error.digest && <span className="mono-tick mt-2 block tabular-nums">Ref {error.digest}</span>}
        </>
      }
      action={
        <Button onClick={reset} variant="outline">
          <RotateCcw /> Try again
        </Button>
      }
    />
  );
}
