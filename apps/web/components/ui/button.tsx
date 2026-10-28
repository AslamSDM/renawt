import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

/**
 * Sizes are fixed by DESIGN.md §5: sm h-8, md h-10, lg h-12.
 * Icons inside are sized automatically (sm 14px, md/lg 16px).
 */
export const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-[2px] font-medium tracking-[-0.01em]",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out-expo",
    "active:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-busy:cursor-progress",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-ink-inverse hover:bg-accent-hover shadow-[0_6px_20px_-10px_rgba(59,130,246,0.7)]",
        secondary: "bg-ink text-ink-inverse hover:bg-ink/88",
        outline: "border border-rule-strong bg-transparent text-ink hover:border-ink/40 hover:bg-paper-2",
        ghost: "bg-transparent text-muted hover:bg-paper-2 hover:text-ink",
        destructive: "border border-danger/40 bg-danger-soft text-danger hover:bg-danger/20",
        link: "h-auto! px-0! text-ink underline decoration-rule-strong underline-offset-4 hover:decoration-ink",
      },
      size: {
        sm: "h-8 px-3 text-[13px] [&_svg:not([class*='size-'])]:size-3.5 pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1",
        md: "h-10 px-4 text-sm [&_svg:not([class*='size-'])]:size-4",
        lg: "h-12 px-6 text-[15px] [&_svg:not([class*='size-'])]:size-4",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Shows a spinner, sets aria-busy and disables the button. Ignored with asChild. */
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  loading = false,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  if (asChild) {
    return (
      <Slot.Root data-slot="button" className={cn(buttonVariants({ variant, size, block }), className)} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button
      data-slot="button"
      type={type ?? "button"}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    >
      {loading && <Spinner size={size === "sm" ? "xs" : "sm"} label="" />}
      {children}
    </button>
  );
}

const ICON_SIZES = {
  sm: "size-8 [&_svg:not([class*='size-'])]:size-3.5 pointer-coarse:after:-inset-x-1",
  md: "size-10 [&_svg:not([class*='size-'])]:size-4",
  lg: "size-12 [&_svg:not([class*='size-'])]:size-5",
} as const;

export interface IconButtonProps extends Omit<ButtonProps, "size" | "block"> {
  size?: keyof typeof ICON_SIZES;
  /** Required: icon-only controls must be named. */
  "aria-label": string;
}

/** Square icon-only button. Defaults to ghost. */
export function IconButton({ size = "md", variant = "ghost", className, ...props }: IconButtonProps) {
  return <Button variant={variant} className={cn("px-0", ICON_SIZES[size], className)} {...props} />;
}

export default Button;
