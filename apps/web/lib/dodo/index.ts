import { getDodoClient } from "./client";
import {
  addonProductEnvName,
  addonProductId,
  isAddonId,
  isPaidPlanId,
  planProductEnvName,
  planProductId,
  type AddonId,
  type Billing,
  type PaidPlanId,
} from "./subscription";

export * from "./subscription";
export { getDodoClient } from "./client";

/** Metadata attached to every checkout session; echoed back on webhooks. */
export type CheckoutMetadata = {
  userId: string;
  kind: "plan" | "addon";
  planId?: PaidPlanId;
  addonId?: AddonId;
  billing?: Billing;
};

export class CheckoutConfigError extends Error {}

export async function createCheckoutSession(
  userId: string,
  item: PaidPlanId | AddonId,
  billing: Billing = "monthly",
  opts: { email?: string | null; name?: string | null; returnUrl?: string } = {},
) {
  let productId: string | undefined;
  let metadata: CheckoutMetadata;
  if (isPaidPlanId(item)) {
    productId = planProductId(item, billing);
    if (!productId) throw new CheckoutConfigError(`${planProductEnvName(item, billing)} is not set`);
    metadata = { userId, kind: "plan", planId: item, billing };
  } else if (isAddonId(item)) {
    productId = addonProductId(item);
    if (!productId) throw new CheckoutConfigError(`${addonProductEnvName(item)} is not set`);
    metadata = { userId, kind: "addon", addonId: item };
  } else {
    throw new CheckoutConfigError(`Unknown plan or addon: ${String(item)}`);
  }

  const dodo = getDodoClient();
  return dodo.checkoutSessions.create({
    product_cart: [{ product_id: productId, quantity: 1 }],
    metadata: metadata as unknown as Record<string, string>,
    ...(opts.email ? { customer: { email: opts.email, name: opts.name ?? undefined } } : {}),
    return_url: opts.returnUrl || process.env.DODO_PAYMENTS_RETURN_URL || "https://remawt.com/app/billing",
  });
}

/** Customer portal link (manage card, cancel, invoices). */
export async function createPortalLink(customerId: string, returnUrl?: string): Promise<string> {
  const dodo = getDodoClient();
  const session = await dodo.customers.customerPortal.create(customerId, returnUrl ? { return_url: returnUrl } : undefined);
  return session.link;
}
