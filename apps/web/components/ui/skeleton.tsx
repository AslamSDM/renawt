import * as React from "react";
import { cn } from "@/lib/utils";

/** Shimmering placeholder block. Size it to the content it replaces. */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden className={cn("skeleton-shimmer rounded-[2px]", className)} {...props} />;
}

/** Text-line skeleton: matches type-body line height. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-3/5" : "w-full")} />
      ))}
    </div>
  );
}

export default Skeleton;
