import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Plus } from "lucide-react";
import { FORMATS, PLANS, SKIN_PRESETS } from "@remawt/shared";
import { PageShell } from "@/components/layout/page-shell";
import { Container } from "@/components/layout/container";
import { MarketingSection } from "@/components/layout/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Typewriter } from "./_landing/typewriter";
import { PrimaryCta } from "./_landing/hero-cta";
import { FormatScene, FORMAT_SKIN, HeroScene, skinById } from "./_landing/scenes";
import { fontStack, skinFontVars } from "./_landing/fonts";

/* ─── Content ─────────────────────────────────────────────────────────── */

const RENDER_LOG = [
  { step: "Idea", detail: "Radar card · history", t: "00:02" },
  { step: "Script", detail: "Persona · The Ledger", t: "00:19" },
  { step: "Voice", detail: "41s narration", t: "00:31" },
  { step: "Compose", detail: "7 scenes, beat-snapped", t: "01:48" },
  { step: "Render", detail: "1080 × 1920", t: "02:40", live: true },
];

const STEPS = [
  {
    n: "1",
    title: "Pick a niche",
    body: "Search around 150 niches, from personal finance to ancient history. The niche sets your formats, sources and guardrails.",
    art: "niche",
  },
  {
    n: "2",
    title: "Build the Identity Kit",
    body: "Choose a skin, a voice and a narrator persona once. Add a recurring mascot if you want one. Every video wears it.",
    art: "kit",
  },
  {
    n: "3",
    title: "Approve Radar ideas",
    body: "Each week the Radar ranks what is breaking out in your niche and drafts ten ideas in your persona. Keep the good ones.",
    art: "ideas",
  },
  {
    n: "4",
    title: "Posts go out on schedule",
    body: "Approved ideas become finished shorts and publish to TikTok, Shorts and Reels at the times you set. Edit any scene first.",
    art: "schedule",
  },
] as const;

const TRENDS = [
  {
    topic: "Why groceries cost more than in 2019",
    format: "This Chart Explains",
    hook: "A number that sounds wrong",
    outlier: "7.2×",
    velocity: "18.4k/h",
    platforms: ["YT", "TT"],
    ideas: 3,
  },
  {
    topic: "Index funds vs picking stocks",
    format: "X vs Y",
    hook: "Which wins?",
    outlier: "5.6×",
    velocity: "9.1k/h",
    platforms: ["YT", "IG", "TT"],
    ideas: 4,
  },
  {
    topic: "Credit score myths",
    format: "Mythbust",
    hook: "Stop believing…",
    outlier: "5.1×",
    velocity: "6.7k/h",
    platforms: ["TT"],
    ideas: 2,
  },
];

const FAQ = [
  {
    q: "Will AI-made videos get my channel demonetized?",
    a: "YouTube’s inauthentic-content rule targets mass-produced, repetitive uploads. Remawt varies layouts within your kit, scores each script against your last 30 uploads, puts sources on screen in data-heavy niches, and sets AI-disclosure labels for you. No tool can promise monetization; we build to the rules as they are written.",
  },
  {
    q: "Can I edit a video before it posts?",
    a: "Yes. Every scene is HTML, so you can change any line of text, number or asset and re-render. Re-renders are free: 3 per video on Starter and Creator, 5 on Pro and Agency.",
  },
  {
    q: "Which platforms does it post to?",
    a: "TikTok, YouTube Shorts and Instagram Reels. Starter posts to 3 platforms, Creator and up to every supported platform. TikTok posts always pass through a quick batch approval, as TikTok requires.",
  },
  {
    q: "What is the refund policy?",
    a: "7-day money-back on your first payment. Unused videos roll over for one month. Full terms are on the refund page.",
  },
  {
    q: "Whose voice narrates the videos?",
    a: "Pick from a library of natural voices on any paid plan and tune speed and stability per channel. Creator and up can clone their own voice.",
  },
  {
    q: "Who is Remawt for?",
    a: "People who know a niche (finance, history, science, psychology, tech) and do not want to film or animate. Founders use it for product explainers too.",
  },
];

