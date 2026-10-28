"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

export interface FormFieldProps {
  label: React.ReactNode;
  /** id of the control; generated when omitted and injected into a single child element. */
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  /** Right side of the label row: counter, "Optional", link. */
  aside?: React.ReactNode;
  /** horizontal = label left (200px) / control right on md+, used in settings pages. */
  layout?: "vertical" | "horizontal";
  className?: string;
  children: React.ReactElement<Record<string, unknown>>;
}

/**
 * Label + control + hint/error. Wires id, aria-describedby and aria-invalid
 * onto the child control automatically.
 */
export function FormField({ label, htmlFor, hint, error, required, aside, layout = "vertical", className, children }: FormFieldProps) {
  const autoId = React.useId();
  const id = htmlFor ?? (children.props.id as string | undefined) ?? autoId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  const control = React.cloneElement(children, {
    id,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
    "aria-required": required || undefined,
  });

  const labelRow = (
    <div className="flex min-h-5 items-baseline justify-between gap-4">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-subtle" aria-hidden>*</span>}
      </Label>
      {aside && <span className="type-caption text-subtle">{aside}</span>}
    </div>
  );

  const messages = (
    <>
      {error ? (
        <p id={errorId} className="type-caption text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="type-caption text-muted">
          {hint}
        </p>
      ) : null}
    </>
  );

  if (layout === "horizontal") {
    return (
      <div data-slot="form-field" className={cn("grid gap-2 md:grid-cols-[200px_1fr] md:gap-6", className)}>
        <div className="md:pt-2.5">{labelRow}</div>
        <div className="flex flex-col gap-1.5">
          {control}
          {messages}
        </div>
      </div>
    );
  }

  return (
    <div data-slot="form-field" className={cn("flex flex-col gap-1.5", className)}>
      {labelRow}
      {control}
      {messages}
    </div>
  );
}

export default FormField;
