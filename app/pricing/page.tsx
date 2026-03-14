"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Check, ArrowRight, Coins, Building2, Mail, Send } from "lucide-react";
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
    a: "Absolutely! You can purchase additional credits anytime. Your credit balance accumulates with each purchase.",
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
    a: "Yes! For teams or agencies needing larger volumes, check out our Enterprise plan or contact us at info@remawt.com for custom pricing.",
  },
  {
    q: "What's the difference between monthly and annual?",
    a: "Annual plans give you 10% off compared to paying monthly. You get the same credits each month, just at a lower total cost.",
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
    window.location.href = `mailto:info@remawt.com?subject=${subject}&body=${body}`;
    setFormSubmitted(true);
    setTimeout(() => setFormSubmitted(false), 5000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-white selection:text-black">
      {/* Film Grain Overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-50 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <Navbar />

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6 md:px-12 border-b border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8">
            <div>
              <span className="text-xs tracking-[0.3em] text-gray-600 uppercase block mb-4">
                Pricing
              </span>
              <h1 className="text-[10vw] md:text-[6vw] font-light leading-[0.9]">
                Simple
              </h1>
              <h1 className="text-[10vw] md:text-[6vw] font-light leading-[0.9]">
                Pricing
              </h1>
            </div>
            <div className="text-sm tracking-widest text-gray-600 uppercase mt-8 md:mt-0 text-right">
              <span className="block">Pay Monthly or Annually</span>
              <span className="block">Save 10% with Annual</span>
            </div>
          </div>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mt-12">
            <span
              className={`text-sm tracking-widest uppercase cursor-pointer transition-colors ${billing === "monthly" ? "text-white" : "text-gray-600"}`}
              onClick={() => setBilling("monthly")}
            >
              Monthly
            </span>
            <button
              onClick={() => setBilling(billing === "monthly" ? "annual" : "monthly")}
              className="relative w-14 h-7 rounded-full border border-white/20 transition-colors cursor-pointer"
              style={{ backgroundColor: billing === "annual" ? "#fff" : "transparent" }}
            >
              <span
                className={`absolute top-0.5 w-6 h-6 rounded-full transition-all duration-300 ${
                  billing === "annual"
                    ? "left-7 bg-black"
                    : "left-0.5 bg-white"
                }`}
              />
            </button>
            <span
              className={`text-sm tracking-widest uppercase cursor-pointer transition-colors ${billing === "annual" ? "text-white" : "text-gray-600"}`}
              onClick={() => setBilling("annual")}
            >
              Annual
              <span className="ml-2 text-xs text-green-400 normal-case">Save 10%</span>
            </span>
          </div>
        </div>
      </section>

      {/* Credit Packages - Grid Layout */}
      <section className="py-24 px-6 md:px-12 border-b border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-px bg-white/10">
            {subscriptionPlans.map((pkg) => {
              const monthlyPrice = parseInt(pkg.price);
              const annualTotal = pkg.annualPrice || String(Math.round(monthlyPrice * 12 * 0.9));
              const annualMonthly = (parseInt(annualTotal.replace(/,/g, "")) / 12).toFixed(0);
              const displayPrice = billing === "annual" ? annualMonthly : pkg.price;
              const displayTotal = billing === "annual" ? annualTotal : null;

              return (
                <Card
                  key={pkg.title}
                  className={`bg-[#0a0a0a] border-0 rounded-none ${pkg.popular ? "relative" : ""}`}
                >
                  {pkg.popular && (
                    <div className="absolute top-0 left-0 right-0 bg-white text-black text-center py-2 text-xs tracking-widest uppercase">
                      Most Popular
                    </div>
                  )}

                  <CardHeader className={`${pkg.popular ? "pt-16" : ""} pb-8`}>
                    <div className="flex items-center gap-2 text-xs text-gray-600 tracking-widest uppercase mb-6">
                      <Coins className="w-4 h-4" />
                      <span>{billing === "annual" ? "Billed annually" : "Billed monthly"}</span>
                    </div>

                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-6xl font-light">${displayPrice}</span>
                      <span className="text-sm text-gray-500">/mo</span>
                    </div>

                    {displayTotal && (
                      <p className="text-xs text-gray-500">
                        ${displayTotal}/year
                        <span className="ml-2 text-green-400">Save ${Math.round(monthlyPrice * 12 - parseInt(annualTotal.replace(/,/g, "")))}/yr</span>
                      </p>
                    )}

                    <CardTitle className="text-2xl font-light tracking-wide mt-4">
                      {pkg.title}
                    </CardTitle>
                    <div className="mt-2">
                      <span className="text-3xl font-light text-white">
                        {pkg.creditsPerCycle}
                      </span>
                      <span className="text-sm text-gray-500 ml-2">credits/month</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      {pkg.description}
                    </p>
                  </CardHeader>

                  <CardContent className="flex flex-col justify-between space-y-6 h-full">
                    <ul className="space-y-4">
                      {pkg.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm">
                          <Check className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-400">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <CheckoutButton
                      text={pkg.cta}
                      isPopular={pkg.popular}
                      product={pkg}
                      quantity={1}
                      billing={billing}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Enterprise Section */}
      <section className="py-24 px-6 md:px-12 border-b border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-px bg-white/10">
            {/* Enterprise Info */}
            <Card className="bg-[#0a0a0a] border-0 rounded-none">
              <CardHeader className="pb-6">
                <div className="flex items-center gap-2 text-xs text-gray-600 tracking-widest uppercase mb-6">
                  <Building2 className="w-4 h-4" />
                  <span>Enterprise</span>
                </div>
                <CardTitle className="text-4xl md:text-5xl font-light tracking-wide mb-4">
                  Custom Pricing
                </CardTitle>
                <p className="text-gray-500 leading-relaxed">
                  For teams and agencies with high-volume needs. Get a tailored
                  plan that fits your production workflow.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="space-y-4">
                  {[
                    "Unlimited or bulk credits",
                    "Dedicated account manager",
                    "Custom rendering pipeline",
                    "Priority API access & SLA",
                    "White-label options",
                    "Custom integrations",
                    "Volume-based discounts",
                    "Onboarding & training",
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <Check className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-400">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Mail className="w-4 h-4" />
                    <a
                      href="mailto:info@remawt.com"
                      className="hover:text-white transition-colors"
                    >
                      info@remawt.com
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Enterprise Form */}
            <Card className="bg-[#0a0a0a] border-0 rounded-none">
              <CardHeader className="pb-6">
                <CardTitle className="text-2xl font-light tracking-wide">
                  Get in Touch
                </CardTitle>
                <p className="text-sm text-gray-500">
                  Tell us about your needs and we&apos;ll craft a plan for you.
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleEnterpriseSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs tracking-widest text-gray-500 uppercase mb-2">
                      Work Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={enterpriseForm.email}
                      onChange={(e) =>
                        setEnterpriseForm((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      className="w-full bg-transparent border border-white/10 px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30 transition-colors"
                      placeholder="you@company.com"
                    />
                  </div>

                  <div>
                    <label className="block text-xs tracking-widest text-gray-500 uppercase mb-2">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={enterpriseForm.companyName}
                      onChange={(e) =>
                        setEnterpriseForm((prev) => ({
                          ...prev,
                          companyName: e.target.value,
                        }))
                      }
                      className="w-full bg-transparent border border-white/10 px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30 transition-colors"
                      placeholder="Acme Inc."
                    />
                  </div>

                  <div>
                    <label className="block text-xs tracking-widest text-gray-500 uppercase mb-2">
                      Expected Videos Per Month *
                    </label>
                    <select
                      required
                      value={enterpriseForm.expectedVideos}
                      onChange={(e) =>
                        setEnterpriseForm((prev) => ({
                          ...prev,
                          expectedVideos: e.target.value,
                        }))
                      }
                      className="w-full bg-transparent border border-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-colors appearance-none cursor-pointer"
                    >
                      <option value="" disabled className="bg-[#0a0a0a]">
                        Select volume
                      </option>
                      <option value="500-1000" className="bg-[#0a0a0a]">
                        500 – 1,000
                      </option>
                      <option value="1000-5000" className="bg-[#0a0a0a]">
                        1,000 – 5,000
                      </option>
                      <option value="5000-10000" className="bg-[#0a0a0a]">
                        5,000 – 10,000
                      </option>
                      <option value="10000+" className="bg-[#0a0a0a]">
                        10,000+
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs tracking-widest text-gray-500 uppercase mb-2">
                      Tell Us More
                    </label>
                    <textarea
                      rows={4}
                      value={enterpriseForm.message}
                      onChange={(e) =>
                        setEnterpriseForm((prev) => ({
                          ...prev,
                          message: e.target.value,
                        }))
                      }
                      className="w-full bg-transparent border border-white/10 px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30 transition-colors resize-none"
                      placeholder="Describe your use case, team size, and any specific requirements..."
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full py-4 text-sm tracking-widest uppercase rounded-none bg-white text-black hover:bg-gray-200 transition-all"
                  >
                    {formSubmitted ? (
                      "Opening Mail Client..."
                    ) : (
                      <>
                        Contact Sales
                        <Send className="ml-2 w-4 h-4" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 px-6 md:px-12 border-b border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <span className="text-xs tracking-[0.3em] text-gray-600 uppercase block mb-4">
              FAQ
            </span>
            <h2 className="text-4xl md:text-5xl font-light">
              Questions & Answers
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-px bg-white/10">
            {FAQS.map((faq, i) => (
              <Card key={i} className="bg-[#0a0a0a] border-0 rounded-none">
                <CardHeader className="border-b border-white/10">
                  <CardTitle className="text-lg font-light">{faq.q}</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <p className="text-gray-500 leading-relaxed">{faq.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Large CTA Section */}
      <section className="py-32 md:py-48 px-6 md:px-12">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-[8vw] md:text-[6vw] font-light leading-[0.9] mb-8">
            Ready to Create?
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto mb-8">
            Purchase credits and start creating professional videos with AI.
            Each video costs just 1 credit.
          </p>
          <p className="text-gray-600 text-sm mb-12">
            Need help? Reach out at{" "}
            <a
              href="mailto:info@remawt.com"
              className="text-white hover:underline transition-colors"
            >
              info@remawt.com
            </a>
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button
              onClick={() => router.push("/creative")}
              className="px-12 py-4 text-lg tracking-wider uppercase rounded-none"
              size="lg"
            >
              Start Creating
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button
              onClick={() => router.push("/projects")}
              className="px-12 py-4 text-lg tracking-wider uppercase rounded-none"
              variant="outline"
              size="lg"
            >
              View Projects
            </Button>
          </div>

          {/* Legal Links */}
          <div className="flex items-center justify-center gap-6 text-xs text-gray-600">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <span>|</span>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms & Conditions
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
