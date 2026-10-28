import * as React from "react";
import Link from "next/link";
import { Film } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatName } from "@/lib/queries/format";
import { VideoStatusBadge } from "./badges";

export interface VideoThumbData {
  id: string;
  title: string;
  status: string;
  format: string;
  thumbnailUrl: string | null;
  targetSec: number;
  /** Kit palette for the placeholder frame. */
  bg?: string | null;
  accent?: string | null;
  ink?: string | null;
}

/** 9:16 tile for video grids. Title and meta sit under the frame, never on top of it. */
export function VideoThumb({ video, className }: { video: VideoThumbData; className?: string }) {
  return (
    <Link href={`/app/videos/${video.id}`} className={cn("group flex min-w-0 flex-col gap-3", className)}>
      <div
        className="relative aspect-[9/16] w-full overflow-hidden rounded-[2px] border border-rule bg-paper-2 transition-colors duration-200 group-hover:border-rule-strong"
        style={!video.thumbnailUrl && video.bg ? { background: video.bg } : undefined}
      >
        {video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex flex-col justify-end gap-2 p-4" style={{ color: video.ink ?? undefined }}>
            <span className="h-0.5 w-8 rounded-full" style={{ background: video.accent ?? "var(--accent)" }} aria-hidden />
            <span className="type-small line-clamp-4 font-medium opacity-90">{video.title}</span>
            <Film className="absolute right-3 top-3 size-4 opacity-40" aria-hidden />
          </div>
        )}
        <div className="absolute left-2 top-2">
          <VideoStatusBadge status={video.status} />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="type-small truncate font-medium text-ink group-hover:underline group-hover:decoration-rule-strong group-hover:underline-offset-4">{video.title}</p>
        <p className="mono-tick truncate tabular-nums">
          {formatName(video.format)} · {video.targetSec}s
        </p>
      </div>
    </Link>
  );
}
