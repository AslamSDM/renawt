"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Check, ArrowUpRight, Coins, Building2, Mail, Send } from "lucide-react";
import { subscriptionPlans } from "@/lib/dodo/subscription";
import CheckoutButton from "./_components/CheckoutButton";

const FAQS = [
  {
    q: "What are credits?",
    a: "Credits are used to generate videos. Each video export costs 1 credit, regardless of length or quality.",
  },
  {
    q: "Do credits expire?",
    a: "No, your credits never expire. Use them whenever you're ready to create.",
  },
  {
    q: "Can I buy more credits later?",
    a: "Absolutely. You can purchase additional credits anytime. Your credit balance accumulates with each purchase.",
  },
  {
    q: "What happens if I run out of credits?",
    a: "You'll need to purchase more credits to continue creating videos. We'll notify you when your balance is low.",
  },
  {
    q: "Can I get a refund?",
    a: "Credits are non-refundable once purchased, but they never expire so you can use them whenever you need.",
  },
  {
    q: "Do you offer custom packages?",
    a: "Yes. For teams or agencies needing larger volumes, see the Enterprise tier or email support@remawt.com.",
  },
  {
    q: "What's the difference between monthly and annual?",
    a: "Annual plans give you 10% off compared to monthly. Same credits, lower total cost.",
  },
];

