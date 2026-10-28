"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Check, ChevronsUpDown, LogOut, Menu, Plus, Sparkles, UserRound, CreditCard } from "lucide-react";
import { getPlan } from "@remawt/shared";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APP_NAV, APP_NAV_FOOTER, APP_ROUTES, isActive, type NavItem } from "./nav";
import { useAppStore, useActiveChannel, type ShellChannel, type ShellUsage } from "./app-store";
import type { PlanId } from "@remawt/shared";

/* ─── Data bridge ─────────────────────────────────────────────────────── */

export interface AppShellDataProps {
  channels?: ShellChannel[];
  activeChannelId?: string | null;
  plan?: PlanId;
  usage?: ShellUsage | null;
}

/**
 * Render inside any server layout/page to push DB data into the shell:
 *   <AppShellData channels={...} plan="CREATOR" usage={{ videosUsed: 12, videosLimit: 60 }} />
 */
export function AppShellData(props: AppShellDataProps) {
  const hydrate = useAppStore((s) => s.hydrate);
  const key = JSON.stringify(props);
  React.useEffect(() => {
    hydrate(JSON.parse(key) as AppShellDataProps);
  }, [hydrate, key]);
  return null;
}

/* ─── Pieces ──────────────────────────────────────────────────────────── */

function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="Remawt home" className={cn("flex items-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo/remwat full logo .svg" alt="Remawt" className="block h-8 w-auto" />
    </Link>
  );
}

function ChannelSwatch({ channel, size = "md" }: { channel: ShellChannel | null; size?: "sm" | "md" }) {
  if (channel?.avatarUrl) return <Avatar src={channel.avatarUrl} name={channel.name} shape="square" size={size === "sm" ? "sm" : "md"} />;
  const dim = size === "sm" ? "size-6" : "size-8";
  return (
    <span
      aria-hidden
      className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-[2px] border border-rule-strong", dim)}
      style={{ background: channel?.bg ?? "var(--paper-2)" }}
    >
      <span className="size-2.5 rounded-full" style={{ background: channel?.accent ?? "var(--accent)" }} />
    </span>
  );
}

