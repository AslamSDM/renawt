"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";

/** Toast after returning from Dodo checkout, then drop the query param. */
export function CheckoutNotice({ status }: { status?: string }) {
  const router = useRouter();
  React.useEffect(() => {
    if (status !== "done") return;
    toast.success("Payment received. Your plan updates in a few seconds.");
    router.replace("/app/settings/billing", { scroll: false });
    const t = setTimeout(() => router.refresh(), 4000);
    return () => clearTimeout(t);
  }, [status, router]);
  return null;
}
