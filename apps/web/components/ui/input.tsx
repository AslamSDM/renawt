import * as React from "react";
import { cn } from "@/lib/utils";

/** Shared field chrome for Input, Textarea and SelectTrigger. h-10 per DESIGN.md §5. */
export const fieldClasses = [
  "w-full min-w-0 rounded-[2px] border border-rule-strong bg-paper text-ink type-body",
  "transition-[border-color,box-shadow,background-color] duration-200 ease-out-expo",
  "placeholder:text-subtle hover:border-ink/35",
  "focus-visible:outline-none focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "aria-invalid:border-danger aria-invalid:focus-visible:shadow-[0_0_0_3px_var(--danger-soft)]",
].join(" ");

export interface InputProps extends Omit<React.ComponentProps<"input">, "size"> {
  size?: "sm" | "md";
  /** Optional leading icon element (16px lucide icon). */
  leading?: React.ReactNode;
  /** Optional trailing element (unit, kbd, clear button). */
  trailing?: React.ReactNode;
}

export function Input({ className, size = "md", leading, trailing, type = "text", ...props }: InputProps) {
  const h = size === "sm" ? "h-8" : "h-10";
  if (!leading && !trailing) {
    return <input data-slot="input" type={type} className={cn(fieldClasses, h, "px-3 tabular-nums", className)} {...props} />;
  }
  return (
    <div data-slot="input-wrap" className={cn("relative flex w-full items-center", className)}>
      {leading && (
        <span className="pointer-events-none absolute left-3 flex items-center text-subtle [&_svg]:size-4">{leading}</span>
      )}
      <input
        data-slot="input"
        type={type}
        className={cn(fieldClasses, h, "px-3 tabular-nums", leading && "pl-9", trailing && "pr-10")}
        {...props}
      />
      {trailing && <span className="absolute right-2 flex items-center text-subtle">{trailing}</span>}
    </div>
  );
}

export default Input;
