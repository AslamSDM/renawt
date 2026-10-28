"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Styled table wrappers. Row height: 48px (default) or 40px (dense via <Table dense>).
 * Numeric columns: pass `numeric` to TableHead/TableCell for right-aligned tabular nums.
 */
const DenseCtx = React.createContext(false);

export function Table({ className, dense = false, ...props }: React.ComponentProps<"table"> & { dense?: boolean }) {
  return (
    <DenseCtx.Provider value={dense}>
      <div data-slot="table-container" className="relative w-full overflow-x-auto rounded-[2px] border border-rule bg-paper">
        <table data-slot="table" className={cn("w-full caption-bottom border-collapse text-left", className)} {...props} />
      </div>
    </DenseCtx.Provider>
  );
}

export function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b [&_tr]:border-rule [&_tr]:hover:bg-transparent", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return <tfoot data-slot="table-footer" className={cn("border-t border-rule bg-paper-2 font-medium", className)} {...props} />;
}

export function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn("border-b border-rule transition-colors duration-120 hover:bg-paper-2 data-[state=selected]:bg-accent-soft", className)}
      {...props}
    />
  );
}

export function TableHead({ className, numeric = false, ...props }: React.ComponentProps<"th"> & { numeric?: boolean }) {
  return (
    <th
      data-slot="table-head"
      className={cn("mono-tick h-10 whitespace-nowrap px-4 align-middle font-normal", numeric && "text-right", className)}
      {...props}
    />
  );
}

export function TableCell({ className, numeric = false, ...props }: React.ComponentProps<"td"> & { numeric?: boolean }) {
  const dense = React.useContext(DenseCtx);
  return (
    <td
      data-slot="table-cell"
      className={cn("type-body px-4 align-middle text-ink", dense ? "h-10" : "h-12", numeric && "text-right tabular-nums", className)}
      {...props}
    />
  );
}

export function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return <caption data-slot="table-caption" className={cn("type-small mt-3 text-muted", className)} {...props} />;
}
