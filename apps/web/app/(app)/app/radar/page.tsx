import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight, Radar as RadarIcon } from "lucide-react";
import { EmptyState, Grid, Inline, PageHeader, Section, Stack } from "@/components/layout";
import { Badge, Button, Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle, IconButton } from "@/components/ui";
import { FormatBadge, PlatformBadge } from "@/components/app/badges";
import { NoChannel } from "@/components/app/no-channel";
import { GenerateIdeasButton, RefreshRadarButton } from "@/components/app/radar-actions";
import { getActiveChannel } from "@/lib/queries/channels";
import { formatCount, formatName, formatDate, nicheName, shiftWeek, weekKey } from "@/lib/queries/format";
import { loadRadar } from "@/lib/queries/radar";
import { parseExemplars } from "@/lib/queries/shapes";
import { getViewer } from "@/lib/queries/viewer";
import { cn } from "@/lib/utils";

export const metadata = { title: "Radar" };

function weekRange(key: string) {
  const m = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!m) return key;
  const jan4 = new Date(Date.UTC(Number(m[1]), 0, 4));
  const mon = new Date(jan4);
  mon.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (Number(m[2]) - 1) * 7);
  const sun = new Date(mon);
  sun.setUTCDate(mon.getUTCDate() + 6);
  return `${formatDate(mon, { month: "short", day: "numeric" }, "UTC")} – ${formatDate(sun, { month: "short", day: "numeric" }, "UTC")}`;
}

export default async function RadarPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week: weekParam } = await searchParams;
  const viewer = await getViewer("/app/radar");
  const channel = await getActiveChannel(viewer);
  const current = weekKey();
  const week = weekParam && /^\d{4}-W\d{2}$/.test(weekParam) ? weekParam : current;

  if (!channel) {
    return (
      <>
        <PageHeader title="Radar" description="What’s breaking out in your niche this week, clustered into trends you can make videos from." />
        <NoChannel what="trend cards" />
      </>
    );
  }

  const data = await loadRadar(viewer, channel.id, channel.niche, week);
  const isCurrent = week === current;

  return (
    <>
      <PageHeader
        title="Radar"
        description={`Breakout videos in ${nicheName(channel.niche)}, clustered by topic and format. Generate ideas to turn them into your queue.`}
        meta={
          <Inline gap={1}>
            <IconButton asChild size="sm" aria-label="Previous week">
              <Link href={`/app/radar?week=${shiftWeek(week, -1)}`}>
                <ChevronLeft />
              </Link>
            </IconButton>
            <span className="mono-label tabular-nums">
              {week} · {weekRange(week)}
            </span>
            {isCurrent ? (
              <IconButton size="sm" aria-label="Next week" disabled>
                <ChevronRight />
              </IconButton>
            ) : (
              <IconButton asChild size="sm" aria-label="Next week">
                <Link href={`/app/radar?week=${shiftWeek(week, 1)}`}>
                  <ChevronRight />
                </Link>
              </IconButton>
            )}
            {!isCurrent && (
              <Button asChild size="sm" variant="ghost">
                <Link href="/app/radar">This week</Link>
              </Button>
            )}
          </Inline>
        }
        actions={
          <>
            <RefreshRadarButton channelId={channel.id} nextAllowedAt={data.nextRefreshAt} />
            <GenerateIdeasButton channelId={channel.id} weekKey={week} />
          </>
        }
      />

      <Grid cols="aside" gap={8}>
        <Section title="Trend cards" description={data.cards.length ? `${data.cards.length} clusters, strongest first.` : undefined}>
          {data.cards.length === 0 ? (
            <EmptyState
              icon={RadarIcon}
              title={isCurrent ? "No trend cards for this week yet" : `No trend cards for ${week}`}
              description="The radar scans YouTube, TikTok, Reddit and news daily. Refresh to scan your niche now; cards appear in a few minutes."
              action={<RefreshRadarButton channelId={channel.id} nextAllowedAt={data.nextRefreshAt} />}
            />
          ) : (
            <Stack gap={4}>
              {data.cards.map((card) => {
                const exemplars = parseExemplars(card.exemplars).slice(0, 3);
                const ideas = data.ideaCounts[card.id] ?? 0;
                return (
                  <Card key={card.id}>
                    <CardHeader>
                      <CardTitle>{card.topic}</CardTitle>
                      <CardDescription className="max-w-[64ch]">{card.summary}</CardDescription>
                      <CardAction>
                        <span className="mono-tick tabular-nums" title="Trend score">
                          {card.score.toFixed(1)}
                        </span>
                      </CardAction>
                    </CardHeader>
                    <Inline gap={2}>
                      <FormatBadge format={card.format} />
                      {card.hookType && <Badge variant="neutral">{card.hookType.replace(/[-_]/g, " ")} hook</Badge>}
                    </Inline>
                    {exemplars.length > 0 && (
                      <ul className="flex flex-col border-t border-rule">
                        {exemplars.map((ex) => (
                          <li key={ex.url} className="border-b border-rule last:border-0">
                            <a
                              href={ex.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="group grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 sm:grid-cols-[88px_minmax(0,1fr)_72px_auto]"
                            >
                              <span className="hidden sm:block">{ex.platform && <PlatformBadge platform={ex.platform} />}</span>
                              <span className="type-small truncate text-ink group-hover:underline group-hover:decoration-rule-strong group-hover:underline-offset-4">{ex.title || ex.url}</span>
                              <span className="mono-tick hidden text-right tabular-nums sm:block">{ex.views != null ? `${formatCount(ex.views)} views` : ""}</span>
                              <ArrowUpRight className="size-3.5 text-subtle" aria-label="Opens in a new tab" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                    <CardFooter className="justify-between">
                      <span className="type-small text-muted tabular-nums">{ideas ? `${ideas} idea${ideas === 1 ? "" : "s"} from this trend` : "No ideas yet"}</span>
                      {ideas ? (
                        <Button asChild size="sm" variant="ghost">
                          <Link href="/app/ideas">View ideas</Link>
                        </Button>
                      ) : (
                        <GenerateIdeasButton channelId={channel.id} weekKey={week} size="sm" variant="outline" label="Generate ideas" />
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </Stack>
          )}
        </Section>

        <Section title="Format share" description="Share of this week’s clusters by format, against last week.">
          {data.formatTrends.length === 0 ? (
            <EmptyState size="compact" title="No format data yet" description="Appears once the radar has cards for this week." />
          ) : (
            <Card>
              <ul className="flex flex-col gap-4">
                {data.formatTrends.map((f) => (
                  <li key={f.format} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="type-small truncate text-ink">{formatName(f.format)}</span>
                      <span className="flex items-baseline gap-2 tabular-nums">
                        <span className="type-small text-ink">{Math.round(f.share * 100)}%</span>
                        <span className={cn("type-caption", f.delta > 0.005 ? "text-success" : f.delta < -0.005 ? "text-danger" : "text-subtle")}>
                          {f.delta > 0 ? "+" : ""}
                          {Math.round(f.delta * 100)} pts
                        </span>
                      </span>
                    </div>
                    <div className="relative h-1 rounded-full bg-rule" aria-hidden>
                      <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${Math.max(2, f.share * 100)}%` }} />
                      <span className="absolute -inset-y-0.5 w-px bg-ink/60" style={{ left: `${f.prevShare * 100}%` }} title="Last week" />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mono-tick">Tick = last week</p>
            </Card>
          )}
        </Section>
      </Grid>
    </>
  );
}
