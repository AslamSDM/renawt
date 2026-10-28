/** generateIdeas: delegates to @remawt/radar `ideasForChannel` (cards this/last week + kit + bandit format mix → validated Idea rows) with the Sonnet ideator. */
import { ideasForChannel } from "@remawt/radar";
import { db } from "../../lib/db.js";
import { withCallContext } from "../../lib/context.js";
import { runIdeator } from "../agents/radar.js";

export async function generateIdeas(channelId: string, opts: { count?: number; weekKey?: string } = {}): Promise<string[]> {
  const channel = await db().channel.findUnique({ where: { id: channelId } });
  if (!channel) throw new Error(`channel ${channelId} not found`);
  const r = await withCallContext({ channelId, userId: channel.userId, label: "ideas" }, () =>
    ideasForChannel({ channel: { id: channel.id, niche: channel.niche, kit: channel.kit }, prisma: db(), runIdeator: runIdeator as never, count: Math.min(20, Math.max(1, opts.count ?? 10)), weekKey: opts.weekKey }));
  return r.ideaIds;
}
