"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

interface HyperframesEditorProps {
  projectId: string;
  compositionHtml: string;
  open: boolean;
  onClose: () => void;
}

export function HyperframesEditor({
  projectId,
  compositionHtml,
  open,
  onClose,
}: HyperframesEditorProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="relative w-full max-w-5xl mx-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-white/70 font-mono">
            HyperFrames Composition
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {compositionHtml ? (
          <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-white/10">
            <iframe
              srcDoc={compositionHtml}
              className="absolute inset-0 w-full h-full bg-white"
              title="HyperFrames Preview"
              sandbox="allow-scripts"
            />
          </div>
        ) : (
          <div className="aspect-video w-full rounded-lg border border-dashed border-white/20 bg-white/5 flex items-center justify-center">
            <p className="text-sm text-white/40">No composition generated yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
