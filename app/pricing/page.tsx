"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Check, Menu, X, ArrowRight } from "lucide-react";

const PRICING_PLANS = [
  {
    name: "Starter",
    price: "0",
    period: "forever",
    description: "For those testing the waters",
    features: [
      "3 videos per month",
      "720p export quality",
      "Basic templates",
      "Standard rendering",
      "Email support"
    ],
    cta: "Start Free",
    popular: false
  },
  {
    name: "Creator",
    price: "29",
    period: "month",
    description: "For the independent creator",
    features: [
      "25 videos per month",
      "1080p export quality",
      "Premium templates",
      "Priority rendering",
      "Custom branding",
      "API access",
      "Chat support"
    ],
    cta: "Get Started",
    popular: true
  },
  {
    name: "Studio",
    price: "99",
    period: "month",
    description: "For agencies and teams",
    features: [
      "Unlimited videos",
      "4K export quality",
      "All templates + custom",
      "Fastest rendering",
      "White-label options",
      "Full API access",
      "Dedicated support",
      "Team collaboration"
    ],
    cta: "Contact Us",
    popular: false
  }
];

const COMPARISON_FEATURES = [
  { feature: "Videos per month", starter: "3", creator: "25", studio: "Unlimited" },
  { feature: "Export quality", starter: "720p", creator: "1080p", studio: "4K" },
  { feature: "Templates", starter: "Basic", creator: "Premium", studio: "All + Custom" },
  { feature: "Rendering speed", starter: "Standard", creator: "Priority", studio: "Fastest" },
  { feature: "Custom branding", starter: "—", creator: "✓", studio: "✓" },
  { feature: "API access", starter: "—", creator: "✓", studio: "✓" },
  { feature: "Team members", starter: "1", creator: "1", studio: "Unlimited" },
  { feature: "Support", starter: "Email", creator: "Chat", studio: "Dedicated" },
];

const FAQS = [
  {
    q: "Can I change plans anytime?",
    a: "Yes, you can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle."
  },
  {
    q: "What happens to unused videos?",
    a: "Unused video credits reset at the start of each billing cycle and do not roll over. Make sure to use them before they expire."
  },
  {
    q: "Is there a free trial?",
    a: "The Starter plan is free forever. You can use it to test the platform and see if it meets your needs before upgrading."
  },
  {
    q: "Can I cancel anytime?",
    a: "Absolutely. There are no long-term contracts or commitments. You can cancel your subscription at any time from your account settings."
  }
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
                Simple
              </h1>
              <h1 className="text-[10vw] md:text-[6vw] font-light leading-[0.9]">
                Pricing
              </h1>
            </div>
            <div className="text-sm tracking-widest text-gray-600 uppercase mt-8 md:mt-0 text-right">
              <span className="block">No Hidden Fees</span>
              <span className="block">Cancel Anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Cards - Grid Layout */}
      <section className="py-24 px-6 md:px-12 border-b border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-px bg-white/10">
            {PRICING_PLANS.map((plan, index) => (
              <Card
                key={plan.name}
                className={`bg-[#0a0a0a] border-0 rounded-none ${plan.popular ? 'relative' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-0 right-0 bg-white text-black text-center py-2 text-xs tracking-widest uppercase">
                    Most Popular
                  </div>
                )}
                
                <CardHeader className={`${plan.popular ? 'pt-16' : ''} pb-8`}>
                  <div className="text-xs text-gray-600 tracking-widest uppercase mb-6">
                    {plan.period === "forever" ? "Free" : `Per ${plan.period}`}
                  </div>
                  
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-6xl font-light">${plan.price}</span>
                  </div>
                  
                  <CardTitle className="text-2xl font-light tracking-wide">
                    {plan.name}
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-2">{plan.description}</p>
                </CardHeader>

                <CardContent className="space-y-6">
                  <ul className="space-y-4">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm">
                        <Check className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-400">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button 
                    className="w-full rounded-none"
                    variant={plan.popular ? "default" : "outline"}
                    size="lg"
                  >
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-24 px-6 md:px-12 border-b border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <span className="text-xs tracking-[0.3em] text-gray-600 uppercase block mb-4">Comparison</span>
            <h2 className="text-4xl md:text-5xl font-light">
              Feature Breakdown
            </h2>
          </div>

          <Card className="bg-transparent border border-white/10 rounded-none">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="py-6 px-8 text-gray-600 font-light text-sm tracking-wider uppercase">Feature</th>
                    <th className="py-6 px-8 text-center text-gray-600 font-light text-sm tracking-wider uppercase">Starter</th>
                    <th className="py-6 px-8 text-center font-light text-sm tracking-wider uppercase">Creator</th>
                    <th className="py-6 px-8 text-center font-light text-sm tracking-wider uppercase">Studio</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_FEATURES.map((row, i) => (
                    <tr key={i} className="border-b border-white/10 last:border-0">
                      <td className="py-6 px-8">{row.feature}</td>
                      <td className="py-6 px-8 text-center text-gray-500">{row.starter}</td>
                      <td className="py-6 px-8 text-center">{row.creator}</td>
                      <td className="py-6 px-8 text-center">{row.studio}</td>
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
            Join thousands of creators producing professional videos with AI. 
            No experience required.
          </p>
          <Button 
            onClick={() => router.push('/projects')}
            className="px-12 py-4 text-lg tracking-wider uppercase rounded-none"
            size="lg"
          >
            Start For Free
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* Footer with Logo */}
      <Footer />
    </div>
  );
}