function ChannelSwitcher() {
  const channels = useAppStore((s) => s.channels);
  const setActive = useAppStore((s) => s.setActiveChannel);
  const active = useActiveChannel();

  if (channels.length === 0) {
    return (
      <Link
        href={APP_ROUTES.newChannel}
        className="flex h-12 items-center gap-3 rounded-[2px] border border-dashed border-rule-strong px-2 text-left transition-colors hover:border-ink/40 hover:bg-paper-2"
      >
        <span className="grid size-8 place-items-center rounded-[2px] bg-paper-2 text-muted">
          <Plus className="size-4" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="type-small truncate font-medium text-ink">Create a channel</span>
          <span className="mono-tick truncate">Pick a niche to start</span>
        </span>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="group flex h-12 w-full items-center gap-3 rounded-[2px] border border-rule bg-paper-2/60 px-2 text-left transition-colors hover:border-rule-strong hover:bg-paper-2 data-[state=open]:border-rule-strong data-[state=open]:bg-paper-2"
        aria-label="Switch channel"
      >
        <ChannelSwatch channel={active} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="type-small truncate font-medium text-ink">{active?.name ?? "Select channel"}</span>
          {active?.niche && <span className="mono-tick truncate">{active.niche}</span>}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-subtle" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[calc(var(--sidebar-w)-24px)]">
        <DropdownMenuLabel>Channels</DropdownMenuLabel>
        {channels.map((c) => (
          <DropdownMenuItem key={c.id} onSelect={() => setActive(c.id)} className="h-10">
            <ChannelSwatch channel={c} size="sm" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">{c.name}</span>
            </span>
            {c.id === active?.id && <Check className="text-accent!" aria-label="Active" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={APP_ROUTES.newChannel}>
            <Plus /> New channel
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const active = isActive(pathname, item);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "type-small flex h-9 items-center gap-3 rounded-[2px] px-2 font-medium transition-colors duration-120",
        active ? "bg-paper-3 text-ink" : "text-muted hover:bg-paper-2 hover:text-ink",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-accent" : "text-subtle")} strokeWidth={1.75} aria-hidden />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function UsageMeter() {
  const planId = useAppStore((s) => s.plan);
  const usage = useAppStore((s) => s.usage);
  const plan = getPlan(planId);
  const limit = usage?.videosLimit ?? plan.videosPerMonth;
  const used = usage?.videosUsed ?? null;
  const pct = used == null || limit === 0 ? 0 : (used / limit) * 100;
  const tone = pct >= 100 ? "danger" : pct >= 80 ? "warning" : "accent";

  return (
    <div className="flex flex-col gap-3 rounded-[2px] border border-rule bg-paper-2/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="mono-tick">This month</span>
        <Badge variant={plan.id === "FREE" ? "neutral" : "accent"}>{plan.name}</Badge>
      </div>
      <div className="flex items-baseline gap-1 tabular-nums">
        <span className="type-subheading text-ink">{used ?? "–"}</span>
        <span className="type-small text-muted">/ {limit}</span>
      </div>
      <Progress value={used ?? 0} max={Math.max(1, limit)} tone={tone} aria-label="Monthly video quota used" />
      {plan.id !== "AGENCY" && (
        <Link href={APP_ROUTES.pricing} className="type-caption inline-flex items-center gap-1.5 text-muted transition-colors hover:text-ink">
          <Sparkles className="size-3.5 text-accent" aria-hidden />
          {plan.id === "FREE" ? "Upgrade to post automatically" : "Compare plans"}
        </Link>
      )}
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? "";
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center border-b border-rule px-5">
        <Wordmark />
      </div>
      <div className="p-3">
        <ChannelSwitcher />
      </div>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
        {APP_NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
        <div className="my-3 h-px bg-rule" />
        {APP_NAV_FOOTER.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </nav>
      <div className="shrink-0 border-t border-rule p-3">
        <UsageMeter />
      </div>
    </div>
  );
}

function UserMenu() {
  const { data: session, status } = useSession();
  if (status === "loading") return <span className="size-8 animate-pulse rounded-full bg-paper-3" aria-hidden />;
  if (!session?.user) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/signin?callbackUrl=/app">Sign in</Link>
      </Button>
    );
  }
  const user = session.user;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full transition-opacity hover:opacity-80" aria-label="Account menu">
        <Avatar src={user.image} name={user.name ?? user.email} size="md" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <div className="flex flex-col gap-0.5 px-2 py-2">
          <span className="type-small truncate font-medium text-ink">{user.name ?? "Account"}</span>
          {user.email && <span className="type-caption truncate text-muted">{user.email}</span>}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/settings">
            <UserRound /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={APP_ROUTES.billing}>
            <CreditCard /> Billing
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => signOut({ callbackUrl: "/" })}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─── Shell ───────────────────────────────────────────────────────────── */

export interface AppShellProps {
  children: React.ReactNode;
  /** Optional element in the topbar left (breadcrumb). */
  topbarStart?: React.ReactNode;
  /** Override the default topbar right-side actions (New video). */
  topbarEnd?: React.ReactNode;
}

/**
 * Sidebar 240 + topbar 56 + content column (max 1200, gutters, py-8, children gap-8).
 * On < lg the sidebar moves into a left Sheet.
 */
export function AppShell({ children, topbarStart, topbarEnd }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    void useAppStore.persist.rehydrate();
  }, []);
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <TooltipProvider>
      <div className="min-h-dvh bg-surface text-ink">
        <a
          href="#app-main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[2px] focus:bg-ink focus:px-3 focus:py-2 focus:text-ink-inverse"
        >
          Skip to content
        </a>

        <aside className="fixed inset-y-0 left-0 z-30 hidden w-(--sidebar-w) border-r border-rule bg-paper lg:block">
          <SidebarContent />
        </aside>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-(--sidebar-w) p-0" hideClose>
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-h-dvh flex-col lg:pl-(--sidebar-w)">
          <header className="glass sticky top-0 z-20 h-14 border-b border-rule">
            <div className="flex h-full items-center gap-3 px-4 sm:px-6 lg:px-8">
              <IconButton aria-label="Open navigation" size="sm" className="-ml-1.5 lg:hidden" onClick={() => setMobileOpen(true)}>
                <Menu />
              </IconButton>
              <div className="lg:hidden">
                <Wordmark />
              </div>
              <div className="hidden min-w-0 flex-1 lg:block">{topbarStart}</div>
              <div className="ml-auto flex items-center gap-2">
                {topbarEnd ?? (
                  <Button asChild size="sm">
                    <Link href={APP_ROUTES.newVideo}>
                      <Plus /> <span className="hidden sm:inline">New video</span>
                      <span className="sm:hidden">New</span>
                    </Link>
                  </Button>
                )}
                <UserMenu />
              </div>
            </div>
          </header>

          <main id="app-main" className="flex-1">
            <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">{children}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
