import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import Link from "next/link";

export const metadata = {
  title: "Cookie Policy",
  description:
    "How Remawt uses cookies and similar tracking technologies, the categories of cookies we set, and how you can control them.",
  alternates: { canonical: "/cookies" },
};

const SECTIONS: { h: string; body: React.ReactNode }[] = [
  {
    h: "1. What Are Cookies",
    body: (
      <p>
        Cookies are small text files placed on your device when you visit a
        website. They let the site remember your actions and preferences over
        time. We also use similar technologies such as local storage and pixels;
        we refer to all of these as &quot;cookies&quot; in this policy.
      </p>
    ),
  },
  {
    h: "2. How We Use Cookies",
    body: (
      <ul className="list-disc space-y-1.5 pl-6">
        <li>Keep you signed in and maintain your session.</li>
        <li>Remember your preferences and settings.</li>
        <li>Secure your account and detect abuse.</li>
        <li>Understand how the platform is used so we can improve it.</li>
      </ul>
    ),
  },
  {
    h: "3. Categories of Cookies",
    body: (
      <>
        <p className="mono-tick">STRICTLY NECESSARY</p>
        <p className="mt-2">
          Required for the site to function — authentication, security, and
          session management. These cannot be turned off.
        </p>
        <p className="mono-tick mt-6">PREFERENCES</p>
        <p className="mt-2">
          Remember choices you make, such as your editor and UI settings.
        </p>
        <p className="mono-tick mt-6">ANALYTICS</p>
        <p className="mt-2">
          Help us understand usage patterns in aggregate so we can improve the
          product. Set only with your consent.
        </p>
      </>
    ),
  },
  {
    h: "4. Third-Party Cookies",
    body: (
      <>
        <p>
          Some cookies are set by third-party services we rely on. These
          include:
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-6">
          <li>
            <strong className="text-ink">Dodo Payments</strong> — secure payment
            processing
          </li>
          <li>
            <strong className="text-ink">OAuth Providers</strong> (Google,
            GitHub) — authentication
          </li>
          <li>
            <strong className="text-ink">Cloudflare</strong> — security and
            content delivery
          </li>
        </ul>
        <p className="mt-3">
          These providers set cookies under their own privacy and cookie
          policies.
        </p>
      </>
    ),
  },
  {
    h: "5. Managing Cookies",
    body: (
      <>
        <p>
          When you first visit, you can accept or reject non-essential cookies
          via our consent banner. You can change your choice at any time by
          clearing the <code>remawt-cookie-consent</code> value in your browser
          storage, which makes the banner reappear.
        </p>
        <p className="mt-3">
          You can also block or delete cookies through your browser settings.
          Note that disabling strictly necessary cookies may break parts of the
          Service.
        </p>
      </>
    ),
  },
  {
    h: "6. Changes to This Policy",
    body: (
      <p>
        We may update this Cookie Policy from time to time. Material changes will
        be posted here with an updated &quot;Last updated&quot; date.
      </p>
    ),
  },
  {
    h: "7. Contact Us",
    body: (
      <p>
        Questions about cookies? Contact{" "}
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

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <Navbar />

      <section className="border-b border-rule px-6 pb-12 pt-32">
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-10 flex flex-wrap items-center gap-3 border-b border-rule pb-4">
            <span className="mono-label rounded-sm border border-ink px-2 py-1">
              LEGAL · COOKIES · v1
            </span>
            <span className="mono-tick">LAST UPDATED 2026-05-31</span>
          </div>
          <h1 className="text-[clamp(2.5rem,7vw,6rem)] font-medium leading-[0.95] tracking-[-0.02em]">
            Cookie <span className="font-serif-italic">policy.</span>
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
              <Link href="/privacy" className="text-muted hover:text-ink">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-muted hover:text-ink">
                Terms &amp; Conditions
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
