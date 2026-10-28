"use client";

import * as React from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root data-slot="radio-group" className={cn("grid gap-3", className)} {...props} />;
}

export function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "peer grid size-4 shrink-0 place-items-center rounded-full border border-rule-strong bg-paper transition-colors duration-120",
        "hover:border-ink/40 data-[state=checked]:border-accent disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-accent" />
    </RadioGroupPrimitive.Item>
  );
}

/**
 * Card-style radio option (format picker, plan picker, skin picker).
 * Wrap content in it; the whole tile is the hit target.
 */
export function RadioCard({ className, children, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-card"
      className={cn(
        "group relative flex flex-col items-start gap-2 rounded-[2px] border border-rule bg-paper p-5 text-left transition-[border-color,background-color] duration-200 ease-out-expo",
        "hover:border-rule-strong hover:bg-paper-2 data-[state=checked]:border-accent data-[state=checked]:bg-accent-soft",
        "disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      {...props}
    >
      {children}
    </RadioGroupPrimitive.Item>
  );
}
