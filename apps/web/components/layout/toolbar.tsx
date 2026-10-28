import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Filter / action row above a list or table. min-h-10 so it lines up with
 * h-10 inputs and md buttons; wraps on small screens.
 */
export function Toolbar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="toolbar"
      className={cn("flex min-h-10 flex-wrap items-center justify-between gap-3", className)}
      {...props}
    />
  );
}

export function ToolbarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex min-w-0 flex-wrap items-center gap-2", className)} {...props} />;
}
