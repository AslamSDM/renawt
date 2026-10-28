import { Suspense } from "react";
import Link from "next/link";
import { Clapperboard, Plus } from "lucide-react";
import type { Prisma } from "@remawt/db";
import { FORMAT_IDS } from "@remawt/shared";
import { EmptyState, PageHeader, Section } from "@/components/layout";
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import { FormatBadge, VideoStatusBadge } from "@/components/app/badges";
import { NoChannel } from "@/components/app/no-channel";
import { VideoFilters } from "@/components/app/video-filters";
import { prisma } from "@/lib/db/prisma";
import { getActiveChannel } from "@/lib/queries/channels";
import { formatDate, formatSeconds } from "@/lib/queries/format";
import { ACTIVE_STATUSES } from "@/lib/queries/home";
import { parseKit, readVideoSource } from "@/lib/queries/shapes";
import { getViewer } from "@/lib/queries/viewer";

export const metadata = { title: "Videos" };

const SOURCE_LABEL = { idea: "Radar idea", prompt: "Prompt", video: "Your video", audio: "Your voice" } as const;

export default async function VideosPage({ searchParams }: { searchParams: Promise<{ status?: string; format?: string }> }) {
  const { status, format } = await searchParams;
  const viewer = await getViewer("/app/videos");
  const channel = await getActiveChannel(viewer);
  const header = (
    <PageHeader
      title="Videos"
      description="Everything this channel has made or is making."
      actions={
        <Button asChild>
          <Link href="/app/new">
            <Plus /> New video
          </Link>
        </Button>
      }
    />
  );
  if (!channel) {
    return (
      <>
        {header}
        <NoChannel what="videos" />
      </>
    );
  }

  const where: Prisma.VideoWhereInput = { channelId: channel.id };
  if (status === "active") where.status = { in: [...ACTIVE_STATUSES] };
  else if (status === "READY" || status === "PUBLISHED" || status === "FAILED") where.status = status;
  if (format && FORMAT_IDS.includes(format)) where.format = format;

  const videos = viewer.bypass
    ? []
    : await prisma.video.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, title: true, status: true, format: true, targetSec: true, thumbnailUrl: true, createdAt: true, source: true, sourceKind: true, sourceUrl: true, _count: { select: { publications: true } } },
      });
  const palette = parseKit(channel.kit)?.skin.palette;
  const filtered = !!status || !!format;

  return (
    <>
      {header}
      <Section>
        <Suspense>
          <VideoFilters count={videos.length} />
        </Suspense>
        {videos.length === 0 ? (
          <EmptyState
            icon={Clapperboard}
            title={filtered ? "No videos match these filters" : "No videos yet"}
            description={filtered ? "Clear the filters to see every video on this channel." : "Make your first one from a radar idea, a prompt or your own footage."}
            action={
              filtered ? (
                <Button asChild variant="outline">
                  <Link href="/app/videos">Clear filters</Link>
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/app/new">
                    <Plus /> New video
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Video</TableHead>
                <TableHead className="hidden md:table-cell">Format</TableHead>
                <TableHead className="hidden lg:table-cell">Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead numeric className="hidden sm:table-cell">
                  Length
                </TableHead>
                <TableHead numeric className="hidden sm:table-cell">
                  Posts
                </TableHead>
                <TableHead numeric>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {videos.map((v) => {
                const src = readVideoSource(v);
                return (
                  <TableRow key={v.id} className="relative">
                    <TableCell className="max-w-0 w-full">
                      <Link href={`/app/videos/${v.id}`} className="flex min-w-0 items-center gap-3 after:absolute after:inset-0">
                        <span
                          className="relative h-9 w-5 shrink-0 overflow-hidden rounded-[2px] border border-rule bg-paper-2"
                          style={!v.thumbnailUrl && palette ? { background: palette.bg } : undefined}
                          aria-hidden
                        >
                          {v.thumbnailUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={v.thumbnailUrl} alt="" className="size-full object-cover" loading="lazy" />
                          )}
                        </span>
                        <span className="truncate">{v.title}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <FormatBadge format={v.format} />
                    </TableCell>
                    <TableCell className="hidden text-muted lg:table-cell">{src ? SOURCE_LABEL[src.kind] : "–"}</TableCell>
                    <TableCell>
                      <VideoStatusBadge status={v.status} />
                    </TableCell>
                    <TableCell numeric className="hidden text-muted sm:table-cell">
                      {formatSeconds(v.targetSec)}
                    </TableCell>
                    <TableCell numeric className="hidden text-muted sm:table-cell">
                      {v._count.publications}
                    </TableCell>
                    <TableCell numeric className="whitespace-nowrap text-muted">
                      {formatDate(v.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Section>
    </>
  );
}
