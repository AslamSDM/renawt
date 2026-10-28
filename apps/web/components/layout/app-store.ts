"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { PlanId } from "@remawt/shared";

/**
 * Client store for AppShell chrome (channel switcher, usage meter, plan badge).
 * The web-app agent hydrates it from server data with <AppShellData /> or
 * useAppStore.getState().hydrate(...). The shell renders with no data.
 */
export interface ShellChannel {
  id: string;
  name: string;
  niche?: string | null;
  /** Kit accent hex, used for the switcher swatch. */
  accent?: string | null;
  /** Kit background hex. */
  bg?: string | null;
  avatarUrl?: string | null;
}

export interface ShellUsage {
  videosUsed: number;
  videosLimit: number;
  /** ISO date the quota resets. */
  resetsAt?: string | null;
}

interface AppState {
  channels: ShellChannel[];
  activeChannelId: string | null;
  plan: PlanId;
  usage: ShellUsage | null;
  /** True once server data has been pushed in. Lets the shell show skeletons first. */
  ready: boolean;
  setChannels: (channels: ShellChannel[]) => void;
  setActiveChannel: (id: string) => void;
  setPlan: (plan: PlanId) => void;
  setUsage: (usage: ShellUsage | null) => void;
  hydrate: (data: Partial<Pick<AppState, "channels" | "activeChannelId" | "plan" | "usage">>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      channels: [],
      activeChannelId: null,
      plan: "FREE",
      usage: null,
      ready: false,
      setChannels: (channels) => {
        const active = get().activeChannelId;
        set({ channels, activeChannelId: channels.some((c) => c.id === active) ? active : channels[0]?.id ?? null });
      },
      setActiveChannel: (id) => set({ activeChannelId: id }),
      setPlan: (plan) => set({ plan }),
      setUsage: (usage) => set({ usage }),
      hydrate: (data) => {
        const channels = data.channels ?? get().channels;
        const wanted = data.activeChannelId ?? get().activeChannelId;
        set({
          ...data,
          channels,
          activeChannelId: channels.some((c) => c.id === wanted) ? wanted : channels[0]?.id ?? null,
          ready: true,
        });
      },
    }),
    {
      name: "remawt-shell",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ activeChannelId: s.activeChannelId }),
      skipHydration: true,
    },
  ),
);

export function useActiveChannel(): ShellChannel | null {
  return useAppStore((s) => s.channels.find((c) => c.id === s.activeChannelId) ?? null);
}
