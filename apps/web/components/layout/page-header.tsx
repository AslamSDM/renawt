import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Buttons, right-aligned on sm+, below the title on phones. Use size="md". */
  actions?: React.ReactNode;
  /** Back link shown above the title. */
  back?: { href: string; label: string };
  /** Meta row under the description: badges, timestamps. */
  meta?: React.ReactNode;
  /** A <TabsList variant="underline"> rendered flush under the header. */
  tabs?: React.ReactNode;
  className?: string;
}

/** Top of every app page. AppShell's content column supplies the spacing below it (gap-8). */
export function PageHeader({ title, description, actions, back, meta, tabs, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-6", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-col gap-2">
          {back && (
            <Link
              href={back.href}
              className="type-small inline-flex w-fit items-center gap-1.5 text-muted transition-colors hover:text-ink"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              {back.label}
            </Link>
          )}
          <h1 className="type-title text-ink">{title}</h1>
          {description && <p className="type-body max-w-[64ch] text-muted">{description}</p>}
          {meta && <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {tabs}
    </header>
  );
}
