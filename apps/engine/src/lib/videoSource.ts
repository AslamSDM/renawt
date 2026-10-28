/** Typed access to Video.sourceKind/sourceUrl/source/transcript (addendum 2026-10-28). */
import { VideoSourceSchema, TranscriptSchema, type VideoSource, type Transcript } from "@remawt/shared";
import type { Prisma } from "@remawt/db";
import { db } from "./db.js";

export function sourceOf(v: { source: Prisma.JsonValue | null; sourceKind: string; ideaId?: string | null }): VideoSource {
  const p = VideoSourceSchema.safeParse(v.source ?? { kind: v.sourceKind || (v.ideaId ? "idea" : "prompt") });
  return p.success ? p.data : VideoSourceSchema.parse({ kind: v.ideaId ? "idea" : "prompt" });
}

export function transcriptOf(v: { transcript: Prisma.JsonValue | null }): Transcript | null {
  const p = TranscriptSchema.safeParse(v.transcript);
  return p.success ? p.data : null;
}

export async function saveSource(videoId: string, source: VideoSource): Promise<void> {
  await db().video.update({ where: { id: videoId }, data: { sourceKind: source.kind, sourceUrl: source.mediaUrl ?? null, source: source as Prisma.InputJsonValue } });
}

export async function saveTranscript(videoId: string, transcript: Transcript & { srcHash?: string }): Promise<void> {
  await db().video.update({ where: { id: videoId }, data: { transcript: transcript as Prisma.InputJsonValue } });
}
