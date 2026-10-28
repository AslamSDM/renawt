"use client";

import * as React from "react";

export type UploadKind = "video" | "audio";
export interface UploadState {
  status: "idle" | "signing" | "uploading" | "done" | "error";
  progress: number;
  file: File | null;
  publicUrl: string | null;
  error: string | null;
}

const IDLE: UploadState = { status: "idle", progress: 0, file: null, publicUrl: null, error: null };

/** Presign through /api/app/uploads, then PUT straight to R2 with XHR so we get progress events. */
export function useUpload(channelId: string | null, kind: UploadKind) {
  const [state, setState] = React.useState<UploadState>(IDLE);
  const xhr = React.useRef<XMLHttpRequest | null>(null);

  const reset = React.useCallback(() => {
    xhr.current?.abort();
    setState(IDLE);
  }, []);

  const start = React.useCallback(
    async (file: File) => {
      if (!channelId) {
        setState({ ...IDLE, status: "error", file, error: "Create a channel first." });
        return;
      }
      setState({ ...IDLE, status: "signing", file });
      let presign: { uploadUrl: string; publicUrl: string };
      try {
        const res = await fetch("/api/app/uploads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ channelId, kind, contentType: file.type || "application/octet-stream", sizeBytes: file.size, fileName: file.name }),
        });
        const body: unknown = await res.json().catch(() => null);
        if (!res.ok || !body || typeof body !== "object" || !("uploadUrl" in body) || !("publicUrl" in body)) {
          const msg = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Couldn’t start the upload.";
          setState({ ...IDLE, status: "error", file, error: msg });
          return;
        }
        presign = body as { uploadUrl: string; publicUrl: string };
      } catch {
        setState({ ...IDLE, status: "error", file, error: "Network error. Check your connection and try again." });
        return;
      }

      setState((s) => ({ ...s, status: "uploading", progress: 0 }));
      const req = new XMLHttpRequest();
      xhr.current = req;
      req.open("PUT", presign.uploadUrl);
      req.setRequestHeader("content-type", file.type);
      req.upload.onprogress = (e) => {
        if (e.lengthComputable) setState((s) => ({ ...s, progress: e.loaded / e.total }));
      };
      req.onload = () => {
        if (req.status >= 200 && req.status < 300) setState((s) => ({ ...s, status: "done", progress: 1, publicUrl: presign.publicUrl }));
        else setState((s) => ({ ...s, status: "error", error: `Upload failed (${req.status}). Try again.` }));
      };
      req.onerror = () => setState((s) => ({ ...s, status: "error", error: "Upload was interrupted. Try again." }));
      req.onabort = () => setState(IDLE);
      req.send(file);
    },
    [channelId, kind],
  );

  React.useEffect(() => () => xhr.current?.abort(), []);
  return { state, start, reset };
}
