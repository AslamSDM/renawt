"use client";

import * as React from "react";
import type { Transcript } from "@remawt/shared";
import { cn } from "@/lib/utils";
import { EmptyState, Inline, Stack } from "@/components/layout";
import { Badge, Button, Switch, toast } from "@/components/ui";
import { saveTranscriptKeeps } from "@/lib/actions/video";
import { formatMs } from "@/lib/queries/format";

/** Transcript segments of an uploaded video/voice with keep toggles (fillers and silences start off). */
export function TranscriptPanel({ videoId, transcript }: { videoId: string; transcript: Transcript | null }) {
  const [keep, setKeep] = React.useState<Record<string, boolean>>(() => Object.fromEntries((transcript?.segments ?? []).map((s) => [s.id, s.keep])));
  const [dirty, setDirty] = React.useState(false);
  const [pending, start] = React.useTransition();

  if (!transcript || transcript.segments.length === 0) {
    return <EmptyState size="compact" title="Transcript appears after transcription" description="Each segment of your recording shows here so you can drop the parts you don’t want." />;
  }
  const kept = transcript.segments.filter((s) => keep[s.id]);
  const keptMs = kept.reduce((n, s) => n + (s.endMs - s.startMs), 0);

  return (
    <Stack gap={4}>
      <ol className="flex max-h-[480px] flex-col overflow-y-auto rounded-[2px] border border-rule bg-paper">
        {transcript.segments.map((s) => (
          <li key={s.id} className={cn("flex items-start gap-3 border-b border-rule px-4 py-3 last:border-0", !keep[s.id] && "opacity-50")}>
            <span className="mono-tick w-10 shrink-0 pt-0.5 tabular-nums">{formatMs(s.startMs)}</span>
            <p className={cn("type-small min-w-0 flex-1 text-ink", !keep[s.id] && "line-through decoration-rule-strong")}>
              {s.text || <span className="text-subtle">(silence)</span>}
            </p>
            {s.kind !== "speech" && <Badge variant="warning">{s.kind}</Badge>}
            <Switch
              checked={!!keep[s.id]}
              onCheckedChange={(v) => {
                setKeep((k) => ({ ...k, [s.id]: v }));
                setDirty(true);
              }}
              aria-label={`Keep segment at ${formatMs(s.startMs)}`}
            />
          </li>
        ))}
      </ol>
      <Inline gap={3} justify="between">
        <span className="type-small text-muted tabular-nums">
          Keeping {kept.length}/{transcript.segments.length} segments · {formatMs(keptMs)}
        </span>
        <Button
          variant="outline"
          disabled={!dirty}
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await saveTranscriptKeeps({ videoId, keep });
              if (!res.ok) return void toast.error(res.error);
              setDirty(false);
              toast.success("Segments saved. Re-render to apply.");
            })
          }
        >
          Save segments
        </Button>
      </Inline>
    </Stack>
  );
}
