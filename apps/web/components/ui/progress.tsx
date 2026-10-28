"use client";

import * as React from "react";
import { Progress as ProgressPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export interface ProgressProps extends React.ComponentProps<typeof ProgressPrimitive.Root> {
  value?: number | null;
  tone?: "accent" | "ink" | "success" | "warning" | "danger";
  size?: "xs" | "sm";
}

const TONES = { accent: "bg-accent", ink: "bg-ink", success: "bg-success", warning: "bg-warning", danger: "bg-danger" } as const;

/** 2px (xs) or 4px (sm) bar. Pass value=null for indeterminate. */
export function Progress({ className, value, tone = "accent", size = "xs", max = 100, ...props }: ProgressProps) {
  const pct = value == null ? null : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      max={max}
      className={cn("relative w-full overflow-hidden rounded-full bg-rule", size === "xs" ? "h-0.5" : "h-1", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full rounded-full transition-[width] duration-300 ease-out-expo",
          TONES[tone],
          pct == null && "w-1/3 animate-[marquee_1.2s_linear_infinite]",
        )}
        style={pct == null ? undefined : { width: `${pct}%` }}
      />
    </ProgressPrimitive.Root>
  );
}

export default Progress;
