import { cookies } from "next/headers";
import type { Channel } from "@remawt/db";
import { IdentityKitSchema, SKIN_PRESETS } from "@remawt/shared";
import { prisma } from "@/lib/db/prisma";
import type { ShellChannel } from "@/components/layout/app-store";
import { parseKit } from "./shapes";
import { nicheName } from "./format";
import type { Viewer } from "./viewer";

/** Server source of truth for the active channel. ChannelSync (components/app) keeps it in step with the shell store. */
export const CHANNEL_COOKIE = "remawt_channel";

/** Dev bypass only: an in-memory channel so channel-scoped pages render their forms and empty states without a DB. */
function bypassChannel(): Channel {
  const skin = SKIN_PRESETS[0];
  const kit = IdentityKitSchema.parse({
    audience: "people in their 20s starting to save",
    promise: "one money idea explained visually in under a minute",
    skin,
    voice: { voiceId: "21m00Tcm4TlvDq8ikWAM", name: "Rachel" },
    persona: { tone: { formal: 0.35, energy: 0.6, humor: 0.3, density: 0.55 } },
  });
  const now = new Date();
  return { id: "dev-channel", userId: "dev-bypass", name: "Ledger Money", handle: "ledger.money", niche: "personal-finance", kit, timezone: "Europe/London", publisherProfileId: null, status: "ACTIVE", createdAt: now, updatedAt: now } as Channel;
}

export async function listChannels(viewer: Viewer): Promise<Channel[]> {
  if (viewer.bypass) return process.env.DEV_BYPASS_EMPTY === "1" ? [] : [bypassChannel()];
  return prisma.channel.findMany({ where: { userId: viewer.userId }, orderBy: { createdAt: "asc" } });
}

export async function getActiveChannel(viewer: Viewer, channels?: Channel[]): Promise<Channel | null> {
  const list = channels ?? (await listChannels(viewer));
  if (list.length === 0) return null;
  const wanted = (await cookies()).get(CHANNEL_COOKIE)?.value;
  return list.find((c) => c.id === wanted) ?? list.find((c) => c.status === "ACTIVE") ?? list[0];
}

export async function getOwnedChannel(viewer: Viewer, channelId: string): Promise<Channel | null> {
  if (viewer.bypass) return (await listChannels(viewer)).find((c) => c.id === channelId) ?? null;
  return prisma.channel.findFirst({ where: { id: channelId, userId: viewer.userId } });
}

export function toShellChannel(c: Channel): ShellChannel {
  const kit = parseKit(c.kit);
  return {
    id: c.id,
    name: c.name,
    niche: nicheName(c.niche),
    accent: kit?.skin.palette.accent ?? null,
    bg: kit?.skin.palette.bg ?? null,
  };
}
