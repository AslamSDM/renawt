import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Card padding is p-5 (dense, default) or p-6 (comfortable). DESIGN.md §4.
 * Sub-parts carry no padding of their own; the Card sets it, parts stack with gap-4.
 */
const cardVariants = cva("flex flex-col rounded-[2px] border text-ink", {
  variants: {
    tone: {
      default: "border-rule bg-paper",
      wash: "border-rule bg-paper-2",
      outline: "border-rule-strong bg-transparent",
      accent: "border-accent-line bg-paper",
    },
    padding: { none: "", sm: "gap-4 p-5", md: "gap-4 p-6" },
    interactive: {
      true: "transition-[border-color,background-color] duration-200 ease-out-expo hover:border-rule-strong hover:bg-paper-2 focus-within:border-rule-strong",
      false: "",
    },
  },
  defaultVariants: { tone: "default", padding: "sm", interactive: false },
});

export interface CardProps extends React.ComponentProps<"div">, VariantProps<typeof cardVariants> {}

export function Card({ className, tone, padding, interactive, ...props }: CardProps) {
  return <div data-slot="card" className={cn(cardVariants({ tone, padding, interactive }), className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-1", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 data-slot="card-title" className={cn("type-subheading col-start-1 text-ink", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="card-description" className={cn("type-small col-start-1 text-muted", className)} {...props} />;
}

/** Top-right slot inside CardHeader (menu, badge, icon button). */
export function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 flex items-center gap-2 self-start", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("type-body text-ink", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("mt-auto flex items-center gap-2 border-t border-rule pt-4", className)}
      {...props}
    />
  );
}

export default Card;
