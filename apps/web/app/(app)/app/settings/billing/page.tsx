import { Grid, KeyValueList, PageHeader, Section, Stack, StatTile } from "@/components/layout";
import { Badge, Card, CardAction, CardDescription, CardHeader, CardTitle, Progress } from "@/components/ui";
import { AddonList, PlanGrid, PortalButton } from "@/components/app/plan-grid";
import { CheckoutNotice } from "@/components/app/checkout-notice";
import { prisma } from "@/lib/db/prisma";
import { loadEntitlements } from "@/lib/queries/billing";
import { formatDate } from "@/lib/queries/format";
import { getViewer } from "@/lib/queries/viewer";

export const metadata = { title: "Billing" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { checkout } = await searchParams;
  const viewer = await getViewer("/app/settings/billing");
  const [ent, sub] = await Promise.all([
    loadEntitlements(viewer),
    viewer.bypass ? null : prisma.subscription.findUnique({ where: { userId: viewer.userId }, select: { status: true, billing: true, currentPeriodEnd: true, cancelAtPeriodEnd: true } }),
  ]);
  const total = ent.allowance + ent.rollover;
  const pct = total ? (ent.videosUsed / total) * 100 : 0;
  const price = sub?.billing === "annual" ? ent.plan.annualMonthlyUsd : ent.plan.monthlyUsd;

  return (
    <>
      <CheckoutNotice status={checkout} />
      <PageHeader title="Billing" description="Your plan, this period’s usage, and add-on packs." actions={<PortalButton />} />

      <Grid cols="aside" gap={8}>
        <Card padding="md">
          <CardHeader>
            <CardTitle>{ent.plan.name} plan</CardTitle>
            <CardDescription>
              {ent.plan.id === "FREE"
                ? "Watermarked drafts, no auto-posting."
                : `$${price}/mo, billed ${sub?.billing === "annual" ? "yearly" : "monthly"}.`}
              {sub?.cancelAtPeriodEnd && sub.currentPeriodEnd ? ` Ends ${formatDate(sub.currentPeriodEnd, { month: "long", day: "numeric" })}.` : ""}
            </CardDescription>
            <CardAction>
              <Badge variant={ent.plan.id === "FREE" ? "neutral" : !sub || sub.status === "active" ? "success" : "warning"}>{ent.plan.id === "FREE" ? "Free" : (sub?.status ?? "active")}</Badge>
            </CardAction>
          </CardHeader>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="type-small text-muted">Videos this period</span>
              <span className="type-small tabular-nums text-ink">
                {ent.videosUsed} / {total}
              </span>
            </div>
            <Progress value={ent.videosUsed} max={Math.max(1, total)} tone={pct >= 100 ? "danger" : pct >= 80 ? "warning" : "accent"} size="sm" aria-label="Videos used" />
            <span className="type-caption text-subtle tabular-nums">Resets {formatDate(ent.periodEndsAt, { month: "long", day: "numeric" })}. Unused videos roll over one month.</span>
          </div>
          <KeyValueList
            items={[
              { label: "Channels", value: `${ent.channelsUsed} of ${ent.channelsAllowed}`, numeric: true },
              { label: "Rollover", value: ent.rollover, numeric: true },
              { label: "Re-renders per video", value: ent.plan.rerendersPerVideo, numeric: true },
              { label: "Max length", value: `${ent.plan.maxDurationSec}s`, numeric: true },
              { label: "Quality", value: <span className="capitalize">{ent.plan.quality}</span>, numeric: true },
              { label: "Auto-posting", value: ent.canPublish ? "Included" : "Paid plans", numeric: true },
            ]}
          />
        </Card>
        <Stack gap={4} className="self-start">
          <StatTile label="Videos left" value={ent.videosRemaining} />
          <StatTile label="Add-on credits" value={ent.creditBalance} hint="AI video clips and custom music" />
        </Stack>
      </Grid>

      <Section title="Plans" description="Change any time. Upgrades apply now; the new quota starts with your next period.">
        <PlanGrid mode="app" currentPlan={ent.plan.id} />
      </Section>

      <Section title="Add-on packs" description="One-time credits on top of your plan. They don’t expire.">
        <AddonList mode="app" />
      </Section>
    </>
  );
}
