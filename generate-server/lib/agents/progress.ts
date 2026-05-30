/**
 * Pipeline progress events — streamed to the frontend so a running generation
 * shows its current step + the structured LLM output as each stage completes.
 *
 * The VPS pipeline emits these; the jitter route forwards each one to the Next
 * callback (server-to-server), which appends it to Generation.progress. The
 * browser polls that array. See app/projects/[id]/jitter/page.tsx.
 */

export type ProgressStatus = "running" | "done" | "failed";

/** Stable step ids — the frontend renders them in this canonical order. */
export const PROGRESS_STEPS = [
  "capture",
  "brand",
  "music",
  "compose",
  "content-review",
  "scene-critic",
  "render",
] as const;

export type ProgressStep = (typeof PROGRESS_STEPS)[number];

export interface ProgressEvent {
  step: ProgressStep | string;
  /** Human label for the step. */
  label: string;
  status: ProgressStatus;
  /** One-line summary shown under the step (e.g. "Acme · techy · 4 features"). */
  detail?: string;
  /** Structured payload (kept small) shown in an expandable block. */
  output?: unknown;
  /** ISO timestamp — set by the emitter if absent. */
  at?: string;
}

export type ProgressEmit = (e: ProgressEvent) => void | Promise<void>;

/** No-op emitter so callers can stay unconditional. */
export const noopProgress: ProgressEmit = () => {};
