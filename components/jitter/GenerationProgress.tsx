"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  Circle,
  ChevronRight,
} from "lucide-react";

export type ProgressStatus = "running" | "done" | "failed";

export interface ProgressEvent {
  step: string;
  label: string;
  status: ProgressStatus;
  detail?: string;
  output?: unknown;
  at?: string;
}

// Canonical order + labels for steps not yet emitted, so the viewer sees the
// whole pipeline up front with upcoming stages greyed out.
const STEP_ORDER: { step: string; label: string }[] = [
  { step: "capture", label: "Capture screenshot" },
  { step: "brand", label: "Analyze brand" },
  { step: "music", label: "Pick music" },
  { step: "compose", label: "Compose JitterDoc" },
  { step: "content-review", label: "Content review" },
  { step: "scene-critic", label: "Scene critic" },
  { step: "render", label: "Render mp4" },
];

function StatusIcon({ status }: { status: ProgressStatus | "pending" }) {
  if (status === "done")
    return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
  if (status === "running")
    return <Loader2 className="w-4 h-4 text-ink animate-spin shrink-0" />;
  if (status === "failed")
    return <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />;
  return <Circle className="w-4 h-4 text-muted/40 shrink-0" />;
}

function OutputBlock({ output }: { output: unknown }) {
  const [open, setOpen] = useState(false);
  if (output == null) return null;
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] text-muted hover:text-ink transition-colors"
      >
        <ChevronRight
          className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`}
        />
        {open ? "hide output" : "show output"}
      </button>
      {open ? (
        <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-paper-2 border border-rule p-2 text-[10px] leading-relaxed text-ink/80 whitespace-pre-wrap break-words">
          {JSON.stringify(output, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

/**
 * Live pipeline timeline. Merges emitted `events` onto the canonical step list:
 * emitted steps render their status + detail + structured output; not-yet-seen
 * steps render as pending. While `running`, the first pending step shows a
 * subtle hint that it's next.
 */
export function GenerationProgress({
  events,
  running,
}: {
  events: ProgressEvent[];
  running: boolean;
}) {
  // Latest event wins per step (running placeholder gets replaced by done/failed).
  const byStep = new Map<string, ProgressEvent>();
  for (const e of events) byStep.set(e.step, e);

  // Render in canonical order, but append any unknown steps the backend sent.
  const known = new Set(STEP_ORDER.map((s) => s.step));
  const extra = events.filter((e) => !known.has(e.step));

  const rows: { step: string; label: string; ev?: ProgressEvent }[] = [
    ...STEP_ORDER.map((s) => ({ ...s, ev: byStep.get(s.step) })),
    ...extra.map((e) => ({ step: e.step, label: e.label, ev: e })),
  ];

  let firstPendingHit = false;

  return (
    <div className="space-y-2">
      {rows.map(({ step, label, ev }) => {
        const status: ProgressStatus | "pending" = ev?.status ?? "pending";
        const isNext = running && !ev && !firstPendingHit;
        if (status === "pending" && !firstPendingHit) firstPendingHit = true;
        return (
          <div
            key={step}
            className={`flex gap-2 ${
              status === "pending" ? "opacity-50" : ""
            }`}
          >
            <div className="pt-0.5">
              <StatusIcon status={status} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-ink/90">
                  {ev?.label ?? label}
                </span>
                {isNext ? (
                  <span className="text-[9px] uppercase tracking-wide text-muted/70">
                    next
                  </span>
                ) : null}
              </div>
              {ev?.detail ? (
                <div
                  className={`text-[11px] truncate ${
                    status === "failed" ? "text-red-300" : "text-muted"
                  }`}
                >
                  {ev.detail}
                </div>
              ) : null}
              {ev?.output != null ? <OutputBlock output={ev.output} /> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
