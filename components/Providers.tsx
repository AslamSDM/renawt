"use client";

import { SessionProvider } from "next-auth/react";
import { Mentiq } from "mentiq-sdk";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <Mentiq
                apiKey={process.env.NEXT_PUBLIC_MENTIQ_API_KEY!}
                projectId={process.env.NEXT_PUBLIC_MENTIQ_PROJECT_ID!}
            >
                {children}
            </Mentiq>
        </SessionProvider>
    );
}
