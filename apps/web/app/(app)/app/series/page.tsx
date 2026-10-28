import { Layers } from "lucide-react";
import { EmptyState, Inline, PageHeader, Section } from "@/components/layout";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import { PlatformBadge } from "@/components/app/badges";
import { NoChannel } from "@/components/app/no-channel";
import { DeleteSeriesButton, SeriesActiveSwitch, SeriesDialog } from "@/components/app/series-dialog";
import { prisma } from "@/lib/db/prisma";
import { getActiveChannel } from "@/lib/queries/channels";
import { formatDateTime, formatName } from "@/lib/queries/format";
import { parseCadence } from "@/lib/queries/shapes";
import { getViewer } from "@/lib/queries/viewer";

export const metadata = { title: "Series" };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function SeriesPage() {
  const viewer = await getViewer("/app/series");
  const channel = await getActiveChannel(viewer);
  if (!channel) {
    return (
      <>
        <PageHeader title="Series" description="Autopilot for a channel: a cadence that turns approved ideas into scheduled posts." />
        <NoChannel what="series" />
      </>
    );
  }
  const series = viewer.bypass
    ? []
    : await prisma.series.findMany({ where: { channelId: channel.id }, orderBy: { createdAt: "asc" }, include: { _count: { select: { videos: true } } } });

  return (
    <>
      <PageHeader
        title="Series"
        description="Autopilot for a channel: a cadence that turns approved ideas into scheduled posts. TikTok posts always wait for your approval."
        actions={<SeriesDialog channelId={channel.id} timezone={channel.timezone} />}
      />
      <Section>
        {series.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No series yet"
            description="Pick days, a time and platforms. Remawt makes a video from your approved ideas for each slot and queues the post."
            action={<SeriesDialog channelId={channel.id} timezone={channel.timezone} />}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Series</TableHead>
                <TableHead className="hidden md:table-cell">Cadence</TableHead>
                <TableHead className="hidden lg:table-cell">Platforms</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead numeric className="hidden sm:table-cell">
                  Videos
                </TableHead>
                <TableHead numeric className="hidden lg:table-cell">
                  Next run
                </TableHead>
                <TableHead numeric>Active</TableHead>
                <TableHead numeric>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {series.map((s) => {
                const c = parseCadence(s.cadence);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="max-w-0 w-full">
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{s.name}</span>
                        {c.formats.length > 0 && <span className="type-caption truncate text-muted">{c.formats.map(formatName).join(" · ")}</span>}
                      </span>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted tabular-nums md:table-cell">
                      {c.perWeek}/wk · {c.days.map((d) => DAYS[d - 1]).join(" ")} · {String(c.hourLocal).padStart(2, "0")}:00
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Inline gap={1}>
                        {s.platforms.map((p) => (
                          <PlatformBadge key={p} platform={p} />
                        ))}
                      </Inline>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.mode === "AUTO" ? "accent" : "neutral"}>{s.mode === "AUTO" ? "Autopilot" : "Approve"}</Badge>
                    </TableCell>
                    <TableCell numeric className="hidden text-muted sm:table-cell">
                      {s._count.videos}
                    </TableCell>
                    <TableCell numeric className="hidden whitespace-nowrap text-muted lg:table-cell">
                      {s.active && s.nextRunAt ? formatDateTime(s.nextRunAt, channel.timezone) : "–"}
                    </TableCell>
                    <TableCell numeric>
                      <SeriesActiveSwitch id={s.id} active={s.active} name={s.name} />
                    </TableCell>
                    <TableCell numeric>
                      <Inline gap={1} wrap={false} justify="end">
                        <SeriesDialog
                          channelId={channel.id}
                          timezone={channel.timezone}
                          initial={{ id: s.id, name: s.name, perWeek: c.perWeek, days: c.days, hourLocal: c.hourLocal, platforms: s.platforms, mode: s.mode, formats: c.formats, active: s.active }}
                        />
                        <DeleteSeriesButton id={s.id} name={s.name} />
                      </Inline>
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
