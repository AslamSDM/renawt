import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { engine } from "@/lib/engine";
import { parseProgress } from "@/lib/queries/shapes";
import { getViewerOrNull } from "@/lib/queries/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Polled every 2s by the video page while the run is active. Proxies the engine, falls back to the DB row. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewerOrNull();
  if (!viewer) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  if (viewer.bypass) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const video = await prisma.video.findFirst({
    where: { id, channel: { userId: viewer.userId } },
    select: { id: true, status: true, progress: true, masterUrl: true, thumbnailUrl: true, error: true },
  });
  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const terminal = video.status === "READY" || video.status === "FAILED" || video.status === "PUBLISHED";
  if (!terminal) {
    const res = await engine.progress(viewer.userId, id);
    if (res.ok) {
      // Keep our local "queued" event at the head of the list if the engine doesn't report one.
      const remote = parseProgress(res.data.progress);
      const local = remote.some((e) => e.step === "queued") ? [] : parseProgress(video.progress).filter((e) => e.step === "queued");
      return NextResponse.json({
        status: res.data.status ?? video.status,
        progress: [...local, ...remote],
        masterUrl: video.masterUrl,
        thumbnailUrl: video.thumbnailUrl,
        error: video.error,
        live: true,
      });
    }
  }
  return NextResponse.json({
    status: video.status,
    progress: parseProgress(video.progress),
    masterUrl: video.masterUrl,
    thumbnailUrl: video.thumbnailUrl,
    error: video.error,
    live: false,
  });
}
