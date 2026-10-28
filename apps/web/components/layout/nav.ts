import type { LucideIcon } from "lucide-react";
import { BarChart3, CreditCard, CalendarClock, Clapperboard, Home, Layers, Lightbulb, Radar, Settings2 } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Match exactly instead of by prefix. */
  exact?: boolean;
  /** Extra path patterns that also mark this item active (regex source, anchored). */
  also?: string[];
  /** Paths under the prefix that belong to another destination. */
  exclude?: string[];
}

/**
 * App routes. The (app) route group serves them under /app.
 * The web-app agent owns the pages; change hrefs here, not in AppShell.
 */
export const APP_NAV: NavItem[] = [
  { label: "Home", href: "/app", icon: Home, exact: true },
  { label: "Radar", href: "/app/radar", icon: Radar },
  { label: "Ideas", href: "/app/ideas", icon: Lightbulb },
  { label: "Videos", href: "/app/videos", icon: Clapperboard },
  { label: "Schedule", href: "/app/schedule", icon: CalendarClock },
  { label: "Analytics", href: "/app/analytics", icon: BarChart3 },
  { label: "Series", href: "/app/series", icon: Layers },
];

export const APP_NAV_FOOTER: NavItem[] = [
  { label: "Channel settings", href: "/app/settings", icon: Settings2, also: ["/app/channels/[^/]+/settings"], exclude: ["/app/settings/billing"] },
  { label: "Billing", href: "/app/settings/billing", icon: CreditCard },
];

export const APP_ROUTES = {
  newVideo: "/app/new",
  newChannel: "/onboarding",
  billing: "/app/settings/billing",
  pricing: "/pricing",
} as const;

export function isActive(pathname: string, item: NavItem) {
  if (item.exclude?.some((p) => pathname === p || pathname.startsWith(p + "/"))) return false;
  if (item.also?.some((re) => new RegExp(`^${re}(/|$)`).test(pathname))) return true;
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}
