import * as React from "react";
import { AppShellData, type AppShellDataProps } from "@/components/layout/app-shell";
import { ChannelSync } from "@/components/app/channel-sync";
import { getActiveChannel, listChannels, toShellChannel } from "@/lib/queries/channels";
import { loadEntitlements } from "@/lib/queries/billing";
import { getViewer } from "@/lib/queries/viewer";

/** Feeds the AppShell (channel switcher, plan badge, usage meter) from the DB on every /app/* request. */
export default async function AppDataLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  let data: Omit<AppShellDataProps, "channels"> & { channels: NonNullable<AppShellDataProps["channels"]> } | null = null;
  try {
    const [channels, ent] = await Promise.all([listChannels(viewer), loadEntitlements(viewer)]);
    const active = await getActiveChannel(viewer, channels);
    data = {
      channels: channels.map(toShellChannel),
      activeChannelId: active?.id ?? null,
      plan: ent.plan.id,
      usage: { videosUsed: ent.videosUsed, videosLimit: ent.allowance + ent.rollover, resetsAt: ent.periodEndsAt.toISOString() },
    };
  } catch (e) {
    // The page itself will surface the error through its error.tsx; keep the chrome usable.
    console.error("[app/layout] shell data", e);
  }
  return (
    <>
      {data && (
        <>
          <AppShellData {...data} />
          <ChannelSync serverChannelId={data.activeChannelId ?? null} />
        </>
      )}
      {children}
    </>
  );
}
