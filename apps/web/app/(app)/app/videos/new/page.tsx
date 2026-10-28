import { redirect } from "next/navigation";

/** APP_ROUTES.newVideo points here; the form lives at /app/new. */
export default async function NewVideoAlias({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === "string") sp.set(k, v);
  const qs = sp.toString();
  redirect(`/app/new${qs ? `?${qs}` : ""}`);
}
