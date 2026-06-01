import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SEO_LANDINGS, getLanding } from "@/lib/seoLandings";

export const dynamicParams = false;

export function generateStaticParams() {
  return SEO_LANDINGS.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const lp = getLanding(slug);
  if (!lp) return {};
  return {
    title: lp.title,
    description: lp.description,
    alternates: { canonical: `/${lp.slug}` },
    openGraph: {
      title: lp.title,
      description: lp.description,
      url: `https://remawt.com/${lp.slug}`,
      type: "website",
    },
  };
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lp = getLanding(slug);
  if (!lp) notFound();

  const related = SEO_LANDINGS.filter((l) => l.slug !== lp.slug).slice(0, 4);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: lp.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="min-h-screen bg-surface text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Navbar />

      {/* Hero */}
      <section className="border-b border-rule px-6 pb-16 pt-32">
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <span className="mono-label rounded-sm border border-ink px-2 py-1">
              {lp.keyword.toUpperCase()}
            </span>
          </div>
          <h1 className="max-w-[14ch] text-[clamp(2.5rem,7vw,6rem)] font-medium leading-[0.95] tracking-[-0.02em]">
            {lp.h1Lead}{" "}
            <span className="font-serif-italic" style={{ color: "var(--accent)" }}>
              {lp.h1Accent}
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/85">
            {lp.subhead}
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/projects" className="btn-accent">
              Start creating
            </Link>
            <Link href="/pricing" className="btn-ghost">
              View pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className="border-b border-rule px-6 py-20">
        <div className="mx-auto max-w-[1400px] grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <p className="mono-tick">OVERVIEW</p>
          </div>
          <div className="lg:col-span-9">
            <p className="text-xl leading-relaxed text-ink/85">{lp.intro}</p>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-b border-rule px-6 py-20">
        <div className="mx-auto max-w-[1400px]">
          <p className="mono-tick mb-10">WHY REMAWT</p>
          <div className="grid grid-cols-1 gap-px border border-rule bg-rule sm:grid-cols-2">
            {lp.benefits.map((b) => (
              <div key={b.t} className="bg-surface p-8">
                <h3 className="font-serif-italic text-2xl text-ink">{b.t}</h3>
                <p className="mt-3 text-base leading-relaxed text-ink/75">
                  {b.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-rule px-6 py-20">
        <div className="mx-auto max-w-[1400px]">
          <p className="mono-tick mb-10">HOW IT WORKS</p>
          <div className="grid grid-cols-1 gap-px border border-rule bg-rule sm:grid-cols-3">
            {[
              { n: "01", t: "Prompt", d: "Describe your video or paste your product URL." },
              { n: "02", t: "Generate", d: "The AI scripts, captures, scores, and renders it." },
              { n: "03", t: "Ship", d: "Download a 4K master plus every social aspect ratio." },
            ].map((s) => (
              <div key={s.n} className="bg-surface p-8">
                <p className="mono-tick">{s.n}</p>
                <h3 className="mt-3 text-xl font-medium text-ink">{s.t}</h3>
                <p className="mt-2 text-base leading-relaxed text-ink/75">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-rule px-6 py-20">
        <div className="mx-auto max-w-[1400px] grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <p className="mono-tick">FAQ</p>
          </div>
          <div className="lg:col-span-9 space-y-10">
            {lp.faqs.map((f) => (
              <div key={f.q}>
                <h2 className="font-serif-italic text-2xl text-ink">{f.q}</h2>
                <p className="mt-3 text-base leading-relaxed text-ink/85">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-b border-rule px-6 py-24 text-center">
        <div className="mx-auto max-w-[1400px]">
          <h2 className="mx-auto max-w-[18ch] text-[clamp(2rem,5vw,4rem)] font-medium leading-[1] tracking-[-0.02em]">
            Ready to make your{" "}
            <span className="font-serif-italic" style={{ color: "var(--accent)" }}>
              {lp.keyword}?
            </span>
          </h2>
          <div className="mt-10">
            <Link href="/projects" className="btn-accent">
              Start creating
            </Link>
          </div>
        </div>
      </section>

      {/* Related */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-[1400px]">
          <p className="mono-tick mb-6">EXPLORE MORE</p>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/${r.slug}`}
                className="text-muted hover:text-ink"
              >
                {r.keyword}
              </Link>
            ))}
            <Link href="/blog" className="text-muted hover:text-ink">
              Blog
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