/* ─── Small pieces ────────────────────────────────────────────────────── */

function StepArt({ kind }: { kind: (typeof STEPS)[number]["art"] }) {
  if (kind === "niche")
    return (
      <div className="flex flex-wrap gap-1.5">
        {["Personal finance", "History", "AI explained", "Psychology"].map((n, i) => (
          <span
            key={n}
            className={cn(
              "type-caption inline-flex h-7 items-center gap-1.5 rounded-[2px] border px-2",
              i === 1 ? "border-accent-line bg-accent-soft text-ink" : "border-rule text-muted",
            )}
          >
            {i === 1 && <Check className="size-3 text-accent" aria-hidden />}
            {n}
          </span>
        ))}
      </div>
    );
  if (kind === "kit") {
    const s = skinById("paper");
    return (
      <div className="flex items-center gap-3">
        <div className="flex">
          {[s.palette.bg, s.palette.ink, s.palette.accent].map((c) => (
            <span key={c} className="-mr-1.5 size-7 rounded-full border-2 border-paper" style={{ background: c }} />
          ))}
        </div>
        <div className="flex h-7 flex-1 items-center gap-[3px]" aria-hidden>
          {[30, 60, 90, 45, 70, 100, 55, 35, 80, 50, 65, 40, 85, 30, 60].map((h, i) => (
            <span key={i} className="w-full rounded-full bg-muted" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    );
  }
  if (kind === "ideas")
    return (
      <ul className="flex flex-col gap-1.5">
        {[
          { t: "Why groceries cost more", s: "8.4" },
          { t: "Index funds vs stocks", s: "7.9" },
        ].map((r) => (
          <li key={r.t} className="type-caption flex h-7 items-center justify-between gap-2 rounded-[2px] border border-rule px-2 text-muted">
            <span className="truncate">{r.t}</span>
            <span className="font-mono tabular-nums text-ink">{r.s}</span>
          </li>
        ))}
      </ul>
    );
  return (
    <div className="grid grid-cols-5 gap-1">
      {["M", "T", "W", "T", "F"].map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <span className="mono-tick">{d}</span>
          <span className={cn("grid h-7 w-full place-items-center rounded-[2px] border font-mono text-[10px] tabular-nums", i === 4 ? "border-rule text-subtle" : "border-accent-line bg-accent-soft text-ink")}>
            18:00
          </span>
        </div>
      ))}
    </div>
  );
}

function BeatBar({ beats }: { beats: { id: string; label: string; share: number }[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-1.5 gap-0.5" aria-hidden>
        {beats.map((b, i) => (
          <span key={b.id} className={cn("h-full rounded-full", i === 0 ? "bg-accent" : "bg-rule-strong")} style={{ width: `${b.share * 100}%` }} />
        ))}
      </div>
      <p className="type-caption text-subtle">{beats.map((b) => b.label).join(" · ")}</p>
    </div>
  );
}

function OriginalityGrid() {
  // 30 last uploads; similarity buckets (illustrative).
  const sims = [1, 0, 0, 1, 0, 2, 0, 0, 1, 0, 0, 0, 1, 0, 0, 2, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 3];
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-10 gap-1" aria-hidden>
        {sims.map((s, i) => (
          <span
            key={i}
            className={cn(
              "aspect-square rounded-[1px]",
              s === 0 && "bg-paper-3",
              s === 1 && "bg-rule-strong",
              s === 2 && "bg-warning/60",
              s === 3 && "bg-danger ring-1 ring-danger ring-offset-2 ring-offset-paper",
            )}
          />
        ))}
      </div>
      <p className="type-caption text-muted">Last 30 uploads. The newest draft (bottom right) is too close to one from last week, so it is sent back for a new structure.</p>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const tiers = PLANS.filter((p) => p.id !== "AGENCY");
  const agency = PLANS.find((p) => p.id === "AGENCY");

  return (
    <PageShell offsetNav={false} className={skinFontVars}>
      {/* Hero */}
      <section className="relative isolate overflow-hidden pb-20 pt-28 md:pb-32 md:pt-40">
        <div className="kinetic-dotgrid pointer-events-none absolute inset-0 -z-10" aria-hidden />
        <div className="kinetic-glow pointer-events-none absolute -top-72 left-1/2 -z-10 h-[800px] w-[1200px] -translate-x-1/2" aria-hidden />
        <Container className="grid grid-cols-1 items-center gap-16 lg:grid-cols-12 lg:gap-8">
          <div className="flex flex-col gap-8 lg:col-span-7">
            <h1 className="type-display-xl text-ink">
              <span className="block min-h-[1.96em]">
                <Typewriter />
              </span>
              <span className="block text-muted">
                becomes a <span className="text-accent">video.</span>
              </span>
            </h1>
            <p className="type-body-lg max-w-[54ch] text-muted">
              Pick a niche and set your channel’s look, voice and persona once. Remawt finds what is breaking out in your niche, turns it into motion-graphics shorts, and posts them on schedule.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <PrimaryCta />
              <Button asChild size="lg" variant="outline">
                <Link href="#formats">See the formats</Link>
              </Button>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 border-t border-rule pt-6">
              {["9:16 · 1080 × 1920", "30–90 s", "TikTok · Shorts · Reels", "Free: 3 videos"].map((t) => (
                <li key={t} className="mono-tick tabular-nums">
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto flex w-full max-w-[460px] items-center justify-center gap-6 lg:col-span-5">
            <HeroScene className="w-[min(72vw,300px)] shrink-0 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9),0_20px_60px_-20px_rgba(59,130,246,0.25)]" />
            <ol className="hidden w-40 shrink-0 flex-col gap-4 sm:flex" aria-label="Example render log">
              {RENDER_LOG.map((r) => (
                <li key={r.step} className="flex flex-col gap-0.5 border-l border-rule pl-3">
                  <span className="mono-label flex items-center gap-2">
                    {r.live ? <span className="rec-dot" aria-hidden /> : <Check className="size-3 text-success" aria-hidden />}
                    {r.step}
                  </span>
                  <span className="type-caption text-muted">{r.detail}</span>
                  <span className="mono-tick tabular-nums">{r.t}</span>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      {/* How it works */}
      <MarketingSection
        id="product"
        title={
          <>
            One setup. <span className="font-serif-italic text-muted">Then a channel that keeps posting.</span>
          </>
        }
        lead="You decide the niche and the identity. Remawt does the research, writing, voice, motion design and posting, and asks before anything goes live."
      >
        <ol className="grid grid-cols-1 border-y border-rule sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li
              key={s.n}
              className={cn(
                "flex flex-col gap-6 py-8 sm:px-6 lg:py-10",
                i > 0 && "border-t border-rule sm:border-t-0",
                i % 2 === 1 && "sm:border-l sm:border-rule",
                i >= 2 && "sm:border-t lg:border-t-0",
                i === 2 && "lg:border-l lg:border-rule",
                i === 0 && "sm:pl-0",
              )}
            >
              <span className="font-mono text-sm tabular-nums text-accent">{s.n}</span>
              <div className="flex flex-col gap-2">
                <h3 className="type-heading text-ink">{s.title}</h3>
                <p className="type-small text-muted">{s.body}</p>
              </div>
              <div className="mt-auto pt-2">
                <StepArt kind={s.art} />
              </div>
            </li>
          ))}
        </ol>
      </MarketingSection>

      {/* Formats */}
      <MarketingSection
        id="formats"
        tone="wash"
        title="Six formats built for retention, not slideshows."
        lead="Each format is a beat grammar: a hook in the first two seconds, a fixed number of body beats, a payoff and a loop back. Cuts snap to the music."
      >
        <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-6">
          {FORMATS.map((f) => {
            const skin = skinById(FORMAT_SKIN[f.id] ?? "ledger");
            return (
              <li key={f.id} className="flex min-w-0 flex-col gap-4">
                <FormatScene formatId={f.id} className="w-full" />
                <div className="flex flex-col gap-1">
                  <h3 className="type-subheading text-ink">{f.name}</h3>
                  <p className="type-small text-muted">{f.tagline}</p>
                </div>
                <BeatBar beats={f.beats} />
                <p className="mono-tick tabular-nums">
                  {f.minSec}–{f.maxSec}s · {skin.name} skin
                </p>
              </li>
            );
          })}
        </ul>
      </MarketingSection>

      {/* Identity Kit */}
      <MarketingSection
        id="identity"
        title={
          <>
            Your channel looks like <span className="font-serif-italic">your channel.</span>
          </>
        }
        lead="The Identity Kit fixes palette, type, motion, captions, voice and narrator persona. Content changes every video; the identity never drifts. Start from a skin, then tune it."
      >
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SKIN_PRESETS.map((s) => {
            const { bg, surface, ink, accent } = s.palette;
            const accent2 = s.palette.accent2;
            const radius = s.shapes === "pill" ? "999px" : s.shapes === "rounded" ? "10px" : "2px";
            return (
              <li key={s.id} className="flex flex-col overflow-hidden rounded-[2px] border border-rule bg-paper">
                <div className="relative flex h-48 flex-col justify-between p-6" style={{ background: bg, color: ink }}>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-[44px] leading-none" style={{ fontFamily: fontStack(s.type.display) }}>
                      Aa
                    </span>
                    <span className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ background: accent, color: bg, borderRadius: radius }}>
                      {s.motion}
                    </span>
                  </div>
                  <div className="flex items-end justify-between gap-4">
                    <p className="max-w-[18ch] text-[20px] leading-tight tracking-[-0.01em]" style={{ fontFamily: fontStack(s.type.display) }}>
                      The one idea, <span style={{ color: accent }}>explained.</span>
                    </p>
                    <span className="h-10 w-16 shrink-0" style={{ background: surface, borderRadius: radius, boxShadow: `inset 0 -4px 0 ${accent2 ?? accent}` }} aria-hidden />
                  </div>
                </div>
                <div className="flex flex-col gap-4 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="type-subheading text-ink">{s.name}</h3>
                    <span className="type-caption truncate text-muted">
                      {s.type.display}
                      {s.type.display !== s.type.body ? ` / ${s.type.body}` : ""}
                    </span>
                  </div>
                  <ul className="flex gap-1.5" aria-label={`${s.name} palette`}>
                    {[bg, surface, ink, accent, accent2].filter(Boolean).map((c, i) => (
                      <li key={`${c}-${i}`} className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <span className="h-6 rounded-[2px] border border-rule" style={{ background: c }} />
                        <span className="truncate font-mono text-[10px] uppercase text-subtle">{c?.replace("#", "")}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mono-tick">
                    Captions {s.captionStyle} · {s.shapes} · {s.grain ? "grain" : "clean"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        <dl className="mt-10 grid grid-cols-1 gap-6 border-t border-rule pt-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Look", "Palette, type pair, motion style, caption style, intro and outro sting."],
            ["Voice", "Library voice tuned for speed and stability. Clone your own on Creator."],
            ["Persona", "Tone sliders, point of view, signature phrases and words to avoid."],
            ["Mascot", "Optional recurring character drawn once, reused in every video."],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1.5">
              <dt className="type-subheading text-ink">{k}</dt>
              <dd className="type-small text-muted">{v}</dd>
            </div>
          ))}
        </dl>
      </MarketingSection>

      {/* Niche Radar */}
      <MarketingSection
        id="radar"
        tone="wash"
        title="Know what your niche wants this week."
        lead="Niche Radar watches YouTube, TikTok, Reddit and search trends. It flags videos running far above their creator’s usual numbers, groups them into trends, and drafts ideas for your channel with the evidence attached."
        bodyClassName="flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="mono-label">Personal finance · week 44</p>
          <span className="mono-tick">Example data</span>
        </div>
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {TRENDS.map((t, i) => (
            <li key={t.topic} className={cn("flex flex-col gap-5 rounded-[2px] border bg-surface p-6", i === 0 ? "border-accent-line" : "border-rule")}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={i === 0 ? "accent" : "neutral"}>{t.format}</Badge>
                {t.platforms.map((p) => (
                  <Badge key={p} variant="outline">
                    {p}
                  </Badge>
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
                <h3 className="type-heading text-ink">{t.topic}</h3>
                <p className="type-small text-muted">Hook: {t.hook}</p>
              </div>
              <dl className="grid grid-cols-2 gap-4 border-t border-rule pt-4">
                <div className="flex flex-col gap-1">
                  <dt className="mono-tick">Outlier</dt>
                  <dd className="type-stat text-ink">{t.outlier}</dd>
                  <dd className="type-caption text-subtle">vs creator median</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="mono-tick">Velocity</dt>
                  <dd className="type-stat text-ink">{t.velocity}</dd>
                  <dd className="type-caption text-subtle">views per hour</dd>
                </div>
              </dl>
              <div className="mt-auto flex items-center justify-between gap-3 border-t border-rule pt-4">
                <span className="type-small text-muted tabular-nums">{t.ideas} ideas drafted</span>
                <span className="type-small inline-flex items-center gap-1 text-ink">
                  Review <ArrowRight className="size-3.5" aria-hidden />
                </span>
              </div>
            </li>
          ))}
        </ul>
      </MarketingSection>

      {/* Monetization-safe */}
      <MarketingSection
        id="safe"
        title={
          <>
            Monetization-safe <span className="font-serif-italic text-muted">by default.</span>
          </>
        }
        lead="Platforms are removing channels that pump out near-identical AI videos. Remawt is built to stay on the right side of those rules."
      >
        <div className="grid grid-cols-1 border-y border-rule lg:grid-cols-3">
          <div className="flex flex-col gap-6 py-8 lg:py-10 lg:pr-8">
            <div className="flex flex-col gap-2">
              <h3 className="type-heading text-ink">Originality score</h3>
              <p className="type-small text-muted">Every script, structure and visual fingerprint is compared with your last 30 uploads before it renders.</p>
            </div>
            <OriginalityGrid />
          </div>
          <div className="flex flex-col gap-6 border-t border-rule py-8 lg:border-l lg:border-t-0 lg:px-8 lg:py-10">
            <div className="flex flex-col gap-2">
              <h3 className="type-heading text-ink">Labels set for you</h3>
              <p className="type-small text-muted">AI-disclosure flags go on automatically when a video shows realistic AI people or scenes. Finance and health niches never get an “AI advisor” persona.</p>
            </div>
            <ul className="flex flex-col">
              {[
                ["YouTube · synthetic media", "Auto"],
                ["TikTok · AI-generated", "Auto"],
                ["On-screen sources", "On"],
              ].map(([k, v]) => (
                <li key={k} className="flex h-10 items-center justify-between gap-4 border-b border-rule last:border-b-0">
                  <span className="type-small text-muted">{k}</span>
                  <span className="mono-label">{v}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-6 border-t border-rule py-8 lg:border-l lg:border-t-0 lg:pl-8 lg:py-10">
            <div className="flex flex-col gap-2">
              <h3 className="type-heading text-ink">60s+ mode</h3>
              <p className="type-small text-muted">TikTok pays creators for original videos over a minute. Remawt cuts a 60–90s version for TikTok and a tighter one for Shorts and Reels from the same script.</p>
            </div>
            <div className="flex flex-col gap-3" aria-hidden>
              {[
                { l: "Shorts / Reels", w: 52, t: "0:47" },
                { l: "TikTok", w: 86, t: "1:18" },
              ].map((r) => (
                <div key={r.l} className="flex flex-col gap-1.5">
                  <div className="flex justify-between">
                    <span className="type-caption text-muted">{r.l}</span>
                    <span className="mono-tick tabular-nums">{r.t}</span>
                  </div>
                  <div className="relative h-2 rounded-full bg-paper-3">
                    <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${r.w}%` }} />
                    <span className="absolute -inset-y-1 left-[66.6%] w-px bg-ink" />
                  </div>
                </div>
              ))}
              <span className="mono-tick self-start pl-[60%]">60 s</span>
            </div>
          </div>
        </div>
      </MarketingSection>

      {/* Pricing teaser */}
      <MarketingSection
        id="pricing"
        tone="wash"
        title="Priced per video. No credit maths."
        lead="Every plan counts finished videos, re-renders included. Unused videos roll over a month, and there is a 7-day money-back window."
        action={
          <Button asChild variant="outline">
            <Link href="/pricing">
              Full plan comparison <ArrowRight />
            </Link>
          </Button>
        }
      >
        <ul className="grid grid-cols-1 overflow-hidden rounded-[2px] border border-rule bg-surface sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((p, i) => (
            <li
              key={p.id}
              className={cn(
                "relative flex flex-col gap-6 p-6",
                i > 0 && "border-t border-rule sm:border-t-0",
                i % 2 === 1 && "sm:border-l",
                i >= 2 && "sm:border-t lg:border-t-0",
                i === 2 && "lg:border-l",
                p.popular && "bg-accent-soft",
              )}
            >
              {p.popular && <span className="absolute inset-x-0 top-0 h-px bg-accent" aria-hidden />}
              <div className="flex items-center justify-between gap-2">
                <h3 className="type-subheading text-ink">{p.name}</h3>
                {p.popular && <Badge variant="accent">Most popular</Badge>}
              </div>
              <div className="flex flex-col gap-1">
                <p className="flex items-baseline gap-1">
                  <span className="type-display text-ink tabular-nums">${p.monthlyUsd}</span>
                  <span className="type-small text-muted">/ mo</span>
                </p>
                <p className="type-caption text-subtle tabular-nums">{p.monthlyUsd === 0 ? "Draft quality" : `$${p.annualMonthlyUsd}/mo billed yearly`}</p>
              </div>
              <ul className="flex flex-col gap-2 border-t border-rule pt-4">
                {p.features.slice(0, 4).map((f) => (
                  <li key={f} className="type-small flex items-start gap-2 text-muted">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        {agency && (
          <p className="type-small mt-4 text-muted">
            Running client channels? <span className="text-ink">{agency.name}</span> covers {agency.channels} channels and {agency.videosPerMonth} videos a month from ${agency.monthlyUsd}/mo.
          </p>
        )}
      </MarketingSection>

      {/* FAQ */}
      <MarketingSection id="faq" title="Questions, answered.">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <ul className="border-t border-rule lg:col-span-8 lg:col-start-5">
            {FAQ.map((f) => (
              <li key={f.q} className="border-b border-rule">
                <details className="group">
                  <summary className="type-heading flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-4 text-ink transition-colors hover:text-ink/80 [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <Plus className="size-4 shrink-0 text-muted transition-transform duration-200 ease-out-expo group-open:rotate-45" aria-hidden />
                  </summary>
                  <p className="type-body-lg max-w-[64ch] pb-6 text-muted">
                    {f.a}
                    {f.q.includes("refund") && (
                      <>
                        {" "}
                        <Link href="/refund" className="text-ink underline decoration-rule-strong hover:decoration-ink">
                          Read the refund policy
                        </Link>
                        .
                      </>
                    )}
                  </p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </MarketingSection>

      {/* Final CTA */}
      <section className="relative isolate overflow-hidden border-t border-rule py-20 md:py-32">
        <div className="kinetic-glow pointer-events-none absolute -bottom-96 left-1/2 -z-10 h-[700px] w-[1100px] -translate-x-1/2 opacity-70" aria-hidden />
        <Container className="flex flex-col items-start gap-8">
          <h2 className="type-display-xl max-w-[14ch] text-ink">
            Explainer videos that look <span className="font-serif-italic">designed,</span> <span className="text-muted">not generated.</span>
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <PrimaryCta label="Start free" />
            <Button asChild size="lg" variant="ghost">
              <Link href="/pricing">
                Compare plans <ArrowUpRight />
              </Link>
            </Button>
          </div>
          <p className="mono-tick">Free plan · 3 videos a month</p>
        </Container>
      </section>
    </PageShell>
  );
}
