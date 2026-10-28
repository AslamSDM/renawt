"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Minus } from "lucide-react";
import type { ProgressEvent } from "@remawt/shared";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { VideoStatusBadge } from "../badges";

const LABEL: Record<string, string> = {
  queued: "Queued",
  start: "Start",
  ingest: "Ingest footage",
  transcribe: "Transcribe",
  ideate: "Research",
  script: "Script",
  voice: "Voice",
  plan: "Scene plan",
  assets: "Assets",
  compose: "Compose",
  lint: "Lint + critic",
  render: "Render",
  qc: "Quality check",
  cuts: "Platform cuts",
  rerender: "Re-render",
};

const TERMINAL = new Set(["READY", "FAILED", "PUBLISHED"]);

interface Row {
  step: string;
  status: ProgressEvent["status"];
  message?: string;
  startedAt?: string;
  at: string;
}

/** Collapse the event log into one row per step (latest status wins, first start time kept). */
function collapse(events: ProgressEvent[]): Row[] {
  const rows = new Map<string, Row>();
  for (const e of events) {
    if (e.step === "source") continue;
    const prev = rows.get(e.step);
    rows.set(e.step, {
      step: e.step,
      status: e.status,
      message: e.message ?? prev?.message,
      startedAt: prev?.startedAt ?? (e.status === "started" ? e.at : undefined),
      at: e.at,
    });
  }
  return [...rows.values()];
}

function elapsed(from?: string, to?: string) {
  if (!from) return "";
  const ms = (to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime();
  if (ms < 0) return "";
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

/** Live pipeline log. Polls every 2s while the run is active, then refreshes the page once it lands. */
export function ProgressTimeline({ videoId, initialStatus, initialEvents, expectedSteps }: { videoId: string; initialStatus: string; initialEvents: ProgressEvent[]; expectedSteps: string[] }) {
  const router = useRouter();
  const [status, setStatus] = React.useState(initialStatus);
  const [events, setEvents] = React.useState(initialEvents);
  const [, tick] = React.useState(0);
  const [stale, setStale] = React.useState(false);

  React.useEffect(() => {
    if (TERMINAL.has(status)) return;
    let alive = true;
    let failures = 0;
    const poll = async () => {
      try {
        const res = await fetch(`/api/app/videos/${videoId}/progress`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { status: string; progress: ProgressEvent[] };
        if (!alive) return;
        failures = 0;
        setStale(false);
        setEvents(body.progress);
        if (body.status !== status) {
          setStatus(body.status);
          if (TERMINAL.has(body.status)) router.refresh();
        }
      } catch {
        failures += 1;
        if (failures >= 3) setStale(true);
      }
    };
    const t = setInterval(poll, 2000);
    const clock = setInterval(() => tick((n) => n + 1), 1000);
    return () => {
      alive = false;
      clearInterval(t);
      clearInterval(clock);
    };
  }, [videoId, status, router]);

  const rows = collapse(events);
  const seen = new Set(rows.map((r) => r.step));
  const pending = TERMINAL.has(status) ? [] : expectedSteps.filter((s) => !seen.has(s));
  const done = rows.filter((r) => r.status === "done" || r.status === "skipped").length;
  const total = rows.length + pending.length;
  const failed = status === "FAILED";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <VideoStatusBadge status={status} />
        <span className="mono-tick tabular-nums">
          {done}/{total} steps{stale ? " · reconnecting" : ""}
        </span>
      </div>
      <Progress value={TERMINAL.has(status) ? 100 : total ? (done / total) * 100 : null} tone={failed ? "danger" : status === "READY" || status === "PUBLISHED" ? "success" : "accent"} aria-label="Pipeline progress" />
      <ol className="flex flex-col" aria-live="polite">
        {rows.map((r) => {
          const live = r.status === "started" || r.status === "progress";
          return (
            <li key={r.step} className="flex gap-3 border-l border-rule py-2 pl-3">
              <span className="mt-1 flex size-3 shrink-0 items-center justify-center">
                {live ? (
                  <span className="rec-dot" aria-label="Running" />
                ) : r.status === "failed" ? (
                  <AlertTriangle className="size-3 text-danger" aria-label="Failed" />
                ) : r.status === "skipped" ? (
                  <Minus className="size-3 text-subtle" aria-label="Skipped" />
                ) : (
                  <Check className="size-3 text-success" aria-label="Done" />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-baseline justify-between gap-3">
                  <span className={cn("mono-label", r.status === "failed" && "text-danger")}>{LABEL[r.step] ?? r.step}</span>
                  <span className="mono-tick tabular-nums">{elapsed(r.startedAt, live ? undefined : r.at)}</span>
                </span>
                {r.message && <span className="type-caption break-words text-muted">{r.message}</span>}
              </span>
            </li>
          );
        })}
        {pending.map((s) => (
          <li key={s} className="flex gap-3 border-l border-rule py-2 pl-3 opacity-45">
            <span className="mt-1 flex size-3 shrink-0 items-center justify-center">
              <span className="size-1.5 rounded-full bg-subtle" aria-hidden />
            </span>
            <span className="mono-label">{LABEL[s] ?? s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
