import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy",
  description:
    "Learn how Remawt collects, uses, and protects your personal data. Our commitment to privacy and data security for our AI video creation platform.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-white selection:text-black">
      <Navbar />

      <section className="pt-32 pb-16 px-6 md:px-12 border-b border-white/10">
        <div className="max-w-4xl mx-auto">
          <span className="text-xs tracking-[0.3em] text-gray-600 uppercase block mb-4">
            Legal
          </span>
          <h1 className="text-[10vw] md:text-[4vw] font-light leading-[0.9] mb-4">
            Privacy Policy
          </h1>
          <p className="text-gray-500 text-sm">Last updated: March 11, 2026</p>
        </div>
      </section>

      <section className="py-16 px-6 md:px-12">
        <div className="max-w-4xl mx-auto prose prose-invert prose-gray">
          <div className="space-y-12 text-gray-400 leading-relaxed">
            <div>
              <h2 className="text-xl font-light text-white mb-4">1. Introduction</h2>
              <p>
                Remawt (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates the remawt.com website and
                AI video generation platform. This Privacy Policy explains how we collect, use,
                disclose, and safeguard your information when you visit our website and use our
                services.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-light text-white mb-4">2. Information We Collect</h2>
              <h3 className="text-sm tracking-widest uppercase text-gray-500 mb-3">Personal Information</h3>
              <p>When you create an account or use our services, we may collect:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Name and email address</li>
                <li>Account credentials (managed via OAuth providers)</li>
                <li>Payment information (processed securely by Dodo Payments)</li>
                <li>Project data and generated content</li>
              </ul>

              <h3 className="text-sm tracking-widest uppercase text-gray-500 mb-3 mt-6">Automatically Collected Information</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>IP address and browser type</li>
                <li>Device information and operating system</li>
                <li>Usage data (pages visited, features used, time spent)</li>
                <li>Cookies and similar tracking technologies</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-light text-white mb-4">3. How We Use Your Information</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Provide, maintain, and improve our AI video generation services</li>
                <li>Process transactions and manage your account</li>
                <li>Send service-related communications and updates</li>
                <li>Respond to support requests and inquiries</li>
                <li>Analyze usage patterns to improve our platform</li>
                <li>Detect and prevent fraud or abuse</li>
                <li>Comply with legal obligations</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-light text-white mb-4">4. Data Storage and Security</h2>
              <p>
                Your data is stored on secure servers. We implement appropriate technical and
                organizational measures to protect your personal information against unauthorized
                access, alteration, disclosure, or destruction. Generated videos and project data
                are stored in secure cloud storage (Cloudflare R2).
              </p>
            </div>

            <div>
              <h2 className="text-xl font-light text-white mb-4">5. Third-Party Services</h2>
              <p>We use the following third-party services that may process your data:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li><strong className="text-gray-300">Dodo Payments</strong> — payment processing</li>
                <li><strong className="text-gray-300">Cloudflare</strong> — hosting, CDN, and storage</li>
                <li><strong className="text-gray-300">OAuth Providers</strong> (Google, GitHub) — authentication</li>
                <li><strong className="text-gray-300">AI Model Providers</strong> — video content generation</li>
              </ul>
              <p className="mt-3">
                Each third-party service has its own privacy policy governing how they handle your data.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-light text-white mb-4">6. Your Rights</h2>
              <p>Depending on your jurisdiction, you may have the right to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Access the personal data we hold about you</li>
                <li>Request correction or deletion of your data</li>
                <li>Object to or restrict processing of your data</li>
                <li>Request data portability</li>
                <li>Withdraw consent at any time</li>
              </ul>
              <p className="mt-3">
                To exercise any of these rights, contact us at{" "}
                <a href="mailto:support@remawt.com" className="text-white hover:underline">support@remawt.com</a>.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-light text-white mb-4">7. Cookies</h2>
              <p>
                We use essential cookies to maintain your session and preferences. We may also
                use analytics cookies to understand how our platform is used. You can control
                cookie preferences through your browser settings.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-light text-white mb-4">8. Data Retention</h2>
              <p>
                We retain your personal data for as long as your account is active or as needed
                to provide services. Generated videos and project data are retained until you
                delete them or close your account. We may retain certain data as required by law.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-light text-white mb-4">9. Children&apos;s Privacy</h2>
              <p>
                Our services are not intended for users under the age of 16. We do not knowingly
                collect personal information from children under 16.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-light text-white mb-4">10. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any
                material changes by posting the updated policy on this page and updating the
                &quot;Last updated&quot; date.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-light text-white mb-4">11. Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy, please contact us at:{" "}
                <a href="mailto:support@remawt.com" className="text-white hover:underline">support@remawt.com</a>
              </p>
            </div>
          </div>

          <div className="mt-16 pt-8 border-t border-white/10 flex gap-6 text-sm text-gray-600">
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms & Conditions
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
