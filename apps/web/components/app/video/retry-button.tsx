"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import type { VideoSource } from "@remawt/shared";
import { Button, toast } from "@/components/ui";
import { startVideo } from "@/lib/actions/video";

/**
 * Re-runs a failed video with the same inputs as a new video. A failed run that rendered
 * nothing had its credit returned, so the retry uses one video like any other start.
 */
export function RetryVideoButton({
  channelId,
  source,
  ideaId,
  format,
  targetSec,
}: {
  channelId: string;
  source: VideoSource | null;
  ideaId: string | null;
  format: string;
  targetSec: number;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const kind = source?.kind ?? (ideaId ? "idea" : "prompt");
  const retryable = kind === "idea" ? !!ideaId : kind === "prompt" ? !!source?.text : !!source?.mediaUrl;
  if (!retryable) return null;

  return (
    <Button
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await startVideo({
            channelId,
            kind,
            ideaId: ideaId ?? undefined,
            text: source?.text,
            format: format === "auto" ? undefined : format,
            targetSec: Math.min(90, Math.max(20, targetSec)),
            mediaUrl: source?.mediaUrl,
            mediaDurationMs: source?.mediaDurationMs,
            mediaAspect: source?.mediaAspect,
            keepOriginalAudio: source?.keepOriginalAudio ?? true,
            insertDensity: source?.insertDensity ?? "medium",
          });
          if (!res.ok) return void toast.error(res.error);
          toast.success("Retrying with the same inputs.");
          router.push(`/app/videos/${res.data.videoId}`);
        })
      }
    >
      <RotateCcw /> Try again
    </Button>
  );
}
