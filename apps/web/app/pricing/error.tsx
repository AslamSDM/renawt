"use client";

import { Container } from "@/components/layout/container";
import { RouteError } from "@/components/app/route-states";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Container width="app" className="py-20">
      <RouteError what="pricing" error={error} reset={reset} />
    </Container>
  );
}
