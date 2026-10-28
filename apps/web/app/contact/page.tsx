import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import { ContactForm } from "./ContactForm";

export const metadata = {
  title: "Contact Us",
  description:
    "Get in touch with the Remawt team. Reach out for support, billing questions, partnerships, or anything else about our AI video platform.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <Navbar />

      <section className="border-b border-rule px-6 pb-12 pt-32">
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-10 flex flex-wrap items-center gap-3 border-b border-rule pb-4">
            <span className="mono-label rounded-sm border border-ink px-2 py-1">
              SUPPORT · CONTACT · v1
            </span>
          </div>
          <h1 className="text-[clamp(2.5rem,7vw,6rem)] font-medium leading-[0.95] tracking-[-0.02em]">
            Get in <span className="font-serif-italic">touch.</span>
          </h1>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-12 lg:grid-cols-12">
          <aside className="lg:col-span-4">
            <p className="mono-tick mb-4">REACH US</p>
            <div className="space-y-8 text-base text-ink/85">
              <div>
                <p className="mono-tick mb-1">EMAIL</p>
                <a
                  href="mailto:support@remawt.com"
                  className="text-ink underline decoration-rule-strong underline-offset-4 hover:decoration-ink"
                >
                  support@remawt.com
                </a>
              </div>
              <div>
                <p className="mono-tick mb-1">SUPPORT HOURS</p>
                <p>Monday–Friday, responses within 1–2 business days.</p>
              </div>
              <div>
                <p className="mono-tick mb-1">LEGAL</p>
                <ul className="space-y-1.5 text-sm">
                  <li>
                    <Link href="/terms" className="text-muted hover:text-ink">
                      Terms &amp; Conditions
                    </Link>
                  </li>
                  <li>
                    <Link href="/privacy" className="text-muted hover:text-ink">
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link href="/refund" className="text-muted hover:text-ink">
                      Refund &amp; Cancellation
                    </Link>
                  </li>
                  <li>
                    <Link href="/cookies" className="text-muted hover:text-ink">
                      Cookie Policy
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </aside>

          <div className="lg:col-span-8">
            <p className="mono-tick mb-4">SEND A MESSAGE</p>
            <ContactForm />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
