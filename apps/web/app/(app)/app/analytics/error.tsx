"use client";

import { RouteError } from "@/components/app/route-states";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError what="analytics" error={error} reset={reset} />;
}
