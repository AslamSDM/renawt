"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer grid size-4 shrink-0 place-items-center rounded-[2px] border border-rule-strong bg-paper transition-colors duration-120",
        "hover:border-ink/40 data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-ink-inverse",
        "data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent data-[state=indeterminate]:text-ink-inverse",
        "disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-danger",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="grid place-items-center">
        {props.checked === "indeterminate" ? <Minus className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export default Checkbox;
