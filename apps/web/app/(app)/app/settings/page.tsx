import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout";
import { NoChannel } from "@/components/app/no-channel";
import { getActiveChannel } from "@/lib/queries/channels";
import { getViewer } from "@/lib/queries/viewer";

/** Sidebar "Channel settings" → the active channel's settings. */
export default async function SettingsRedirect({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const viewer = await getViewer("/app/settings");
  const channel = await getActiveChannel(viewer);
  if (channel) redirect(`/app/channels/${channel.id}/settings${tab ? `?tab=${encodeURIComponent(tab)}` : ""}`);
  return (
    <>
      <PageHeader title="Channel settings" description="Kit, connected accounts and channel controls." />
      <NoChannel what="channel settings" />
    </>
  );
}
