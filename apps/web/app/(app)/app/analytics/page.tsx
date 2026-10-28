import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { EmptyState, Grid, PageHeader, Section, Stack, StatTile } from "@/components/layout";
import { Button, Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import { PlatformBadge } from "@/components/app/badges";
import { NoChannel } from "@/components/app/no-channel";
import { Sparkline } from "@/components/app/sparkline";
import { getActiveChannel } from "@/lib/queries/channels";
import { loadAnalytics } from "@/lib/queries/analytics";
import { formatCount, formatDate, formatName } from "@/lib/queries/format";
import { getViewer } from "@/lib/queries/viewer";
import { cn } from "@/lib/utils";

export const metadata = { title: "Analytics" };

function outlierTone(x: number | null) {
  if (x == null) return "text-subtle";
  return x >= 2 ? "text-success" : x < 0.8 ? "text-danger" : "text-ink";
}

export default async function AnalyticsPage() {
  const viewer = await getViewer("/app/analytics");
  const channel = await getActiveChannel(viewer);
  const header = <PageHeader title="Analytics" description="Last 30 days. Outlier score compares each post with your account’s median views: 2× means twice your usual." />;
  if (!channel) {
    return (
      <>
        {header}
        <NoChannel what="analytics" />
      </>
    );
  }
  const data = await loadAnalytics(viewer, channel.id);
  const best = data.formats[0];
  const maxFormat = Math.max(1, ...data.formats.map((f) => f.avgOutlier));

  return (
    <>
      {header}
      <Grid cols="stats">
        <StatTile label="Views 30d" value={formatCount(data.totals.views)} />
        <StatTile label="Posts 30d" value={data.totals.posts} />
        <StatTile label="Avg outlier" value={data.totals.avgOutlier == null ? "–" : `${data.totals.avgOutlier.toFixed(1)}×`} />
        <StatTile label="Best format" value={best ? <span className="type-heading">{formatName(best.format)}</span> : "–"} hint={best ? `${best.avgOutlier.toFixed(1)}× over ${best.posts} posts` : "Needs a few posts"} />
      </Grid>

      {data.rows.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Numbers show up after your first posts"
          description="Remawt reads views, likes, shares and saves at 1h, 6h, 24h, 72h and 7 days after each post, then scores it against your median."
          action={
            <Button asChild variant="outline">
              <Link href="/app/videos">Publish a video</Link>
            </Button>
          }
        />
      ) : (
        <Grid cols="aside" gap={8}>
          <Section title="Per post" description="Latest snapshot for each post.">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Video</TableHead>
                  <TableHead className="hidden sm:table-cell">Trend</TableHead>
                  <TableHead numeric>Views</TableHead>
                  <TableHead numeric className="hidden md:table-cell">Likes</TableHead>
                  <TableHead numeric className="hidden md:table-cell">Shares</TableHead>
                  <TableHead numeric className="hidden md:table-cell">Saves</TableHead>
                  <TableHead numeric>Outlier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow key={r.publicationId}>
                    <TableCell className="max-w-0 w-full">
                      <div className="flex min-w-0 items-center gap-2">
                        <PlatformBadge platform={r.platform} />
                        <Link href={`/app/videos/${r.videoId}`} className="truncate hover:underline hover:decoration-rule-strong hover:underline-offset-4">
                          {r.title}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Sparkline values={r.series} label={`Views over time for ${r.title}`} width={72} height={20} />
                    </TableCell>
                    <TableCell numeric>{formatCount(r.views)}</TableCell>
                    <TableCell numeric className="hidden text-muted md:table-cell">
                      {formatCount(r.likes)}
                    </TableCell>
                    <TableCell numeric className="hidden text-muted md:table-cell">
                      {formatCount(r.shares)}
                    </TableCell>
                    <TableCell numeric className="hidden text-muted md:table-cell">
                      {formatCount(r.saves)}
                    </TableCell>
                    <TableCell numeric className={cn("font-medium", outlierTone(r.outlier))}>
                      {r.outlier == null ? "–" : `${r.outlier.toFixed(1)}×`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>

          <Section title="What’s working" description="Feeds the idea mix: formats and hooks that beat your median get more slots.">
            <Card>
              <p className="mono-tick">Formats by avg outlier</p>
              {data.formats.length === 0 ? (
                <p className="type-small text-muted">Waiting for scored posts.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {data.formats.map((f) => (
                    <li key={f.format} className="flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="type-small truncate text-ink">{formatName(f.format)}</span>
                        <span className={cn("type-small tabular-nums", outlierTone(f.avgOutlier))}>{f.avgOutlier.toFixed(1)}×</span>
                      </div>
                      <div className="relative h-1 rounded-full bg-rule" aria-hidden>
                        <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${(f.avgOutlier / maxFormat) * 100}%` }} />
                      </div>
                      <span className="mono-tick tabular-nums">
                        {f.posts} posts · {formatCount(f.views)} views
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <p className="mono-tick">Top hooks</p>
              {data.hooks.length === 0 ? (
                <p className="type-small text-muted">Waiting for scored posts.</p>
              ) : (
                <Stack gap={3} as="ol">
                  {data.hooks.map((h) => (
                    <li key={h.videoId} className="flex items-baseline justify-between gap-3">
                      <Link href={`/app/videos/${h.videoId}`} className="type-small line-clamp-2 text-ink hover:underline hover:decoration-rule-strong hover:underline-offset-4">
                        {h.hook}
                      </Link>
                      <span className={cn("type-small shrink-0 tabular-nums", outlierTone(h.outlier))}>{h.outlier.toFixed(1)}×</span>
                    </li>
                  ))}
                </Stack>
              )}
            </Card>
            <p className="type-caption text-subtle">Latest post {data.rows[0]?.publishedAt ? formatDate(data.rows[0].publishedAt) : "–"}.</p>
          </Section>
        </Grid>
      )}
    </>
  );
}
