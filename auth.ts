import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

// Check if required environment variables are set
const hasAuthConfig = process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET;

if (!hasAuthConfig) {
    console.warn("[Auth] Missing required environment variables. Authentication will be disabled.");
    console.warn("[Auth] Please set AUTH_SECRET, AUTH_GOOGLE_ID, and AUTH_GOOGLE_SECRET in your .env file");
}

export const { handlers, auth } = NextAuth({
    adapter: PrismaAdapter(prisma),
    secret: process.env.AUTH_SECRET || "fallback-secret-key-for-development-only",
    session: { strategy: "jwt" },
    providers: hasAuthConfig ? [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID!,
            clientSecret: process.env.AUTH_GOOGLE_SECRET!,
        }),
    ] : [],
    callbacks: {
        async session({ session, token }) {
            if (session.user && token.sub) {
                session.user.id = token.sub;
            }
            return session;
        },
    },
});
