import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

interface StateProps {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Primary action (Button md). Secondary actions go in the same node. */
  action?: React.ReactNode;
  /** compact = inside a card/table (py-10), default = page-level (py-16). */
  size?: "compact" | "default";
  /** Use "h1" when the state is the whole page (not-found, error boundary). */
  titleAs?: "p" | "h1" | "h2";
  className?: string;
}

function Frame({ size = "default", className, children, role }: { size?: StateProps["size"]; className?: string; children: React.ReactNode; role?: string }) {
  return (
    <div
      role={role}
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-[2px] border border-dashed border-rule-strong px-6 text-center",
        size === "compact" ? "py-10" : "py-16",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Nothing here yet. Always say what goes here and give the one action that fills it. */
export function EmptyState({ icon: Icon, title, description, action, size, titleAs: Title = "p", className }: StateProps) {
  return (
    <Frame size={size} className={className}>
      {Icon && (
        <span className="grid size-10 place-items-center rounded-[2px] border border-rule bg-paper-2 text-muted">
          <Icon className="size-5" strokeWidth={1.6} aria-hidden />
        </span>
      )}
      <div className="flex max-w-[44ch] flex-col gap-1.5">
        <Title className="type-subheading text-ink">{title}</Title>
        {description && <p className="type-small text-muted">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center justify-center gap-2 pt-1">{action}</div>}
    </Frame>
  );
}

/** Something failed. Name the problem and the recovery; action is usually "Try again". */
export function ErrorState({ icon: Icon = AlertTriangle, title, description, action, size, titleAs: Title = "p", className }: StateProps) {
  return (
    <Frame size={size} role="alert" className={cn("border-solid border-danger/30 bg-danger-soft/40", className)}>
      <span className="grid size-10 place-items-center rounded-[2px] border border-danger/30 bg-danger-soft text-danger">
        <Icon className="size-5" strokeWidth={1.6} aria-hidden />
      </span>
      <div className="flex max-w-[44ch] flex-col gap-1.5">
        <Title className="type-subheading text-ink">{title}</Title>
        {description && <p className="type-small text-muted">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center justify-center gap-2 pt-1">{action}</div>}
    </Frame>
  );
}

/** Whole-region loading. Prefer Skeletons shaped like the content; use this only for unknown shapes. */
export function LoadingState({ label = "Loading", size, className }: { label?: string; size?: StateProps["size"]; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-3 text-muted", size === "compact" ? "py-10" : "py-16", className)} role="status">
      <Spinner size="sm" label="" />
      <span className="mono-tick">{label}</span>
    </div>
  );
}
