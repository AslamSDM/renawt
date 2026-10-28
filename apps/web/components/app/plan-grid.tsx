"use client";

import * as React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { ADDONS, PLANS, type PlanId } from "@remawt/shared";
import { cn } from "@/lib/utils";
import { Badge, Button, Tabs, TabsList, TabsTrigger, toast } from "@/components/ui";

type Billing = "monthly" | "annual";

async function checkout(body: { planId?: string; addonId?: string; billing: Billing }) {
  try {
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, returnUrl: `${window.location.origin}/app/settings/billing?checkout=done` }),
    });
    const data: unknown = await res.json().catch(() => null);
    if (res.status === 401) {
      window.location.assign(`/signin?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (!res.ok || !data || typeof data !== "object" || !("checkout_url" in data) || typeof data.checkout_url !== "string") {
      const msg = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "Checkout isn’t available right now.";
      toast.error(msg);
      return;
    }
    window.location.assign(data.checkout_url);
  } catch {
    toast.error("Network error. Try again.");
  }
}

export function BillingToggle({ value, onChange }: { value: Billing; onChange: (b: Billing) => void }) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as Billing)}>
      <TabsList variant="segmented" aria-label="Billing period">
        <TabsTrigger value="monthly">Monthly</TabsTrigger>
        <TabsTrigger value="annual">
          Yearly <span className="text-success">−20%</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

/**
 * Plan columns. mode="app" starts Dodo checkout; mode="marketing" links to sign-in/onboarding.
 * Ruled columns in one band (DESIGN.md §10), not separate cards.
 */
export function PlanGrid({
  mode,
  currentPlan,
  billing: controlled,
  onBillingChange,
  showToggle = true,
  plans = PLANS,
}: {
  mode: "app" | "marketing";
  currentPlan?: PlanId;
  billing?: Billing;
  onBillingChange?: (b: Billing) => void;
  showToggle?: boolean;
  plans?: typeof PLANS;
}) {
  const [own, setOwn] = React.useState<Billing>("monthly");
  const billing = controlled ?? own;
  const setBilling = onBillingChange ?? setOwn;
  const [busy, setBusy] = React.useState<string | null>(null);
  const cols = plans.length >= 5 ? "lg:grid-cols-5" : plans.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3";

  return (
    <div className="flex flex-col gap-6">
      {showToggle && <BillingToggle value={billing} onChange={setBilling} />}
      <ul className={cn("grid grid-cols-1 overflow-hidden rounded-[2px] border border-rule bg-paper sm:grid-cols-2", cols)}>
        {plans.map((p, i) => {
          const price = billing === "annual" ? p.annualMonthlyUsd : p.monthlyUsd;
          const current = currentPlan === p.id;
          const rank = PLANS.findIndex((x) => x.id === p.id);
          const currentRank = currentPlan ? PLANS.findIndex((x) => x.id === currentPlan) : -1;
          return (
            <li
              key={p.id}
              className={cn(
                "relative flex flex-col gap-6 border-rule p-6",
                i > 0 && "border-t sm:border-t-0",
                i % 2 === 1 && "sm:border-l",
                i >= 2 && "sm:border-t lg:border-t-0",
                i >= 1 && "lg:border-l",
                p.popular && "bg-accent-soft",
              )}
            >
              {p.popular && <span className="absolute inset-x-0 top-0 h-px bg-accent" aria-hidden />}
              <div className="flex items-center justify-between gap-2">
                <h3 className="type-subheading text-ink">{p.name}</h3>
                {current ? <Badge variant="success">Current</Badge> : p.popular ? <Badge variant="accent">Most popular</Badge> : null}
              </div>
              <div className="flex flex-col gap-1">
                <p className="flex items-baseline gap-1">
                  <span className="type-stat text-ink">${price}</span>
                  <span className="type-small text-muted">/ mo</span>
                </p>
                <p className="type-caption tabular-nums text-subtle">
                  {p.monthlyUsd === 0 ? "Free forever" : billing === "annual" ? `$${p.annualMonthlyUsd * 12} billed yearly` : `or $${p.annualMonthlyUsd}/mo yearly`}
                </p>
              </div>
              <ul className="flex flex-col gap-2 border-t border-rule pt-4">
                {p.features.map((f) => (
                  <li key={f} className="type-small flex items-start gap-2 text-muted">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                {mode === "marketing" ? (
                  <Button asChild block variant={p.popular ? "primary" : "outline"}>
                    <Link href={p.id === "FREE" ? "/signin?callbackUrl=/onboarding" : `/signin?callbackUrl=${encodeURIComponent(`/app/settings/billing?plan=${p.id}&billing=${billing}`)}`}>
                      {p.id === "FREE" ? "Start free" : `Choose ${p.name}`}
                    </Link>
                  </Button>
                ) : current ? (
                  <Button block variant="ghost" disabled>
                    Your plan
                  </Button>
                ) : p.id === "FREE" ? (
                  <Button block variant="ghost" disabled>
                    {currentRank > 0 ? "Downgrade in portal" : "Free"}
                  </Button>
                ) : (
                  <Button
                    block
                    variant={p.popular ? "primary" : "outline"}
                    loading={busy === p.id}
                    onClick={async () => {
                      setBusy(p.id);
                      await checkout({ planId: p.id, billing });
                      setBusy(null);
                    }}
                  >
                    {rank > currentRank ? `Upgrade to ${p.name}` : `Switch to ${p.name}`}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AddonList({ mode }: { mode: "app" | "marketing" }) {
  const [busy, setBusy] = React.useState<string | null>(null);
  return (
    <ul className="flex flex-col overflow-hidden rounded-[2px] border border-rule bg-paper">
      {ADDONS.map((a) => (
        <li key={a.id} className="flex min-h-16 flex-wrap items-center justify-between gap-4 border-b border-rule px-5 py-3 last:border-0">
          <span className="flex flex-col">
            <span className="type-body text-ink">{a.name}</span>
            <span className="type-caption text-muted tabular-nums">
              ${a.usd} one-time · ${(a.usd / a.credits).toFixed(2)} each
            </span>
          </span>
          {mode === "app" ? (
            <Button
              size="sm"
              variant="outline"
              loading={busy === a.id}
              onClick={async () => {
                setBusy(a.id);
                await checkout({ addonId: a.id, billing: "monthly" });
                setBusy(null);
              }}
            >
              Buy for ${a.usd}
            </Button>
          ) : (
            <span className="type-stat text-ink">${a.usd}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function PortalButton() {
  const [pending, setPending] = React.useState(false);
  return (
    <Button
      variant="outline"
      loading={pending}
      onClick={async () => {
        setPending(true);
        try {
          const res = await fetch("/api/billing/portal", { method: "POST" });
          const data: unknown = await res.json().catch(() => null);
          if (res.ok && data && typeof data === "object" && "url" in data && typeof data.url === "string") return void window.location.assign(data.url);
          const msg =
            res.status === 404
              ? "No invoices yet. They appear here after your first payment."
              : res.status === 501
                ? "The billing portal isn’t available yet. Email support for invoices."
                : data && typeof data === "object" && "error" in data && typeof data.error === "string"
                  ? data.error
                  : "Couldn’t open the billing portal.";
          toast.error(msg);
        } catch {
          toast.error("Network error. Try again.");
        } finally {
          setPending(false);
        }
      }}
    >
      Invoices and payment method
    </Button>
  );
}
