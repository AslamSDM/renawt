import * as React from "react";
import type { Beat } from "@remawt/shared";
import { cn } from "@/lib/utils";

/** Proportional beat strip for a format (hook / body / payoff / loop). Shares sum to 1. */
export function BeatBar({ beats, seconds, className, showLabels = true }: { beats: Beat[]; seconds?: number; className?: string; showLabels?: boolean }) {
  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {beats.map((b, i) => (
          <span
            key={b.id}
            className={cn("h-full", i === 0 ? "bg-accent" : i === beats.length - 1 ? "bg-ink/30" : "bg-ink/60")}
            style={{ flexGrow: b.share, flexBasis: 0 }}
          />
        ))}
      </div>
      {showLabels && (
        <ol className="flex w-full gap-0.5" aria-label="Beats">
          {beats.map((b) => (
            <li key={b.id} className="mono-tick min-w-0 truncate tabular-nums" style={{ flexGrow: b.share, flexBasis: 0 }} title={`${b.label}: ${b.note}`}>
              {b.share >= 0.15 ? `${b.label}${seconds ? ` ${Math.round(b.share * seconds)}s` : ""}` : ""}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
