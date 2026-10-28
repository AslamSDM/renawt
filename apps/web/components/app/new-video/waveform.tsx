import * as React from "react";
import { cn } from "@/lib/utils";

/** Decorative waveform that fills left→right with upload progress. Bar heights are seeded from the file name. */
export function Waveform({ seed, progress, className }: { seed: string; progress: number; className?: string }) {
  const bars = React.useMemo(() => {
    let h = 2166136261;
    for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    const out: number[] = [];
    for (let i = 0; i < 64; i++) {
      h = Math.imul(h ^ (i + 1), 2654435761);
      const r = ((h >>> 0) % 1000) / 1000;
      const env = Math.sin((i / 63) * Math.PI) * 0.6 + 0.4;
      out.push(Math.max(0.12, r * env));
    }
    return out;
  }, [seed]);
  const filled = Math.round(progress * bars.length);
  return (
    <div className={cn("flex h-16 items-center gap-0.5", className)} aria-hidden>
      {bars.map((b, i) => (
        <span key={i} className={cn("w-full rounded-full transition-colors duration-200", i < filled ? "bg-accent" : "bg-rule-strong")} style={{ height: `${b * 100}%` }} />
      ))}
    </div>
  );
}
