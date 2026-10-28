"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Drag-and-drop file target; also a button that opens the picker. Validates type + size before handing the file over. */
export function Dropzone({
  accept,
  maxBytes,
  icon: Icon,
  title,
  hint,
  onFile,
  onReject,
  disabled,
}: {
  accept: string[];
  maxBytes: number;
  icon: LucideIcon;
  title: string;
  hint: string;
  onFile: (f: File) => void;
  onReject: (reason: string) => void;
  disabled?: boolean;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);

  function take(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    const okType = accept.some((a) => (a.endsWith("/*") ? f.type.startsWith(a.slice(0, -1)) : a.startsWith(".") ? f.name.toLowerCase().endsWith(a) : f.type === a));
    if (!okType) return onReject("That file type isn’t supported here.");
    if (f.size > maxBytes) return onReject(`That file is ${(f.size / 1e6).toFixed(0)} MB. The limit is ${(maxBytes / 1e6).toFixed(0)} MB.`);
    onFile(f);
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files);
      }}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-4 rounded-[2px] border border-dashed px-6 py-16 text-center transition-[border-color,background-color] duration-200 ease-out-expo",
        over ? "border-accent bg-accent-soft" : "border-rule-strong bg-paper hover:border-ink/40 hover:bg-paper-2",
        "disabled:cursor-not-allowed disabled:opacity-45",
      )}
    >
      <span className="grid size-10 place-items-center rounded-[2px] border border-rule bg-paper-2 text-muted">
        <Icon className="size-5" strokeWidth={1.6} aria-hidden />
      </span>
      <span className="flex flex-col gap-1.5">
        <span className="type-subheading text-ink">{title}</span>
        <span className="type-small text-muted">{hint}</span>
      </span>
      <span className="mono-tick">Drop a file or click to browse</span>
      <input ref={input} type="file" accept={accept.join(",")} className="sr-only" tabIndex={-1} onChange={(e) => take(e.target.files)} />
    </button>
  );
}
