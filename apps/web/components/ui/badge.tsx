import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

/** Badges are 20px tall mono caps. Use for status, plan, format and platform tags. */
export const badgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[2px] border px-1.5 font-mono text-[10px] uppercase leading-none tracking-[0.12em] [&>svg]:size-3",
  {
    variants: {
      variant: {
        neutral: "border-rule bg-paper-2 text-muted",
        outline: "border-rule-strong bg-transparent text-ink",
        accent: "border-accent-line bg-accent-soft text-accent",
        success: "border-success/30 bg-success-soft text-success",
        warning: "border-warning/30 bg-warning-soft text-warning",
        danger: "border-danger/30 bg-danger-soft text-danger",
        solid: "border-ink bg-ink text-ink-inverse",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps extends React.ComponentProps<"span">, VariantProps<typeof badgeVariants> {
  asChild?: boolean;
  /** Leading status dot in the current color. */
  dot?: boolean;
}

export function Badge({ className, variant, asChild = false, dot = false, children, ...props }: BadgeProps) {
  const Comp = asChild ? Slot.Root : "span";
  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </Comp>
  );
}

export default Badge;
