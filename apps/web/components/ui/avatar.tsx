"use client";

import * as React from "react";
import { Avatar as AvatarPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

const SIZES = { xs: "size-5 text-[9px]", sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-10 text-sm" } as const;

export interface AvatarProps extends React.ComponentProps<typeof AvatarPrimitive.Root> {
  src?: string | null;
  name?: string | null;
  size?: keyof typeof SIZES;
  /** square = channel / brand marks, round = people */
  shape?: "round" | "square";
}

function initials(name?: string | null) {
  if (!name) return "·";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "·";
}

export function Avatar({ src, name, size = "md", shape = "round", className, ...props }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative inline-flex shrink-0 select-none overflow-hidden border border-rule-strong bg-paper-2",
        shape === "round" ? "rounded-full" : "rounded-[2px]",
        SIZES[size],
        className,
      )}
      {...props}
    >
      {src && <AvatarPrimitive.Image src={src} alt={name ?? ""} referrerPolicy="no-referrer" className="size-full object-cover" />}
      <AvatarPrimitive.Fallback className="grid size-full place-items-center font-medium text-ink">{initials(name)}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export default Avatar;
