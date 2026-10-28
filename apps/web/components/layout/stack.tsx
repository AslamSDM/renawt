import * as React from "react";
import { cn } from "@/lib/utils";
import { GAP, type Space } from "./spacing";

const ALIGN = { start: "items-start", center: "items-center", end: "items-end", stretch: "items-stretch", baseline: "items-baseline" } as const;
const JUSTIFY = { start: "justify-start", center: "justify-center", end: "justify-end", between: "justify-between" } as const;

interface FlexProps extends React.ComponentProps<"div"> {
  gap?: Space;
  align?: keyof typeof ALIGN;
  justify?: keyof typeof JUSTIFY;
  as?: "div" | "ul" | "ol" | "section" | "header" | "footer" | "nav" | "form" | "li";
}

/** Vertical flow. Default gap 4 (16px). */
export function Stack({ gap = 4, align = "stretch", justify = "start", as: Comp = "div", className, ...props }: FlexProps) {
  const C = Comp as React.ElementType;
  return <C className={cn("flex min-w-0 flex-col", GAP[gap], ALIGN[align], JUSTIFY[justify], className)} {...props} />;
}

/** Horizontal flow. Default gap 2 (8px), wraps by default. */
export function Inline({
  gap = 2,
  align = "center",
  justify = "start",
  wrap = true,
  as: Comp = "div",
  className,
  ...props
}: FlexProps & { wrap?: boolean }) {
  const C = Comp as React.ElementType;
  return (
    <C
      className={cn("flex min-w-0 flex-row", wrap && "flex-wrap", GAP[gap], ALIGN[align], JUSTIFY[justify], className)}
      {...props}
    />
  );
}
