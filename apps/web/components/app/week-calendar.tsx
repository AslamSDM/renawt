import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { platformLabel } from "@/lib/queries/format";

export interface CalendarItem {
  id: string;
  videoId: string;
  title: string;
  platform: string;
  status: string;
  day: number; // 0 = Monday
  hour: number;
  time: string;
  needsApproval: boolean;
}

const DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TONE: Record<string, string> = {
  SCHEDULED: "border-accent-line bg-accent-soft",
  PUBLISHING: "border-warning/30 bg-warning-soft",
  PUBLISHED: "border-success/30 bg-success-soft",
  FAILED: "border-danger/30 bg-danger-soft",
  CANCELLED: "border-rule bg-paper-2 opacity-60 line-through",
};
const STATUS_WORD: Record<string, string> = { SCHEDULED: "Scheduled", PUBLISHING: "Posting", PUBLISHED: "Posted", FAILED: "Failed", CANCELLED: "Cancelled" };

/**
 * 7-column week grid with 24 hour rows. Empty hours compress to 20px; hours with posts grow to fit.
 * Scrolls sideways under 720px so each day keeps a readable width.
 */
export function WeekCalendar({ days, items, todayIndex, timezone }: { days: string[]; items: CalendarItem[]; todayIndex: number | null; timezone: string }) {
  const byCell = new Map<string, CalendarItem[]>();
  for (const it of items) {
    const k = `${it.day}:${it.hour}`;
    byCell.set(k, [...(byCell.get(k) ?? []), it]);
  }
  const busyHours = new Set(items.map((i) => i.hour));

  return (
    <div className="overflow-x-auto rounded-[2px] border border-rule bg-paper">
      <div className="grid min-w-[720px] grid-cols-[48px_repeat(7,minmax(0,1fr))]" role="grid" aria-label={`Week of ${days[0]}, times in ${timezone}`}>
        <div className="h-10 border-b border-rule" />
        {days.map((d, i) => (
          <div
            key={d}
            role="columnheader"
            className={cn("flex h-10 items-center gap-2 border-b border-l border-rule px-3", todayIndex === i && "bg-paper-2")}
          >
            <span className={cn("mono-tick", todayIndex === i && "text-ink")}>{DAY[i]}</span>
            <span className={cn("type-small tabular-nums", todayIndex === i ? "font-medium text-accent" : "text-muted")}>{Number(d.slice(8, 10))}</span>
          </div>
        ))}
        {Array.from({ length: 24 }, (_, h) => (
          <React.Fragment key={h}>
            <div role="rowheader" className={cn("mono-tick border-b border-rule pr-2 text-right tabular-nums", busyHours.has(h) ? "pt-2" : "flex h-5 items-center justify-end")}>
              {h % 3 === 0 || busyHours.has(h) ? `${String(h).padStart(2, "0")}` : ""}
            </div>
            {days.map((d, i) => {
              const cell = byCell.get(`${i}:${h}`) ?? [];
              return (
                <div key={d} role="gridcell" className={cn("min-w-0 border-b border-l border-rule", busyHours.has(h) ? "p-1.5" : "h-5", todayIndex === i && "bg-paper-2/50")}>
                  {cell.length > 0 && (
                    <ul className="flex flex-col gap-1">
                      {cell.map((it) => (
                        <li key={it.id}>
                          <Link
                            href={`/app/videos/${it.videoId}`}
                            className={cn("flex min-w-0 flex-col gap-0.5 rounded-[2px] border px-2 py-1.5 transition-colors hover:border-rule-strong", TONE[it.status] ?? "border-rule bg-paper-2")}
                            title={`${it.title} · ${platformLabel(it.platform)} · ${STATUS_WORD[it.status] ?? it.status}`}
                          >
                            <span className="mono-tick flex items-center justify-between gap-1 tabular-nums text-ink">
                              <span>{it.time}</span>
                              <span>{platformLabel(it.platform)}</span>
                            </span>
                            <span className="type-caption truncate text-ink">{it.title}</span>
                            <span className="type-caption text-muted">{it.needsApproval ? "Needs approval" : (STATUS_WORD[it.status] ?? it.status)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      {items.length === 0 && <p className="type-small border-t border-rule px-4 py-3 text-muted">No posts this week.</p>}
    </div>
  );
}
