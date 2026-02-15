"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Check, ArrowRight, Coins } from "lucide-react";
import { subscriptionPlans } from "@/lib/dodo/subscription";
import CheckoutButton from "./_components/CheckoutButton";

// Credit packages - based on the credit system implementation

// Cost per video breakdown
const COST_BREAKDOWN = [
  { package: "Starter", credits: 100, price: 20, costPerVideo: "$0.20" },
  { package: "Creator", credits: 500, price: 39, costPerVideo: "$0.078" },
  { package: "Studio", credits: 2000, price: 149, costPerVideo: "$0.075" },
];

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
    a: "Yes! For teams or agencies needing larger volumes, contact us for custom pricing.",
  },
];

export default function PricingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-white selection:text-black">
      {/* Film Grain Overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-50 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Navigation with Logo */}
      <Navbar />

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6 md:px-12 border-b border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8">
            <div>
              <span className="text-xs tracking-[0.3em] text-gray-600 uppercase block mb-4">Pricing</span>
              <h1 className="text-[10vw] md:text-[6vw] font-light leading-[0.9]">
                Credit
              </h1>
              <h1 className="text-[10vw] md:text-[6vw] font-light leading-[0.9]">
                System
              </h1>
            </div>
            <div className="text-sm tracking-widest text-gray-600 uppercase mt-8 md:mt-0 text-right">
              <span className="block">Pay As You Go</span>
              <span className="block">Credits Never Expire</span>
            </div>
          </div>
        </div>
      </section>

      {/* Credit Packages - Grid Layout */}
      <section className="py-24 px-6 md:px-12 border-b border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-px bg-white/10">
            {subscriptionPlans.map((pkg) => (
              <Card
                key={pkg.title}
                className={`bg-[#0a0a0a] border-0 rounded-none ${pkg.popular ? 'relative' : ''}`}
              >
                {pkg.popular && (
                  <div className="absolute top-0 left-0 right-0 bg-white text-black text-center py-2 text-xs tracking-widest uppercase">
                    Most Popular
                  </div>
                )}

                <CardHeader className={`${pkg.popular ? 'pt-16' : ''} pb-8`}>
                  <div className="flex items-center gap-2 text-xs text-gray-600 tracking-widest uppercase mb-6">
                    <Coins className="w-4 h-4" />
                    <span>One-time purchase</span>
                  </div>

                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-6xl font-light">${pkg.price}</span>
                  </div>

                  <CardTitle className="text-2xl font-light tracking-wide">
                    {pkg.title}
                  </CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-light text-white">{pkg.creditsPerCycle}</span>
                    <span className="text-sm text-gray-500 ml-2">credits</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">{pkg.description}</p>
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
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Cost Breakdown */}
      <section className="py-24 px-6 md:px-12 border-b border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <span className="text-xs tracking-[0.3em] text-gray-600 uppercase block mb-4">Value</span>
            <h2 className="text-4xl md:text-5xl font-light">
              Simple Pricing
            </h2>
            <p className="text-gray-500 mt-4 max-w-xl">
              Each video costs 1 credit. The more credits you buy, the lower your cost per video.
            </p>
          </div>

          <Card className="bg-transparent border border-white/10 rounded-none">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="py-6 px-8 text-gray-600 font-light text-sm tracking-wider uppercase">Package</th>
                    <th className="py-6 px-8 text-center text-gray-600 font-light text-sm tracking-wider uppercase">Credits</th>
                    <th className="py-6 px-8 text-center text-gray-600 font-light text-sm tracking-wider uppercase">Price</th>
                    <th className="py-6 px-8 text-center font-light text-sm tracking-wider uppercase">Cost per video</th>
                  </tr>
                </thead>
                <tbody>
                  {COST_BREAKDOWN.map((row, i) => (
                    <tr key={i} className="border-b border-white/10 last:border-0">
                      <td className="py-6 px-8 font-light">{row.package}</td>
                      <td className="py-6 px-8 text-center text-gray-500">{row.credits}</td>
                      <td className="py-6 px-8 text-center text-gray-500">${row.price}</td>
                      <td className="py-6 px-8 text-center">{row.costPerVideo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 px-6 md:px-12 border-b border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <span className="text-xs tracking-[0.3em] text-gray-600 uppercase block mb-4">FAQ</span>
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
          <p className="text-gray-500 max-w-xl mx-auto mb-12">
            Purchase credits and start creating professional videos with AI.
            Each video costs just 1 credit.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => router.push('/creative')}
              className="px-12 py-4 text-lg tracking-wider uppercase rounded-none"
              size="lg"
            >
              Start Creating
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button
              onClick={() => router.push('/projects')}
              className="px-12 py-4 text-lg tracking-wider uppercase rounded-none"
              variant="outline"
              size="lg"
            >
              View Projects
            </Button>
          </div>
        </div>
      </section>

      {/* Footer with Logo */}
      <Footer />
    </div>
  );
}
