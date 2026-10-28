"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FORMATS } from "@remawt/shared";
import { Toolbar, ToolbarGroup } from "@/components/layout/toolbar";
import { Button, Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui";

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "In production" },
  { value: "READY", label: "Ready" },
  { value: "PUBLISHED", label: "Published" },
  { value: "FAILED", label: "Failed" },
];

/** Status + format filters, kept in the URL so the server component does the query. */
export function VideoFilters({ count }: { count: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const status = params.get("status") ?? "all";
  const format = params.get("format") ?? "all";

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }

  return (
    <Toolbar>
      <ToolbarGroup>
        <Select value={status} onValueChange={(v) => set("status", v)}>
          <SelectTrigger className="w-44" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={format} onValueChange={(v) => set("format", v)}>
          <SelectTrigger className="w-48" aria-label="Filter by format">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All formats</SelectItem>
            <SelectSeparator />
            {FORMATS.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(status !== "all" || format !== "all") && (
          <Button variant="ghost" onClick={() => router.replace(pathname, { scroll: false })}>
            Clear
          </Button>
        )}
      </ToolbarGroup>
      <span className="mono-tick tabular-nums">
        {count} video{count === 1 ? "" : "s"}
      </span>
    </Toolbar>
  );
}
