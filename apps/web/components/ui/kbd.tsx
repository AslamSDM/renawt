import * as React from "react";
import { cn } from "@/lib/utils";

export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[2px] border border-rule-strong bg-paper-2 px-1 font-mono text-[10px] leading-none text-muted",
        className,
      )}
      {...props}
    />
  );
}

export default Kbd;
