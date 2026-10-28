import * as React from "react";
import Link from "next/link";
import type { Video } from "@remawt/db";
import { PIPELINE_STEPS } from "@remawt/shared";
import { Progress } from "@/components/ui/progress";
import { relativeTime } from "@/lib/queries/format";
import { parseProgress } from "@/lib/queries/shapes";
import { VideoStatusBadge } from "./badges";

export function pipelinePct(progressJson: unknown): number | null {
  const done = new Set(parseProgress(progressJson).filter((e) => e.status === "done" || e.status === "skipped").map((e) => e.step));
  const steps = PIPELINE_STEPS.filter((s) => s !== "ingest" && s !== "transcribe");
  const n = steps.filter((s) => done.has(s)).length;
  return n === 0 ? null : Math.round((n / steps.length) * 100);
}

/** Production queue rows (48px min, like table rows). */
export function QueueList({ videos }: { videos: Video[] }) {
  return (
    <ul className="flex flex-col overflow-hidden rounded-[2px] border border-rule bg-paper">
      {videos.map((v) => {
        const pct = pipelinePct(v.progress);
        return (
          <li key={v.id} className="border-b border-rule last:border-0">
            <Link
              href={`/app/videos/${v.id}`}
              className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-2 transition-colors duration-120 hover:bg-paper-2 sm:grid-cols-[minmax(0,1fr)_160px_96px]"
            >
              <span className="flex min-w-0 flex-col">
                <span className="type-body truncate text-ink">{v.title}</span>
                <span className="mono-tick tabular-nums">{relativeTime(v.createdAt)}</span>
              </span>
              <span className="hidden sm:block">
                <Progress value={v.status === "FAILED" ? 100 : pct} tone={v.status === "FAILED" ? "danger" : "accent"} aria-label="Pipeline progress" />
              </span>
              <span className="flex justify-end">
                <VideoStatusBadge status={v.status} />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
