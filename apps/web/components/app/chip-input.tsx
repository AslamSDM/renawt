"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldClasses } from "@/components/ui/input";

/**
 * Tag input: Enter or comma adds a chip, Backspace on empty removes the last.
 * Missing from components/ui; requested in docs/REQUESTS.md.
 */
export function ChipInput({
  id,
  value,
  onChange,
  placeholder,
  max,
  maxLength = 60,
  className,
  ...aria
}: {
  id?: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
  maxLength?: number;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const [draft, setDraft] = React.useState("");
  const full = max != null && value.length >= max;

  function add(raw: string) {
    const t = raw.trim().replace(/,$/, "").slice(0, maxLength);
    if (!t || value.some((v) => v.toLowerCase() === t.toLowerCase()) || full) return;
    onChange([...value, t]);
    setDraft("");
  }

  return (
    <div
      className={cn(fieldClasses, "flex min-h-10 flex-wrap items-center gap-1.5 px-2 py-1.5 focus-within:border-accent", className)}
      onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus()}
    >
      {value.map((v) => (
        <span key={v} className="type-small inline-flex h-6 items-center gap-1 rounded-[2px] border border-rule bg-paper-2 pl-2 pr-1 text-ink">
          {v}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== v))}
            className="grid size-4 place-items-center rounded-[2px] text-subtle transition-colors hover:bg-paper-3 hover:text-ink"
            aria-label={`Remove ${v}`}
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        disabled={full}
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(",")) add(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft && add(draft)}
        placeholder={full ? `Limit of ${max} reached` : placeholder}
        className="type-body h-6 min-w-[10ch] flex-1 bg-transparent px-1 text-ink outline-none placeholder:text-subtle disabled:cursor-not-allowed"
        {...aria}
      />
    </div>
  );
}
