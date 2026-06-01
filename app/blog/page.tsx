import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { BLOG_POSTS } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog — AI Product Videos, Demos & SaaS Marketing | Remawt",
  description:
    "Guides and stories on making AI product videos, SaaS demo videos, and explainer videos. Tips, behind-the-scenes, and how to ship video faster.",
  alternates: { canonical: "/blog" },
};

export default function BlogIndexPage() {
  const posts = [...BLOG_POSTS].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="min-h-screen bg-surface text-ink">
      <Navbar />

      <section className="border-b border-rule px-6 pb-12 pt-32">
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-10 flex flex-wrap items-center gap-3 border-b border-rule pb-4">
            <span className="mono-label rounded-sm border border-ink px-2 py-1">
              REMAWT · BLOG
            </span>
          </div>
          <h1 className="text-[clamp(2.5rem,7vw,6rem)] font-medium leading-[0.95] tracking-[-0.02em]">
            The <span className="font-serif-italic">blog.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/85">
            Notes on AI product videos, SaaS demo generation, and shipping video
            without an editing timeline.
          </p>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-[1400px]">
          <div className="grid grid-cols-1 gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="group bg-surface p-8 transition-colors hover:bg-ink/[0.03]"
              >
                <p className="mono-tick">{p.date}</p>
                <h2 className="mt-4 text-2xl font-medium leading-tight tracking-[-0.01em] text-ink group-hover:underline group-hover:decoration-rule-strong group-hover:underline-offset-4">
                  {p.title}
                </h2>
                <p className="mt-3 text-base leading-relaxed text-ink/70">
                  {p.description}
                </p>
                <span className="mono-tick mt-6 inline-block text-muted group-hover:text-ink">
                  READ →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
