import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus, Plus } from "lucide-react";
import { PLANS, type Plan } from "@remawt/shared";
import { Container, MarketingSection, PageShell } from "@/components/layout";
import { Button } from "@/components/ui";
import { AddonList, PlanGrid } from "@/components/app/plan-grid";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Plans for faceless video channels, priced per finished video. Free plan with 3 videos a month; paid plans post to TikTok, YouTube Shorts and Instagram Reels on schedule.",
  alternates: { canonical: "/pricing" },
};

const yes = <Check className="ml-auto size-4 text-accent" aria-label="Included" />;
const no = <Minus className="ml-auto size-4 text-subtle" aria-label="Not included" />;

const ROWS: { label: string; value: (p: Plan) => React.ReactNode }[] = [
  { label: "Channels", value: (p) => p.channels },
  { label: "Videos per month", value: (p) => p.videosPerMonth },
  { label: "Auto-post platforms", value: (p) => (p.platforms === 0 ? no : p.platforms === "all" ? "All" : p.platforms) },
  { label: "Max video length", value: (p) => `${p.maxDurationSec}s` },
  { label: "Render quality", value: (p) => <span className="capitalize">{p.quality}</span> },
  { label: "Free re-renders per video", value: (p) => p.rerendersPerVideo },
  { label: "Niche radar", value: (p) => (p.radar === "full" ? "Full" : "Limited") },
  { label: "Voice clone", value: (p) => (p.voiceClone ? yes : no) },
  { label: "Series autopilot", value: (p) => (p.id === "FREE" || p.id === "STARTER" ? no : yes) },
  { label: "Originality check", value: (p) => (p.id === "FREE" || p.id === "STARTER" ? no : yes) },
];

const FAQ = [
  { q: "What counts as a video?", a: "One finished render you keep. Re-renders of the same video are free up to your plan’s limit, and failed runs give the video back." },
  { q: "Do unused videos roll over?", a: "Yes, for one month. If you make 20 of 30 on Starter, next month you have 40." },
  { q: "Can I post myself instead?", a: "Always. Every plan can download the finished MP4 and its per-platform cuts. Paid plans can also post and schedule for you." },
  { q: "Will TikTok posts go out without me?", a: "No. TikTok requires you to choose privacy and confirm each post or batch. YouTube and Instagram can run on full autopilot if you want." },
  { q: "Can I cancel any time?", a: "Yes, from the billing portal. Your plan runs to the end of the period, and there’s a 7-day money-back window on first payments." },
];

export default function PricingPage() {
  const matrix = PLANS;
  return (
    <PageShell>
      <MarketingSection
        rule={false}
        titleAs="h1"
        title={
          <>
            Priced per video. <span className="font-serif-italic text-muted">Nothing to decode.</span>
          </>
        }
        lead="Every plan counts finished videos. Re-renders are included, unused videos roll over a month, and you can download every render on every plan."
      >
        <PlanGrid mode="marketing" />
      </MarketingSection>

      <MarketingSection id="compare" title="Compare plans" tone="wash">
        <div className="overflow-x-auto rounded-[2px] border border-rule bg-surface">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-rule">
                <th className="mono-tick h-12 px-4 font-normal">Feature</th>
                {matrix.map((p) => (
                  <th key={p.id} className="mono-tick h-12 px-4 text-right font-normal">
                    <span className={p.popular ? "text-accent" : undefined}>{p.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.label} className="border-b border-rule last:border-0">
                  <th scope="row" className="type-small h-12 px-4 font-normal text-muted">
                    {r.label}
                  </th>
                  {matrix.map((p) => (
                    <td key={p.id} className={`type-body h-12 px-4 text-right tabular-nums text-ink ${p.popular ? "bg-accent-soft" : ""}`}>
                      <span className="flex justify-end">{r.value(p)}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MarketingSection>

      <MarketingSection title="Add-on packs" lead="One-time credits for extras on any paid plan. They don’t expire.">
        <div className="max-w-[720px]">
          <AddonList mode="marketing" />
        </div>
      </MarketingSection>

      <MarketingSection id="faq" title="Billing questions">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <ul className="border-t border-rule lg:col-span-8 lg:col-start-5">
            {FAQ.map((f) => (
              <li key={f.q} className="border-b border-rule">
                <details className="group">
                  <summary className="type-heading flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-4 text-ink transition-colors hover:text-ink/80 [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <Plus className="size-4 shrink-0 text-muted transition-transform duration-200 ease-out-expo group-open:rotate-45" aria-hidden />
                  </summary>
                  <p className="type-body-lg max-w-[64ch] pb-6 text-muted">{f.a}</p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </MarketingSection>

      <section className="border-t border-rule py-20 md:py-32">
        <Container className="flex flex-col items-start gap-8">
          <h2 className="type-display max-w-[16ch] text-ink">
            Start with three videos. <span className="font-serif-italic text-muted">Free.</span>
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/signin?callbackUrl=/onboarding">Start free</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="/#formats">See the formats</Link>
            </Button>
          </div>
        </Container>
      </section>
    </PageShell>
  );
}
