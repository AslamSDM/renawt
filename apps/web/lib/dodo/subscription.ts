import { ADDONS, PLANS, getPlan, type Plan, type PlanId } from "@remawt/shared";

export type Billing = "monthly" | "annual";
export type PaidPlanId = Exclude<PlanId, "FREE">;
export type AddonId = (typeof ADDONS)[number]["id"];
export type Addon = (typeof ADDONS)[number];

export const PAID_PLAN_IDS = PLANS.filter((p) => p.id !== "FREE").map((p) => p.id) as PaidPlanId[];
export const ADDON_IDS = ADDONS.map((a) => a.id) as AddonId[];

export function isPaidPlanId(id: unknown): id is PaidPlanId {
  return typeof id === "string" && (PAID_PLAN_IDS as string[]).includes(id);
}
export function isAddonId(id: unknown): id is AddonId {
  return typeof id === "string" && (ADDON_IDS as string[]).includes(id);
}

/** Env var holding the Dodo product id, e.g. DODO_PRODUCT_CREATOR_ANNUAL. */
export function planProductEnvName(planId: PaidPlanId, billing: Billing): string {
  return `DODO_PRODUCT_${planId}_${billing === "annual" ? "ANNUAL" : "MONTHLY"}`;
}
/** Env var holding the Dodo product id, e.g. DODO_PRODUCT_ADDON_AI_VIDEO_CLIPS_10. */
export function addonProductEnvName(addonId: AddonId): string {
  return `DODO_PRODUCT_ADDON_${addonId}`;
}

export function planProductId(planId: PaidPlanId, billing: Billing): string | undefined {
  return process.env[planProductEnvName(planId, billing)] || undefined;
}
export function addonProductId(addonId: AddonId): string | undefined {
  return process.env[addonProductEnvName(addonId)] || undefined;
}

export type CatalogEntry =
  | { kind: "plan"; plan: Plan; billing: Billing; productId: string }
  | { kind: "addon"; addon: Addon; productId: string };

/** Reverse lookup: Dodo product id -> plan/addon. */
export function resolveProduct(productId: string | null | undefined): CatalogEntry | null {
  if (!productId) return null;
  for (const planId of PAID_PLAN_IDS) {
    for (const billing of ["monthly", "annual"] as const) {
      if (planProductId(planId, billing) === productId) {
        return { kind: "plan", plan: getPlan(planId), billing, productId };
      }
    }
  }
  for (const addon of ADDONS) {
    if (addonProductId(addon.id as AddonId) === productId) return { kind: "addon", addon, productId };
  }
  return null;
}

export function getAddon(id: AddonId): Addon {
  const a = ADDONS.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown addon: ${id}`);
  return a;
}
