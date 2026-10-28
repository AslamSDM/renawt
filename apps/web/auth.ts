import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { getPlan } from "@remawt/shared";
import { prisma } from "@/lib/db/prisma";
import { sendWelcomeEmail } from "@/lib/email";

declare module "@auth/core/types" {
  interface User {
    creditBalance?: number;
  }
  interface Session {
    user: { id: string; creditBalance: number } & DefaultSession["user"];
  }
}

if (!process.env.AUTH_SECRET) {
  throw new Error("AUTH_SECRET environment variable is required");
}

const hasGoogle = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
if (!hasGoogle) {
  console.warn("[Auth] AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET not set; sign-in is disabled.");
}

const PROTECTED_PREFIXES = ["/app", "/onboarding"];

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  providers: hasGoogle
    ? [Google({ clientId: process.env.AUTH_GOOGLE_ID!, clientSecret: process.env.AUTH_GOOGLE_SECRET! })]
    : [],
  events: {
    async createUser({ user }) {
      if (user.id) {
        // Free plan quota (schema default is also 3; set explicitly in case plans change).
        await prisma.user
          .update({
            where: { id: user.id },
            data: { videoAllowance: getPlan("FREE").videosPerMonth, usagePeriodStart: new Date() },
          })
          .catch((e) => console.error("[Auth] failed to init allowance", e));
      }
      if (user.email) {
        await sendWelcomeEmail(user.email, user.name ?? null).catch((e) => console.error("[Auth] welcome email", e));
      }
    },
  },
  callbacks: {
    authorized({ auth: session, request }) {
      const { pathname } = request.nextUrl;
      if (pathname.startsWith("/api/")) {
        // API routes do their own 401 handling; don't redirect JSON callers to the sign-in page.
        return true;
      }
      const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
      return isProtected ? !!session?.user : true;
    },
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      if (token.sub) {
        try {
          const dbUser = await prisma.user.findUnique({ where: { id: token.sub }, select: { creditBalance: true } });
          if (dbUser) token.creditBalance = dbUser.creditBalance;
        } catch {
          // DB unavailable: keep stale value
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.creditBalance = (token.creditBalance as number | undefined) ?? 0;
      }
      return session;
    },
  },
});
