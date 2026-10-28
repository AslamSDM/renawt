"use client";

import * as React from "react";
import { Separator as SeparatorPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export interface SeparatorProps extends React.ComponentProps<typeof SeparatorPrimitive.Root> {
  strong?: boolean;
}

export function Separator({ className, orientation = "horizontal", decorative = true, strong = false, ...props }: SeparatorProps) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        strong ? "bg-rule-strong" : "bg-rule",
        className,
      )}
      {...props}
    />
  );
}

export default Separator;
