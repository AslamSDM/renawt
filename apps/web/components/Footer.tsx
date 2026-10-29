import Link from "next/link";
import { Container } from "@/components/layout/container";

const COLS = [
  {
    heading: "Product",
    items: [
      { label: "How it works", href: "/#product" },
      { label: "Formats", href: "/#formats" },
      { label: "Identity Kit", href: "/#identity" },
      { label: "Niche Radar", href: "/#radar" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    heading: "Company",
    items: [
      { label: "Contact", href: "/contact" },
      { label: "support@remawt.com", href: "mailto:support@remawt.com" },
    ],
  },
  {
    heading: "Legal",
    items: [
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
      { label: "Refunds", href: "/refund" },
      { label: "Cookies", href: "/cookies" },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-rule bg-surface">
      <div>
        <Container className="grid grid-cols-2 gap-10 py-16 md:grid-cols-4 lg:grid-cols-12">
          <div className="col-span-2 flex flex-col gap-4 lg:col-span-6">
            <Link href="/" aria-label="Remawt home" className="w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo/remwat full logo .svg" alt="Remawt" className="h-10 w-auto" />
            </Link>
            <p className="type-small max-w-[40ch] text-muted">
              Faceless, <span className="font-serif-italic">not soulless.</span> Motion-graphics shorts for faceless channels: one identity kit, every video, posted on schedule.
            </p>
          </div>
          {COLS.map((c) => (
            <div key={c.heading} className="flex flex-col gap-4 lg:col-span-2">
              <h3 className="mono-tick">{c.heading}</h3>
              <ul className="flex flex-col gap-3">
                {c.items.map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className="type-small break-all text-ink/80 transition-colors hover:text-ink">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Container>
      </div>

      <div className="border-t border-rule">
        <Container className="flex flex-col items-start justify-between gap-3 py-6 sm:flex-row sm:items-center">
          <p className="mono-tick">© {year} Remawt</p>
          <p className="mono-tick tabular-nums">1080 × 1920 · 30 fps · H.264</p>
        </Container>
      </div>
    </footer>
  );
}

export default Footer;
