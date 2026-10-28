"use client";

import * as React from "react";
import { DropdownMenu as DM } from "radix-ui";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;
export const DropdownMenuGroup = DM.Group;
export const DropdownMenuSub = DM.Sub;
export const DropdownMenuRadioGroup = DM.RadioGroup;

const panel =
  "z-50 min-w-48 overflow-hidden rounded-[2px] border border-rule-strong bg-paper p-1 text-ink shadow-[0_16px_40px_-16px_rgba(0,0,0,0.8)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=closed]:animate-out data-[state=closed]:fade-out-0";
const item =
  "type-body relative flex h-8 cursor-default select-none items-center gap-2 rounded-[2px] px-2 outline-none transition-colors data-[highlighted]:bg-paper-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-subtle";

export function DropdownMenuContent({ className, sideOffset = 6, align = "end", ...props }: React.ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content data-slot="dropdown-menu-content" sideOffset={sideOffset} align={align} className={cn(panel, className)} {...props} />
    </DM.Portal>
  );
}

export function DropdownMenuItem({
  className,
  destructive = false,
  ...props
}: React.ComponentProps<typeof DM.Item> & { destructive?: boolean }) {
  return <DM.Item className={cn(item, destructive && "text-danger data-[highlighted]:bg-danger-soft [&_svg]:text-danger", className)} {...props} />;
}

export function DropdownMenuCheckboxItem({ className, children, ...props }: React.ComponentProps<typeof DM.CheckboxItem>) {
  return (
    <DM.CheckboxItem className={cn(item, "pr-8", className)} {...props}>
      {children}
      <span className="absolute right-2 flex size-4 items-center justify-center">
        <DM.ItemIndicator>
          <Check className="text-accent!" />
        </DM.ItemIndicator>
      </span>
    </DM.CheckboxItem>
  );
}

export function DropdownMenuRadioItem({ className, children, ...props }: React.ComponentProps<typeof DM.RadioItem>) {
  return (
    <DM.RadioItem className={cn(item, "pr-8", className)} {...props}>
      {children}
      <span className="absolute right-2 flex size-4 items-center justify-center">
        <DM.ItemIndicator>
          <span className="block size-1.5 rounded-full bg-accent" />
        </DM.ItemIndicator>
      </span>
    </DM.RadioItem>
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof DM.Label>) {
  return <DM.Label className={cn("mono-tick px-2 pb-1 pt-2", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DM.Separator>) {
  return <DM.Separator className={cn("-mx-1 my-1 h-px bg-rule", className)} {...props} />;
}

export function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("ml-auto font-mono text-[10px] tracking-[0.1em] text-subtle", className)} {...props} />;
}

export function DropdownMenuSubTrigger({ className, children, ...props }: React.ComponentProps<typeof DM.SubTrigger>) {
  return (
    <DM.SubTrigger className={cn(item, "data-[state=open]:bg-paper-2", className)} {...props}>
      {children}
      <ChevronRight className="ml-auto" />
    </DM.SubTrigger>
  );
}

export function DropdownMenuSubContent({ className, ...props }: React.ComponentProps<typeof DM.SubContent>) {
  return (
    <DM.Portal>
      <DM.SubContent className={cn(panel, className)} {...props} />
    </DM.Portal>
  );
}
