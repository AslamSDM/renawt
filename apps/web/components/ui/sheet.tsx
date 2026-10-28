"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;

const SIDES = {
  right: "inset-y-0 right-0 h-full w-[min(100vw,420px)] border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
  left: "inset-y-0 left-0 h-full w-[min(86vw,280px)] border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
  bottom: "inset-x-0 bottom-0 max-h-[85dvh] border-t data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
} as const;

export function SheetContent({
  className,
  children,
  side = "right",
  hideClose = false,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: keyof typeof SIDES; hideClose?: boolean }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col overflow-y-auto border-rule-strong bg-paper text-ink shadow-[0_0_48px_rgba(0,0,0,0.6)]",
          "duration-300 ease-out-expo data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200",
          SIDES[side],
          className,
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          <SheetPrimitive.Close
            className="absolute right-3 top-3 grid size-8 place-items-center rounded-[2px] text-subtle transition-colors hover:bg-paper-2 hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 border-b border-rule p-5 pr-12", className)} {...props} />;
}
export function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-1 flex-col gap-6 p-5", className)} {...props} />;
}
export function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mt-auto flex gap-2 border-t border-rule p-5", className)} {...props} />;
}
export function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title className={cn("type-heading text-ink", className)} {...props} />;
}
export function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn("type-body text-muted", className)} {...props} />;
}
