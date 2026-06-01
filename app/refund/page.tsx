import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import Link from "next/link";

export const metadata = {
  title: "Refund & Cancellation Policy",
  description:
    "Remawt's refund and cancellation policy. Learn how credits, subscriptions, and payments are handled on our AI video creation platform.",
  alternates: { canonical: "/refund" },
};

const SECTIONS: { h: string; body: React.ReactNode }[] = [
  {
    h: "1. Overview",
    body: (
      <p>
        This Refund &amp; Cancellation Policy explains how payments, credits, and
        subscriptions are handled on Remawt (&quot;we,&quot; &quot;our,&quot; or
        &quot;us&quot;), operated at remawt.com. By purchasing credits or a
        subscription, you agree to this policy.
      </p>
    ),
  },
  {
    h: "2. No Refunds",
    body: (
      <>
        <p>
          All purchases on Remawt are final.{" "}
          <strong className="text-ink">
            We do not offer refunds for credits, subscriptions, or any other
            purchase
          </strong>
          , whether used or unused.
        </p>
        <p className="mt-3">
          Because our AI video generation consumes compute resources at the
          moment of use, payments are non-refundable once a purchase is
          completed. Please review your selection carefully before completing
          checkout.
        </p>
      </>
    ),
  },
  {
    h: "3. Credits",
    body: (
      <ul className="list-disc space-y-1.5 pl-6">
        <li>Credits are non-refundable once purchased.</li>
        <li>Credits never expire and remain available on your account.</li>
        <li>Credits have no cash value and cannot be transferred or sold.</li>
        <li>Credits consumed by a generation are not restored if you are unhappy with the output.</li>
      </ul>
    ),
  },
  {
    h: "4. Subscription Cancellation",
    body: (
      <>
        <p>
          You may cancel a recurring subscription at any time from your account
          settings or by contacting support. When you cancel:
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-6">
          <li>Your plan stays active until the end of the current billing period.</li>
          <li>You retain access to paid features until that period ends.</li>
          <li>You will not be charged for the next billing cycle.</li>
          <li>No partial or pro-rated refund is issued for the remaining period.</li>
        </ul>
      </>
    ),
  },
  {
    h: "5. Failed or Duplicate Charges",
    body: (
      <p>
        If you are charged in error — for example a duplicate transaction or a
        technical billing fault — contact us within 7 days and we will
        investigate. Verified billing errors are corrected. This is the only
        exception to our no-refund policy.
      </p>
    ),
  },
  {
    h: "6. Chargebacks",
    body: (
      <p>
        Please contact us before initiating a chargeback or payment dispute.
        Fraudulent or unjustified chargebacks may result in suspension or
        termination of your account. Payments are processed securely by Dodo
        Payments.
      </p>
    ),
  },
  {
    h: "7. Changes to This Policy",
    body: (
      <p>
        We may update this policy from time to time. Material changes will be
        posted on this page with an updated &quot;Last updated&quot; date.
      </p>
    ),
  },
  {
    h: "8. Contact Us",
    body: (
      <p>
        Questions about billing or cancellation? Contact{" "}
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

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <Navbar />

      <section className="border-b border-rule px-6 pb-12 pt-32">
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-10 flex flex-wrap items-center gap-3 border-b border-rule pb-4">
            <span className="mono-label rounded-sm border border-ink px-2 py-1">
              LEGAL · REFUNDS · v1
            </span>
            <span className="mono-tick">LAST UPDATED 2026-05-31</span>
          </div>
          <h1 className="text-[clamp(2.5rem,7vw,6rem)] font-medium leading-[0.95] tracking-[-0.02em]">
            Refund &amp; <span className="font-serif-italic">cancellation.</span>
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
              <Link href="/terms" className="text-muted hover:text-ink">
                Terms &amp; Conditions
              </Link>
              <Link href="/privacy" className="text-muted hover:text-ink">
                Privacy Policy
              </Link>
              <Link href="/pricing" className="text-muted hover:text-ink">
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
