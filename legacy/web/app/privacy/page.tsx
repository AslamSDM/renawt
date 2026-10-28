import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy",
  description:
    "Learn how Remawt collects, uses, and protects your personal data. Our commitment to privacy and data security for our AI video creation platform.",
  alternates: { canonical: "/privacy" },
};

const SECTIONS: { h: string; body: React.ReactNode }[] = [
  {
    h: "1. Introduction",
    body: (
      <p>
        Remawt (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates the
        remawt.com website and AI video generation platform. This Privacy
        Policy explains how we collect, use, disclose, and safeguard your
        information.
      </p>
    ),
  },
  {
    h: "2. Information We Collect",
    body: (
      <>
        <p className="mono-tick">PERSONAL INFORMATION</p>
        <p className="mt-2">When you create an account or use our services, we may collect:</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-6">
          <li>Name and email address.</li>
          <li>Account credentials (managed via OAuth providers).</li>
          <li>Payment information (processed securely by Dodo Payments).</li>
          <li>Project data and generated content.</li>
        </ul>
        <p className="mono-tick mt-6">AUTOMATIC</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-6">
          <li>IP address and browser type.</li>
          <li>Device information and operating system.</li>
          <li>Usage data (pages visited, features used, time spent).</li>
          <li>Cookies and similar tracking technologies.</li>
        </ul>
      </>
    ),
  },
  {
    h: "3. How We Use Your Information",
    body: (
      <ul className="list-disc space-y-1.5 pl-6">
        <li>Provide, maintain, and improve our AI video generation services.</li>
        <li>Process transactions and manage your account.</li>
        <li>Send service-related communications and updates.</li>
        <li>Respond to support requests and inquiries.</li>
        <li>Analyze usage patterns to improve our platform.</li>
        <li>Detect and prevent fraud or abuse.</li>
        <li>Comply with legal obligations.</li>
      </ul>
    ),
  },
  {
    h: "4. Data Storage and Security",
    body: (
      <p>
        Your data is stored on secure servers with appropriate technical and
        organizational measures. Generated videos and project data are stored
        in secure cloud storage (Cloudflare R2).
      </p>
    ),
  },
  {
    h: "5. Third-Party Services",
    body: (
      <>
        <p>We use the following third-party services that may process your data:</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-6">
          <li>
            <strong className="text-ink">Dodo Payments</strong> — payment processing
          </li>
          <li>
            <strong className="text-ink">Cloudflare</strong> — hosting, CDN, storage
          </li>
          <li>
            <strong className="text-ink">OAuth Providers</strong> (Google, GitHub) — authentication
          </li>
          <li>
            <strong className="text-ink">AI Model Providers</strong> — video content generation
          </li>
        </ul>
        <p className="mt-3">
          Each third-party service has its own privacy policy governing how
          they handle your data.
        </p>
      </>
    ),
  },
  {
    h: "6. Your Rights",
    body: (
      <>
        <p>Depending on your jurisdiction, you may have the right to:</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-6">
          <li>Access the personal data we hold about you.</li>
          <li>Request correction or deletion of your data.</li>
          <li>Object to or restrict processing.</li>
          <li>Request data portability.</li>
          <li>Withdraw consent at any time.</li>
        </ul>
        <p className="mt-3">
          To exercise these rights, contact{" "}
          <a
            href="mailto:support@remawt.com"
            className="text-ink underline decoration-rule-strong underline-offset-4 hover:decoration-ink"
          >
            support@remawt.com
          </a>
          .
        </p>
      </>
    ),
  },
  {
    h: "7. Cookies",
    body: (
      <p>
        We use essential cookies to maintain your session and preferences. We
        may also use analytics cookies. Control cookie preferences through your
        browser settings.
      </p>
    ),
  },
  {
    h: "8. Data Retention",
    body: (
      <p>
        We retain your personal data for as long as your account is active or
        as needed to provide services. Generated videos and project data are
        retained until you delete them or close your account.
      </p>
    ),
  },
  {
    h: "9. Children's Privacy",
    body: (
      <p>
        Our services are not intended for users under the age of 16. We do not
        knowingly collect personal information from children under 16.
      </p>
    ),
  },
  {
    h: "10. Changes to This Policy",
    body: (
      <p>
        We may update this Privacy Policy from time to time. We will notify you
        of material changes by posting the updated policy here and updating the
        &quot;Last updated&quot; date.
      </p>
    ),
  },
  {
    h: "11. Contact Us",
    body: (
      <p>
        Questions? Contact{" "}
        <a
          href="mailto:support@remawt.com"
          className="text-ink underline decoration-rule-strong underline-offset-4 hover:decoration-ink"
        >
          support@remawt.com
        </a>
        .
      </p>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <Navbar />

      <section className="border-b border-rule px-6 pb-12 pt-32">
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-10 flex flex-wrap items-center gap-3 border-b border-rule pb-4">
            <span className="mono-label rounded-sm border border-ink px-2 py-1">
              LEGAL · PRIVACY · v1
            </span>
            <span className="mono-tick">LAST UPDATED 2026-03-11</span>
          </div>
          <h1 className="text-[clamp(2.5rem,7vw,6rem)] font-medium leading-[0.95] tracking-[-0.02em]">
            Privacy <span className="font-serif-italic">policy.</span>
          </h1>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-12 lg:grid-cols-12">
          <aside className="lg:col-span-3">
            <p className="mono-tick mb-4">CONTENTS</p>
            <ul className="space-y-2 text-sm">
              {SECTIONS.map((s) => (
                <li key={s.h}>
                  <a
                    href={`#${s.h.split(".")[0]}`}
                    className="text-muted hover:text-ink"
                  >
                    {s.h}
                  </a>
                </li>
              ))}
            </ul>
          </aside>

          <div className="lg:col-span-9">
            <div className="space-y-12 text-base leading-relaxed text-ink/85">
              {SECTIONS.map((s) => (
                <div key={s.h} id={s.h.split(".")[0]}>
                  <h2 className="font-serif-italic text-2xl text-ink">{s.h}</h2>
                  <div className="mt-3">{s.body}</div>
                </div>
              ))}
            </div>

            <div className="mt-16 flex gap-6 border-t border-rule pt-6 text-sm">
              <Link
                href="/terms"
                className="text-muted hover:text-ink"
              >
                Terms & Conditions
              </Link>
              <Link
                href="/pricing"
                className="text-muted hover:text-ink"
              >
                Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
