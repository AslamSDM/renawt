"use client";

import React from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

export interface ProgressEvent {
  step: string;
  label: string;
  status: "running" | "done" | "failed";
  detail?: string;
  output?: unknown;
  at?: string;
}

interface Props {
  events: ProgressEvent[];
  running?: boolean;
}

const STEP_ORDER = ["capture", "brand", "music", "sfx", "compose", "render"];

export function GenerationProgress({ events, running }: Props) {
  const latest: Record<string, ProgressEvent> = {};
  for (const e of events) {
    latest[e.step] = e;
  }

  return (
    <div className="space-y-2">
      {STEP_ORDER.map((step) => {
        const ev = latest[step];
        const isRunning = ev?.status === "running";
        const isDone = ev?.status === "done";
        const isFailed = ev?.status === "failed";

        return (
          <div key={step} className="flex items-center gap-3 text-sm">
            {isDone ? (
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            ) : isFailed ? (
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            ) : isRunning ? (
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
            )}
            <span className={isDone ? "text-green-600" : isFailed ? "text-red-600" : isRunning ? "text-blue-600" : "text-gray-500"}>
              {ev?.label || step}
            </span>
            {ev?.detail && (
              <span className="text-xs text-gray-400 ml-1">{ev.detail}</span>
            )}
          </div>
        );
      })}
      {running && (
        <div className="text-xs text-gray-400 mt-2 animate-pulse">
          Processing...
        </div>
      )}
    </div>
  );
}

function AlertCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}