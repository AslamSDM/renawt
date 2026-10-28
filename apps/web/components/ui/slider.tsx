"use client";

import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export function Slider({ className, defaultValue, value, min = 0, max = 100, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min]),
    [value, defaultValue, min],
  );
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex h-5 w-full touch-none select-none items-center data-[disabled]:opacity-45 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-5 data-[orientation=vertical]:flex-col",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-0.5 w-full grow overflow-hidden bg-rule-strong data-[orientation=vertical]:h-full data-[orientation=vertical]:w-0.5">
        <SliderPrimitive.Range className="absolute h-full bg-accent data-[orientation=vertical]:w-full" />
      </SliderPrimitive.Track>
      {values.map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          className="block size-4 rounded-full border-2 border-accent bg-ink shadow-[0_2px_6px_rgba(0,0,0,0.5)] transition-transform duration-120 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export default Slider;
