"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-rule-strong bg-paper-3 p-0.5 transition-colors duration-200 ease-out-expo",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className="pointer-events-none block size-3.5 rounded-full bg-ink transition-transform duration-200 ease-out-expo data-[state=checked]:translate-x-4 data-[state=checked]:bg-ink-inverse"
      />
    </SwitchPrimitive.Root>
  );
}

export default Switch;
