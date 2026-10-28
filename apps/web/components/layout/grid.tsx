import * as React from "react";
import { cn } from "@/lib/utils";
import { GAP, type Space } from "./spacing";

/**
 * Responsive column presets. Breakpoints are fixed so every grid in the app
 * collapses the same way. Need something else? Add a preset here.
 */
const COLS = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
  /** Stat rows: 2-up on phones. */
  stats: "grid-cols-2 lg:grid-cols-4",
  /** Vertical 9:16 tiles (videos, formats). */
  tiles: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
  /** Main + 320px aside (detail pages). */
  aside: "grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]",
} as const;

export interface GridProps extends React.ComponentProps<"div"> {
  cols?: keyof typeof COLS;
  gap?: Space;
  as?: "div" | "ul" | "ol";
}

export function Grid({ cols = 3, gap = 4, as: Comp = "div", className, ...props }: GridProps) {
  const C = Comp as React.ElementType;
  return <C className={cn("grid min-w-0", COLS[cols], GAP[gap], className)} {...props} />;
}