export default function PricingPage() {
  const router = useRouter();
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [enterpriseForm, setEnterpriseForm] = useState({
    email: "",
    expectedVideos: "",
    companyName: "",
    message: "",
  });
  const [formSubmitted, setFormSubmitted] = useState(false);

  const handleEnterpriseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(
      `Enterprise Inquiry from ${enterpriseForm.companyName || "a potential customer"}`,
    );
    const body = encodeURIComponent(
      `Company: ${enterpriseForm.companyName}\nEmail: ${enterpriseForm.email}\nExpected Videos/Month: ${enterpriseForm.expectedVideos}\n\nMessage:\n${enterpriseForm.message}`,
    );
    window.location.href = `mailto:support@remawt.com?subject=${subject}&body=${body}`;
    setFormSubmitted(true);
    setTimeout(() => setFormSubmitted(false), 5000);
  };

  return (
    <div className="min-h-screen bg-surface text-ink">
      <Navbar />

      {/* Hero */}
      <section className="px-6 pt-32 pb-12">
        <div className="mx-auto max-w-[1400px]">
          <div className="flex flex-wrap items-center gap-3 border-b border-rule pb-4">
            <span className="mono-label rounded-sm border border-ink px-2 py-1">
              SCENE 02 · PRICING · TAKE 01
            </span>
            <span className="mono-tick">PLANS 03</span>
            <span className="text-rule-strong">·</span>
            <span className="mono-tick">BILLING {billing.toUpperCase()}</span>
            <span className="text-rule-strong">·</span>
            <span className="mono-tick">CREDITS NEVER EXPIRE</span>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <h1 className="text-[clamp(2.5rem,7vw,6rem)] font-medium leading-[0.95] tracking-[-0.02em]">
                Pay per cut.{" "}
                <span className="font-serif-italic">Ship every week.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-muted">
                One credit per video export. Pick monthly or annual, top up
                anytime. Need volume? The enterprise tier is bespoke.
              </p>
            </div>

            <div className="lg:col-span-4">
              {/* Billing toggle */}
              <div className="flex items-center gap-3 border border-ink p-4">
                <span className="mono-label">BILLING</span>
                <div className="ml-auto flex items-center gap-3">
                  <button
                    onClick={() => setBilling("monthly")}
                    className={`text-sm tracking-tight ${
                      billing === "monthly" ? "text-ink" : "text-muted"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() =>
                      setBilling(billing === "monthly" ? "annual" : "monthly")
                    }
                    className="relative h-6 w-12 rounded-full border border-ink bg-paper"
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-ink transition-all ${
                        billing === "annual" ? "left-[1.625rem]" : "left-0.5"
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => setBilling("annual")}
                    className={`text-sm tracking-tight ${
                      billing === "annual" ? "text-ink" : "text-muted"
                    }`}
                  >
                    Annual
                  </button>
                </div>
              </div>
              <p className="mono-tick mt-2">SAVE 10% ON ANNUAL</p>
            </div>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="border-t border-rule px-6 py-20">
        <div className="mx-auto max-w-[1400px]">
          <div className="grid grid-cols-1 gap-px bg-rule md:grid-cols-3">
            {subscriptionPlans.map((pkg) => {
              const monthlyPrice = parseInt(pkg.price);
              const annualTotal =
                pkg.annualPrice ||
                String(Math.round(monthlyPrice * 12 * 0.9));
              const annualMonthly = (
                parseInt(annualTotal.replace(/,/g, "")) / 12
              ).toFixed(0);
              const displayPrice =
                billing === "annual" ? annualMonthly : pkg.price;
              const displayTotal = billing === "annual" ? annualTotal : null;

              return (
                <div
                  key={pkg.title}
                  className={`relative flex flex-col bg-paper p-8 ${
                    pkg.popular ? "ring-1 ring-inset ring-ink" : ""
                  }`}
                >
                  {pkg.popular && (
                    <div className="absolute -top-px left-0 right-0 bg-ink py-1.5 text-center mono-label text-ink-inverse">
                      MOST POPULAR
                    </div>
                  )}
                  <div className={pkg.popular ? "pt-8" : ""}>
                    <div className="flex items-center gap-2 mono-tick">
                      <Coins className="h-3 w-3" strokeWidth={1.6} />
                      {billing === "annual"
                        ? "BILLED ANNUALLY"
                        : "BILLED MONTHLY"}
                    </div>

                    <div className="mt-6 flex items-baseline gap-2">
                      <span className="font-serif-italic text-6xl text-ink">
                        ${displayPrice}
                      </span>
                      <span className="text-sm text-muted">/mo</span>
                    </div>

                    {displayTotal && (
                      <p className="mt-1 text-xs text-muted">
                        ${displayTotal}/year · save $
                        {Math.round(
                          monthlyPrice * 12 -
                            parseInt(annualTotal.replace(/,/g, "")),
                        )}
                        /yr
                      </p>
                    )}

                    <h3 className="mt-6 text-2xl font-medium tracking-tight">
                      {pkg.title}
                    </h3>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-serif-italic text-3xl text-ink">
                        {pkg.creditsPerCycle}
                      </span>
                      <span className="mono-tick">CREDITS / MONTH</span>
                    </div>
                    <p className="mt-2 text-sm text-muted">{pkg.description}</p>
                  </div>

                  <ul className="mt-8 space-y-3">
                    {pkg.features.map((f, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 text-sm text-ink/80"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-ink" strokeWidth={1.6} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8">
                    <CheckoutButton
                      text={pkg.cta}
                      isPopular={pkg.popular}
                      product={pkg}
                      quantity={1}
                      billing={billing}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Enterprise */}
      <section className="border-t border-rule bg-paper-3 px-6 py-20">
        <div className="mx-auto max-w-[1400px]">
          <div className="grid grid-cols-1 gap-px bg-rule lg:grid-cols-2">
            <div className="bg-paper p-10">
              <div className="flex items-center gap-2 mono-tick">
                <Building2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                ENTERPRISE
              </div>
              <h2 className="mt-6 text-4xl font-medium tracking-tight md:text-5xl">
                Custom <span className="font-serif-italic">pipeline.</span>
              </h2>
              <p className="mt-4 max-w-md text-muted">
                For teams and agencies. Bulk credits, white label, custom
                renderers, dedicated SLA.
              </p>
              <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  "Unlimited or bulk credits",
                  "Dedicated account manager",
                  "Custom rendering pipeline",
                  "Priority API access & SLA",
                  "White-label options",
                  "Custom integrations",
                  "Volume-based discounts",
                  "Onboarding & training",
                ].map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-sm text-ink/80"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-ink" strokeWidth={1.6} />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex items-center gap-2 border-t border-rule pt-6 text-sm">
                <Mail className="h-4 w-4 text-muted" strokeWidth={1.6} />
                <a
                  href="mailto:support@remawt.com"
                  className="text-ink underline decoration-rule-strong underline-offset-4 hover:decoration-ink"
                >
                  support@remawt.com
                </a>
              </div>
            </div>

            <form
              onSubmit={handleEnterpriseSubmit}
              className="bg-paper p-10"
            >
              <h3 className="text-2xl font-medium tracking-tight">
                Get in touch
              </h3>
              <p className="mt-2 text-sm text-muted">
                Tell us about your needs and we&apos;ll craft a plan.
              </p>

              <div className="mt-8 space-y-5">
                {[
                  {
                    label: "WORK EMAIL *",
                    key: "email",
                    type: "email",
                    required: true,
                    placeholder: "you@company.com",
                  },
                  {
                    label: "COMPANY NAME",
                    key: "companyName",
                    type: "text",
                    placeholder: "Acme Inc.",
                  },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="mono-tick mb-2 block">{field.label}</label>
                    <input
                      type={field.type}
                      required={field.required}
                      value={
                        enterpriseForm[
                          field.key as keyof typeof enterpriseForm
                        ]
                      }
                      onChange={(e) =>
                        setEnterpriseForm((p) => ({
                          ...p,
                          [field.key]: e.target.value,
                        }))
                      }
                      placeholder={field.placeholder}
                      className="w-full border border-rule-strong bg-paper px-4 py-3 text-sm text-ink placeholder:text-subtle focus:border-ink focus:outline-none"
                    />
                  </div>
                ))}

                <div>
                  <label className="mono-tick mb-2 block">
                    EXPECTED VIDEOS / MONTH *
                  </label>
                  <select
                    required
                    value={enterpriseForm.expectedVideos}
                    onChange={(e) =>
                      setEnterpriseForm((p) => ({
                        ...p,
                        expectedVideos: e.target.value,
                      }))
                    }
                    className="w-full cursor-pointer appearance-none border border-rule-strong bg-paper px-4 py-3 text-sm text-ink focus:border-ink focus:outline-none"
                  >
                    <option value="" disabled>
                      Select volume
                    </option>
                    <option value="500-1000">500 – 1,000</option>
                    <option value="1000-5000">1,000 – 5,000</option>
                    <option value="5000-10000">5,000 – 10,000</option>
                    <option value="10000+">10,000+</option>
                  </select>
                </div>

                <div>
                  <label className="mono-tick mb-2 block">TELL US MORE</label>
                  <textarea
                    rows={4}
                    value={enterpriseForm.message}
                    onChange={(e) =>
                      setEnterpriseForm((p) => ({
                        ...p,
                        message: e.target.value,
                      }))
                    }
                    placeholder="Describe your use case, team size, requirements..."
                    className="w-full resize-none border border-rule-strong bg-paper px-4 py-3 text-sm text-ink placeholder:text-subtle focus:border-ink focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-sm text-ink-inverse transition-opacity hover:opacity-90"
                >
                  {formSubmitted ? (
                    "Opening mail client..."
                  ) : (
                    <>
                      Contact sales
                      <Send className="h-4 w-4" strokeWidth={1.6} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-rule px-6 py-20">
        <div className="mx-auto max-w-[1400px]">
          <p className="mono-tick">FAQ</p>
          <h2 className="mt-3 text-4xl font-medium tracking-tight md:text-5xl">
            Questions &{" "}
            <span className="font-serif-italic">answers.</span>
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-px bg-rule md:grid-cols-2">
            {FAQS.map((faq) => (
              <div key={faq.q} className="bg-paper p-8">
                <h3 className="text-lg font-medium text-ink">{faq.q}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-rule px-6 py-28">
        <div className="mx-auto max-w-[1400px] text-center">
          <h2 className="text-[clamp(2.5rem,7vw,6rem)] font-medium leading-[0.95] tracking-tight">
            Start <span className="font-serif-italic">rendering.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-muted">
            Each video costs one credit. Buy a plan, hit start, ship a reel.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => router.push("/projects")}
              className="group inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm text-ink-inverse transition-opacity hover:opacity-90"
            >
              Start free
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={() => router.push("/projects")}
              className="rounded-full border border-ink px-6 py-3 text-sm text-ink transition-colors hover:bg-ink hover:text-ink-inverse"
            >
              View projects
            </button>
          </div>
          <div className="mt-8 flex items-center justify-center gap-4 text-xs text-muted">
            <Link href="/privacy" className="hover:text-ink">
              Privacy
            </Link>
            <span className="text-rule-strong">·</span>
            <Link href="/terms" className="hover:text-ink">
              Terms
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
