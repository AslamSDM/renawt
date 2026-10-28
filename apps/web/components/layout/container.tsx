import * as React from "react";
import { cn } from "@/lib/utils";

const WIDTHS = {
  marketing: "max-w-[1400px]",
  app: "max-w-[1200px]",
  prose: "max-w-[720px]",
  full: "max-w-none",
} as const;

export interface ContainerProps extends React.ComponentProps<"div"> {
  width?: keyof typeof WIDTHS;
  /** Drop the page gutters (when a parent already applies them). */
  flush?: boolean;
  as?: "div" | "section" | "header" | "footer" | "main" | "nav";
}

/** Centered column with the only allowed page gutters: px-4 sm:px-6 lg:px-8. */
export function Container({ width = "marketing", flush = false, as: Comp = "div", className, ...props }: ContainerProps) {
  return <Comp className={cn("mx-auto w-full", WIDTHS[width], !flush && "px-4 sm:px-6 lg:px-8", className)} {...props} />;
}
