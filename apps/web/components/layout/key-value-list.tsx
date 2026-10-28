import * as React from "react";
import { cn } from "@/lib/utils";

export interface KeyValueItem {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Right-align + tabular nums. */
  numeric?: boolean;
}

/**
 * Definition list for details panels. Rows are 40px min with hairline
 * separators. stacked = label above value (narrow asides).
 */
export function KeyValueList({ items, layout = "inline", className }: { items: KeyValueItem[]; layout?: "inline" | "stacked"; className?: string }) {
  return (
    <dl className={cn("flex flex-col", className)}>
      {items.map((it, i) => (
        <div
          key={i}
          className={cn(
            "border-b border-rule last:border-b-0",
            layout === "inline" ? "grid min-h-10 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-4 py-2" : "flex flex-col gap-1 py-3",
          )}
        >
          <dt className="type-small text-muted">{it.label}</dt>
          <dd className={cn("type-body min-w-0 break-words text-ink", it.numeric && "tabular-nums", layout === "inline" && it.numeric && "text-right")}>
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
