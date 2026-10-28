"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/components/layout/app-store";
import { setActiveChannel } from "@/lib/actions/channel";
import { toast } from "@/components/ui/toast";

/**
 * Keeps the server's active channel (cookie) in step with the shell's channel switcher.
 * When the user picks another channel in the sidebar, write the cookie and refresh server components.
 */
export function ChannelSync({ serverChannelId }: { serverChannelId: string | null }) {
  const router = useRouter();
  const activeId = useAppStore((s) => s.activeChannelId);
  const ready = useAppStore((s) => s.ready);
  const pending = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!ready || !activeId || activeId === serverChannelId || pending.current === activeId) return;
    pending.current = activeId;
    void setActiveChannel(activeId).then((res) => {
      pending.current = null;
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }, [activeId, ready, serverChannelId, router]);

  return null;
}
