import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { TemplateGallery } from "@/components/TemplateGallery";
import { listTemplateCards, listSections, templateCount } from "@/lib/templates";

// Paid-only feature — keep it out of search.
export const metadata: Metadata = {
  title: "Template Library",
  robots: { index: false, follow: false },
};

const ACTIVE_SUB = new Set(["active", "trialing", "on_hold"]);

async function isPaidUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      creditBalance: true,
      subscription: { select: { status: true } },
    },
  });
  if (!user) return false;
  if (user.creditBalance > 0) return true;
  return !!user.subscription && ACTIVE_SUB.has(user.subscription.status);
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <Navbar />
      {children}
      <Footer />
    </div>
  );
}

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/templates");
  }

  const paid = await isPaidUser(session.user.id);

  if (!paid) {
    return (
      <Shell>
        <section className="px-6 pb-32 pt-40">
          <div className="mx-auto max-w-[640px] text-center">
            <span className="mono-label rounded-sm border border-ink px-2 py-1">
              MEMBERS ONLY
            </span>
            <h1 className="mt-8 text-[clamp(2rem,5vw,3.5rem)] font-medium leading-[1.02] tracking-[-0.02em]">
              The template library is{" "}
              <span className="font-serif-italic">for members.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-ink/85">
              {templateCount()} motion templates to start from, included with any
              paid plan. Upgrade to browse and use them.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link href="/pricing" className="btn-accent">
                See plans
              </Link>
              <Link href="/projects" className="btn-ghost">
                Back to projects
              </Link>
            </div>
          </div>
        </section>
      </Shell>
    );
  }

  const cards = listTemplateCards();
  const sections = listSections();

  return (
    <Shell>
      <section className="border-b border-rule px-6 pb-12 pt-32">
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-10 flex flex-wrap items-center gap-3 border-b border-rule pb-4">
            <span className="mono-label rounded-sm border border-ink px-2 py-1">
              MEMBERS · TEMPLATES
            </span>
            <span className="mono-tick">{cards.length} TEMPLATES</span>
          </div>
          <h1 className="text-[clamp(2.5rem,7vw,6rem)] font-medium leading-[0.95] tracking-[-0.02em]">
            Template <span className="font-serif-italic">library.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/85">
            Motion templates to start a video from. Filter by type, then send one
            into a new project.
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-[1400px]">
          <TemplateGallery cards={cards} sections={sections} />
        </div>
      </section>
    </Shell>
  );
}
