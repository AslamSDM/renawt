import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import Link from "next/link";

export const metadata = {
  title: "Terms & Conditions",
  description:
    "Terms and conditions for using the Remawt AI video creation platform. Covers accounts, credits, payments, acceptable use, and intellectual property.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-white selection:text-black">
      <Navbar />

      <section className="pt-32 pb-16 px-6 md:px-12 border-b border-white/10">
        <div className="max-w-4xl mx-auto">
          <span className="text-xs tracking-[0.3em] text-gray-600 uppercase block mb-4">
            Legal
          </span>
          <h1 className="text-[10vw] md:text-[4vw] font-light leading-[0.9] mb-4">
            Terms & Conditions
          </h1>
          <p className="text-gray-500 text-sm">Last updated: March 11, 2026</p>
        </div>
      </section>

      <section className="py-16 px-6 md:px-12">
        <div className="max-w-4xl mx-auto prose prose-invert prose-gray">
          <div className="space-y-12 text-gray-400 leading-relaxed">
            <div>
              <h2 className="text-xl font-light text-white mb-4">1. Acceptance of Terms</h2>
              <p>
                By accessing or using Remawt (&quot;the Service&quot;), operated by Remawt (&quot;we,&quot;
                &quot;our,&quot; or &quot;us&quot;), you agree to be bound by these Terms & Conditions. If you
                do not agree to these terms, do not use the Service.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-light text-white mb-4">2. Description of Service</h2>
              <p>
                Remawt is an AI-powered video generation platform that allows users to create
                professional motion graphics, product demos, and explainer videos. The Service
                includes website scraping, AI content analysis, code generation, and video
                rendering capabilities.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-light text-white mb-4">3. Account Registration</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>You must provide accurate and complete information when creating an account</li>
                <li>You are responsible for maintaining the security of your account credentials</li>
                <li>You must be at least 16 years of age to use the Service</li>
                <li>One person or entity may not maintain more than one account</li>
                <li>You are responsible for all activities that occur under your account</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-light text-white mb-4">4. Credits and Payments</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Credits are required to generate and export videos</li>
                <li>Each video export costs 1 credit regardless of length or quality settings</li>
                <li>Credits are non-refundable once purchased</li>
                <li>Credits do not expire and remain in your account until used</li>
                <li>Prices are subject to change with reasonable notice</li>
                <li>All payments are processed securely through Dodo Payments</li>
                <li>Annual plans are billed as a single upfront payment for 12 months</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-light text-white mb-4">5. Acceptable Use</h2>
              <p>You agree not to use the Service to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Generate content that is illegal, harmful, threatening, abusive, or defamatory</li>
                <li>Create misleading or deceptive content (deepfakes, impersonation)</li>
                <li>Infringe on intellectual property rights of others</li>
                <li>Distribute malware or conduct phishing attacks</li>
                <li>Attempt to gain unauthorized access to the Service or its systems</li>
                <li>Scrape or extract data from the Service beyond normal use</li>
                <li>Resell or redistribute the Service without authorization</li>
                <li>Generate content depicting minors in harmful situations</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-light text-white mb-4">6. Intellectual Property</h2>
              <h3 className="text-sm tracking-widest uppercase text-gray-500 mb-3">Your Content</h3>
              <p>
                You retain ownership of the content you create using the Service, including
                generated videos. By using the Service, you grant us a limited license to process
                your inputs (URLs, text, preferences) solely for the purpose of generating your
                requested content.
              </p>

              <h3 className="text-sm tracking-widest uppercase text-gray-500 mb-3 mt-6">Our Platform</h3>
              <p>
                The Service, including its code, design, features, and branding, is owned by
                Remawt and protected by intellectual property laws. You may not copy, modify, or
                reverse-engineer any part of the Service.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-light text-white mb-4">7. AI-Generated Content</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Content is generated by AI models and may not always be accurate or suitable</li>
                <li>You are responsible for reviewing and approving all generated content before use</li>
                <li>We do not guarantee that generated content will be free from errors or biases</li>
                <li>Generated videos should comply with applicable laws and regulations in your jurisdiction</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-light text-white mb-4">8. Service Availability</h2>
              <p>
                We strive to provide reliable service but do not guarantee uninterrupted access.
                The Service may be temporarily unavailable due to maintenance, updates, or
                circumstances beyond our control. We are not liable for any loss resulting from
                service interruptions.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-light text-white mb-4">9. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, Remawt shall not be liable for any
                indirect, incidental, special, consequential, or punitive damages, including but
                not limited to loss of profits, data, or business opportunities, arising from
                your use of or inability to use the Service.
              </p>
              <p className="mt-3">
                Our total liability for any claims arising from the Service shall not exceed the
                amount you paid to us in the 12 months preceding the claim.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-light text-white mb-4">10. Termination</h2>
              <p>
                We reserve the right to suspend or terminate your account at any time for
                violation of these terms or for any reason at our discretion. Upon termination,
                your right to use the Service ceases immediately. Unused credits are
                non-refundable upon termination for cause.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-light text-white mb-4">11. Indemnification</h2>
              <p>
                You agree to indemnify and hold harmless Remawt from any claims, damages, or
                expenses arising from your use of the Service, your content, or your violation
                of these terms.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-light text-white mb-4">12. Changes to Terms</h2>
              <p>
                We may modify these terms at any time. Material changes will be communicated
                via email or through the Service. Continued use after changes constitutes
                acceptance of the updated terms.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-light text-white mb-4">13. Governing Law</h2>
              <p>
                These terms shall be governed by and construed in accordance with applicable laws.
                Any disputes arising from these terms or the Service shall be resolved through
                good-faith negotiation, and if necessary, binding arbitration.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-light text-white mb-4">14. Contact</h2>
              <p>
                For questions about these Terms & Conditions, contact us at:{" "}
                <a href="mailto:info@remawt.com" className="text-white hover:underline">info@remawt.com</a>
              </p>
            </div>
          </div>

          <div className="mt-16 pt-8 border-t border-white/10 flex gap-6 text-sm text-gray-600">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/pricing" className="hover:text-white transition-colors">
              Pricing
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
