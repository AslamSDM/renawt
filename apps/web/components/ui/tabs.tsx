"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-6", className)} {...props} />;
}

type TabsVariant = "underline" | "segmented";
const VariantCtx = React.createContext<TabsVariant>("underline");

/**
 * underline: page-level tabs (PageHeader), hairline under the row.
 * segmented: compact in-card switcher (h-8).
 */
export function TabsList({ className, variant = "underline", ...props }: React.ComponentProps<typeof TabsPrimitive.List> & { variant?: TabsVariant }) {
  return (
    <VariantCtx.Provider value={variant}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        className={cn(
          variant === "underline"
            ? // Rule drawn as an inset shadow: a border would sit outside the scroll box and clip the active underline.
              "no-scrollbar flex h-10 items-stretch gap-6 overflow-x-auto shadow-[inset_0_-1px_0_var(--rule)]"
            : "inline-flex h-8 w-fit items-center gap-0.5 self-start rounded-[2px] border border-rule bg-paper p-0.5",
          className,
        )}
        {...props}
      />
    </VariantCtx.Provider>
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const variant = React.useContext(VariantCtx);
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "type-small inline-flex shrink-0 items-center gap-2 whitespace-nowrap font-medium text-muted transition-colors duration-200 hover:text-ink disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4",
        variant === "underline"
          ? "relative focus-visible:outline-offset-[-2px] after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-transparent after:transition-colors after:duration-200 data-[state=active]:text-ink data-[state=active]:after:bg-ink"
          : "h-full rounded-[1px] px-3 focus-visible:outline-offset-0 data-[state=active]:bg-paper-3 data-[state=active]:text-ink",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("outline-none", className)} {...props} />;
}
