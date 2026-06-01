import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MiniMarkdown } from "@/components/MiniMarkdown";
import { BLOG_POSTS, getPostMeta, getPostBody } from "@/lib/blog";

export const dynamicParams = false;

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostMeta(slug);
  if (!post) return {};
  return {
    title: `${post.title} | Remawt`,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `https://remawt.com/blog/${post.slug}`,
      type: "article",
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostMeta(slug);
  if (!post) notFound();

  const body = await getPostBody(post.file);
  const more = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: { "@type": "Organization", name: "Remawt", url: "https://remawt.com" },
    publisher: {
      "@type": "Organization",
      name: "Remawt",
      url: "https://remawt.com",
    },
    mainEntityOfPage: `https://remawt.com/blog/${post.slug}`,
  };

  return (
    <div className="min-h-screen bg-surface text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <Navbar />

      <section className="border-b border-rule px-6 pb-12 pt-32">
        <div className="mx-auto max-w-[820px]">
          <Link href="/blog" className="mono-tick text-muted hover:text-ink">
            ← BLOG
          </Link>
          <p className="mono-tick mt-8">{post.date}</p>
          <h1 className="mt-4 text-[clamp(2rem,5vw,3.5rem)] font-medium leading-[1.02] tracking-[-0.02em]">
            {post.title}
          </h1>
        </div>
      </section>

      <article className="px-6 py-16">
        <div className="mx-auto max-w-[820px]">
          <MiniMarkdown source={body} />

          <div className="mt-16 border-t border-rule pt-10">
            <p className="text-lg text-ink/85">
              Want to make videos like this without the editing?{" "}
              <Link
                href="/ai-product-videos"
                className="text-ink underline decoration-rule-strong underline-offset-4 hover:decoration-ink"
              >
                See how Remawt generates AI product videos
              </Link>
              .
            </p>
            <Link href="/projects" className="btn-accent mt-6 inline-block">
              Start creating
            </Link>
          </div>
        </div>
      </article>

      <section className="border-t border-rule px-6 py-16">
        <div className="mx-auto max-w-[1400px]">
          <p className="mono-tick mb-6">MORE FROM THE BLOG</p>
          <div className="grid grid-cols-1 gap-px border border-rule bg-rule sm:grid-cols-3">
            {more.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="bg-surface p-6 transition-colors hover:bg-ink/[0.03]"
              >
                <h3 className="text-lg font-medium leading-tight text-ink">
                  {p.title}
                </h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
