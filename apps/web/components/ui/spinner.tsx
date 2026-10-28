import * as React from "react";
import { cn } from "@/lib/utils";

const SIZES = { xs: "size-3", sm: "size-4", md: "size-5", lg: "size-8" } as const;

export interface SpinnerProps extends React.ComponentProps<"span"> {
  size?: keyof typeof SIZES;
  /** Accessible label. Pass "" when the parent already announces loading. */
  label?: string;
}

/** Hairline ring spinner. Inherits currentColor. */
export function Spinner({ size = "sm", label = "Loading", className, ...props }: SpinnerProps) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-label={label || undefined}
      className={cn("inline-block shrink-0 animate-spin rounded-full border border-current/25 border-t-current", SIZES[size], className)}
      {...props}
    />
  );
}

export default Spinner;
