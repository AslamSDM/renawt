"use client";

import * as React from "react";
import { Toaster as Sonner, toast, type ToasterProps } from "sonner";

/** Token-styled sonner Toaster. Mount once (root layout). Call `toast()` anywhere. */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      gap={8}
      toastOptions={{
        classNames: {
          toast: "!rounded-[2px] !border !border-rule-strong !bg-paper !text-ink !shadow-[0_16px_40px_-16px_rgba(0,0,0,0.9)]",
          title: "!text-[13px] !font-medium",
          description: "!text-[12px] !text-muted",
          actionButton: "!rounded-[2px] !bg-ink !text-ink-inverse",
          cancelButton: "!rounded-[2px] !bg-paper-2 !text-muted",
          success: "[&_[data-icon]]:!text-success",
          error: "[&_[data-icon]]:!text-danger",
          warning: "[&_[data-icon]]:!text-warning",
          info: "[&_[data-icon]]:!text-accent",
        },
      }}
      {...props}
    />
  );
}

export { toast };
