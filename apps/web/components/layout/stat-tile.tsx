import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface StatTileProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Signed change, e.g. 12.4 → "+12.4%". Use deltaLabel to override text. */
  delta?: number | null;
  deltaLabel?: React.ReactNode;
  /** Set false when "down" is good (e.g. cost). */
  higherIsBetter?: boolean;
  hint?: React.ReactNode;
  loading?: boolean;
  className?: string;
}

/** Number tile. Value uses type-stat (tabular nums). Fixed p-5 per DESIGN.md. */
export function StatTile({ label, value, delta, deltaLabel, higherIsBetter = true, hint, loading, className }: StatTileProps) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const up = hasDelta && (delta as number) >= 0;
  const good = hasDelta && (up === higherIsBetter);
  return (
    <div className={cn("flex min-w-0 flex-col gap-3 rounded-[2px] border border-rule bg-paper p-5", className)}>
      <p className="mono-tick truncate">{label}</p>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="type-stat text-ink">{value}</span>
          {hasDelta && (
            <span className={cn("type-caption inline-flex items-center gap-0.5 font-medium tabular-nums", good ? "text-success" : "text-danger")}>
              {up ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
              {deltaLabel ?? `${up ? "+" : ""}${(delta as number).toFixed(1)}%`}
            </span>
          )}
        </div>
      )}
      {hint && <p className="type-caption text-subtle">{hint}</p>}
    </div>
  );
}
