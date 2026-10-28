"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { ArrowUpRight, LayoutGrid, LogOut, Menu, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV_LINKS = [
  { label: "Product", href: "/#product" },
  { label: "Formats", href: "/#formats" },
  { label: "Pricing", href: "/pricing" },
];

export interface NavbarProps {
  /** Hide center links (auth/legal pages). */
  showNavLinks?: boolean;
}

/** Fixed marketing navbar: 64px, blur, hairline rule. */
export function Navbar({ showNavLinks = true }: NavbarProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const user = session?.user;
  const startFree = () => signIn("google", { callbackUrl: "/app" });

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 h-16 border-b transition-[background-color,border-color] duration-300 ease-out-expo",
        scrolled ? "glass border-rule" : "border-transparent bg-surface/40 backdrop-blur-md",
      )}
    >
      <nav aria-label="Primary" className="mx-auto flex h-full max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Remawt home" className="flex shrink-0 items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/remwat full logo .svg" alt="Remawt" className="block h-9 w-auto" />
        </Link>

        {showNavLinks && (
          <ul className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((l) => {
              const active = pathname === l.href;
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "type-small inline-flex h-8 items-center rounded-[2px] px-3 transition-colors duration-200",
                      active ? "text-ink" : "text-muted hover:text-ink",
                    )}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex items-center gap-2">
          {status === "loading" ? (
            <span className="h-8 w-24 animate-pulse rounded-[2px] bg-paper-3" aria-hidden />
          ) : user ? (
            <>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/app">
                  Open app <ArrowUpRight />
                </Link>
              </Button>
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
                    <Link href="/app">
                      <LayoutGrid /> Open app
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/app/settings/billing">
                      <CreditCard /> Billing
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onSelect={() => signOut({ callbackUrl: "/" })}>
                    <LogOut /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={startFree}>
                Sign in
              </Button>
              <Button size="sm" onClick={startFree}>
                Start free
              </Button>
            </>
          )}
          {showNavLinks && (
            <IconButton aria-label="Open menu" size="sm" className="md:hidden" onClick={() => setOpen(true)}>
              <Menu />
            </IconButton>
          )}
        </div>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[min(100vw,320px)]">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="flex h-16 items-center border-b border-rule px-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo/remwat full logo .svg" alt="Remawt" className="h-8 w-auto" />
          </div>
          <ul className="flex flex-col p-3">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="type-heading flex h-12 items-center rounded-[2px] px-2 text-ink transition-colors hover:bg-paper-2"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-col gap-2 border-t border-rule p-5">
            {user ? (
              <>
                <Button asChild block>
                  <Link href="/app" onClick={() => setOpen(false)}>
                    Open app <ArrowUpRight />
                  </Link>
                </Button>
                <Button variant="ghost" block onClick={() => signOut({ callbackUrl: "/" })}>
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Button block onClick={startFree}>
                  Start free
                </Button>
                <Button variant="outline" block onClick={startFree}>
                  Sign in
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}

export default Navbar;
