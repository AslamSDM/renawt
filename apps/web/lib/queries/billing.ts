import { getPlan } from "@remawt/shared";
import { getEntitlements, type Entitlements } from "@/lib/billing";
import type { Viewer } from "./viewer";

/** Entitlements, or the Free plan defaults in dev bypass mode. */
export async function loadEntitlements(viewer: Viewer): Promise<Entitlements> {
  if (viewer.bypass) {
    const plan = getPlan(process.env.DEV_BYPASS_PLAN ?? "FREE");
    const end = new Date();
    end.setDate(end.getDate() + 30);
    return {
      plan,
      videosRemaining: plan.videosPerMonth,
      videosUsed: 0,
      allowance: plan.videosPerMonth,
      rollover: 0,
      channelsAllowed: plan.channels,
      channelsUsed: 0,
      creditBalance: 0,
      periodEndsAt: end,
      canPublish: plan.platforms !== 0,
      canClone: plan.voiceClone,
      quality: plan.quality,
    };
  }
  return getEntitlements(viewer.userId);
}

export const QUALITY_ORDER = ["draft", "standard", "premium"] as const;
export type Quality = (typeof QUALITY_ORDER)[number];
export function allowedQualities(max: Quality): Quality[] {
  return QUALITY_ORDER.slice(0, QUALITY_ORDER.indexOf(max) + 1);
}
