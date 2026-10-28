import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * DEV_BYPASS_AUTH=1 (non-production only) lets the app pages render their empty states
 * without a database or a Google sign-in. Loaders in lib/queries skip Prisma when it is on.
 * The middleware still needs a session cookie; see docs/status/web-app.md.
 */
export const DEV_BYPASS = process.env.DEV_BYPASS_AUTH === "1" && process.env.NODE_ENV !== "production";

export interface Viewer {
  userId: string;
  name: string | null;
  email: string | null;
  bypass: boolean;
}

export async function getViewer(callbackUrl = "/app"): Promise<Viewer> {
  if (DEV_BYPASS) return { userId: "dev-bypass", name: "Dev", email: null, bypass: true };
  const session = await auth();
  if (!session?.user?.id) redirect(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  return { userId: session.user.id, name: session.user.name ?? null, email: session.user.email ?? null, bypass: false };
}

/** For server actions and route handlers: never redirects. */
export async function getViewerOrNull(): Promise<Viewer | null> {
  if (DEV_BYPASS) return { userId: "dev-bypass", name: "Dev", email: null, bypass: true };
  const session = await auth();
  if (!session?.user?.id) return null;
  return { userId: session.user.id, name: session.user.name ?? null, email: session.user.email ?? null, bypass: false };
}
