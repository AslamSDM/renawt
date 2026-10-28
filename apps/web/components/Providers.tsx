"use client";

import { SessionProvider } from "next-auth/react";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useEffect } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        if (posthog.__loaded) return;
        posthog.init("phc_mtoVUHTDj3Bp8T7HfYAgecSRJ2GpaTsfswv9qeQc9Cgp", {
            api_host: "https://us.i.posthog.com",
            defaults: "2026-01-30",
        });
    }, []);

    return (
        <SessionProvider>
            <PostHogProvider client={posthog}>{children}</PostHogProvider>
        </SessionProvider>
    );
}
