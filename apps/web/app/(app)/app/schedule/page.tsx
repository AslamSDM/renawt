import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState, Inline, PageHeader, Section, Toolbar } from "@/components/layout";
import { Badge, Button, IconButton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { PlatformBadge, PublicationStatusBadge } from "@/components/app/badges";
import { NoChannel } from "@/components/app/no-channel";
import { WeekCalendar, type CalendarItem } from "@/components/app/week-calendar";
import { ApprovePublicationButton, CancelPublicationButton } from "@/components/app/schedule-actions";
import { prisma } from "@/lib/db/prisma";
import { getActiveChannel } from "@/lib/queries/channels";
import { formatDate, formatDateTime } from "@/lib/queries/format";
import { parsePublicationMeta } from "@/lib/queries/shapes";
import { zonedParts, zonedWeek } from "@/lib/queries/tz";
import { getViewer } from "@/lib/queries/viewer";

export const metadata = { title: "Schedule" };

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await searchParams;
  const offset = Math.max(-52, Math.min(52, Number.parseInt(w ?? "0", 10) || 0));
  const viewer = await getViewer("/app/schedule");
  const channel = await getActiveChannel(viewer);
  const header = (
    <PageHeader
      title="Schedule"
      description="Every post for this channel, in the channel’s time zone. Series posts in Approve mode wait here for your OK."
    />
  );
  if (!channel) {
    return (
      <>
        {header}
        <NoChannel what="scheduled posts" />
      </>
    );
  }

  const tz = channel.timezone;
  const week = zonedWeek(tz, offset);
  const [pubs, upcoming] = viewer.bypass
    ? [[], []]
    : await Promise.all([
        prisma.publication.findMany({
          where: { video: { channelId: channel.id }, scheduledAt: { gte: week.start, lt: week.end } },
          orderBy: { scheduledAt: "asc" },
          include: { video: { select: { id: true, title: true } }, socialAccount: { select: { handle: true, avatarUrl: true } } },
        }),
        prisma.publication.findMany({
          where: { video: { channelId: channel.id }, OR: [{ status: { in: ["SCHEDULED", "PUBLISHING", "FAILED"] } }, { scheduledAt: { gte: new Date(Date.now() - 7 * 86_400_000) } }] },
          orderBy: { scheduledAt: "asc" },
          take: 100,
          include: { video: { select: { id: true, title: true } }, socialAccount: { select: { handle: true, avatarUrl: true } } },
        }),
      ]);

  const items: CalendarItem[] = pubs.map((p) => {
    const z = zonedParts(p.scheduledAt, tz);
    return {
      id: p.id,
      videoId: p.video.id,
      title: p.video.title,
      platform: p.platform,
      status: p.status,
      day: z.weekday - 1,
      hour: z.hour,
      time: `${String(z.hour).padStart(2, "0")}:${String(z.minute).padStart(2, "0")}`,
      needsApproval: !!parsePublicationMeta(p.meta).needsApproval && p.status === "SCHEDULED",
    };
  });
  const pendingApproval = upcoming.filter((p) => p.status === "SCHEDULED" && parsePublicationMeta(p.meta).needsApproval);
  const label = `${formatDate(`${week.days[0]}T12:00:00Z`, { month: "short", day: "numeric" }, "UTC")} – ${formatDate(`${week.days[6]}T12:00:00Z`, { month: "short", day: "numeric" }, "UTC")}`;

  return (
    <>
      {header}
      {pendingApproval.length > 0 && (
        <Section title="Needs approval" description="Posts from series in Approve mode. Nothing goes out until you approve it.">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Video</TableHead>
                <TableHead>Account</TableHead>
                <TableHead numeric>When</TableHead>
                <TableHead numeric>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingApproval.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="max-w-0 w-full">
                    <Link href={`/app/videos/${p.video.id}`} className="block truncate hover:underline hover:decoration-rule-strong hover:underline-offset-4">
                      {p.video.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Inline gap={2} wrap={false}>
                      <PlatformBadge platform={p.platform} />
                      <span className="text-muted">{p.socialAccount.handle ?? ""}</span>
                    </Inline>
                  </TableCell>
                  <TableCell numeric className="whitespace-nowrap text-muted">
                    {formatDateTime(p.scheduledAt, tz)}
                  </TableCell>
                  <TableCell numeric>
                    <ApprovePublicationButton id={p.id} platform={p.platform} handle={p.socialAccount.handle} avatarUrl={p.socialAccount.avatarUrl} title={p.video.title} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      )}

      <Tabs defaultValue="week">
        <Toolbar>
          <TabsList aria-label="View">
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
          </TabsList>
          <Inline gap={1}>
            <IconButton asChild size="sm" aria-label="Previous week">
              <Link href={`/app/schedule?w=${offset - 1}`}>
                <ChevronLeft />
              </Link>
            </IconButton>
            <span className="mono-label tabular-nums">{label}</span>
            <IconButton asChild size="sm" aria-label="Next week">
              <Link href={`/app/schedule?w=${offset + 1}`}>
                <ChevronRight />
              </Link>
            </IconButton>
            {offset !== 0 && (
              <Button asChild size="sm" variant="ghost">
                <Link href="/app/schedule">Today</Link>
              </Button>
            )}
          </Inline>
        </Toolbar>
        <TabsContent value="week">
          <WeekCalendar days={week.days} items={items} todayIndex={offset === 0 ? zonedParts(new Date(), tz).weekday - 1 : null} timezone={tz} />
        </TabsContent>
        <TabsContent value="list">
          {upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Nothing scheduled"
              description="Publish a ready video, or set up a series to fill the calendar automatically."
              action={
                <Button asChild variant="outline">
                  <Link href="/app/series">Set up a series</Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Video</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead numeric>When</TableHead>
                  <TableHead numeric>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcoming.map((p) => {
                  const meta = parsePublicationMeta(p.meta);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="max-w-0 w-full">
                        <Link href={`/app/videos/${p.video.id}`} className="block truncate hover:underline hover:decoration-rule-strong hover:underline-offset-4">
                          {p.video.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <PlatformBadge platform={p.platform} />
                      </TableCell>
                      <TableCell>
                        <Inline gap={2} wrap={false}>
                          <PublicationStatusBadge status={p.status} />
                          {meta.needsApproval && p.status === "SCHEDULED" && <Badge variant="warning">Needs approval</Badge>}
                        </Inline>
                      </TableCell>
                      <TableCell numeric className="whitespace-nowrap text-muted">
                        {formatDateTime(p.publishedAt ?? p.scheduledAt, tz)}
                      </TableCell>
                      <TableCell numeric>{p.status === "SCHEDULED" && <CancelPublicationButton id={p.id} />}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
