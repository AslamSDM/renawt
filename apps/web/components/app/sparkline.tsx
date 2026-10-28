import * as React from "react";
import { cn } from "@/lib/utils";

/** Tiny SVG trend line (no chart lib). Last point gets a dot. Values are drawn relative to their own max. */
export function Sparkline({ values, width = 96, height = 24, className, label }: { values: number[]; width?: number; height?: number; className?: string; label: string }) {
  if (values.length < 2) {
    return (
      <span className={cn("mono-tick text-subtle", className)} aria-label={`${label}: not enough data`}>
        –
      </span>
    );
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - 2 - ((v - min) / span) * (height - 4)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];
  const rising = values[values.length - 1] >= values[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn("overflow-visible", className)} role="img" aria-label={label}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.25} className="text-muted" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={2} className={rising ? "fill-success" : "fill-danger"} />
    </svg>
  );
}
