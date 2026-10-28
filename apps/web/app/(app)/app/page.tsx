import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Clapperboard, Lightbulb, Plus, Radar } from "lucide-react";
import { EmptyState, Grid, Inline, PageHeader, Section, StatTile } from "@/components/layout";
import { Badge, Button, Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui";
import { FormatBadge } from "@/components/app/badges";
import { QueueList } from "@/components/app/queue-list";
import { VideoThumb } from "@/components/app/video-thumb";
import { getActiveChannel } from "@/lib/queries/channels";
import { loadEntitlements } from "@/lib/queries/billing";
import { loadHome } from "@/lib/queries/home";
import { nicheName } from "@/lib/queries/format";
import { parseKit } from "@/lib/queries/shapes";
import { getViewer } from "@/lib/queries/viewer";

export const metadata = { title: "Home" };

export default async function HomePage() {
  const viewer = await getViewer();
  const [channel, ent] = await Promise.all([getActiveChannel(viewer), loadEntitlements(viewer)]);

  // First run: a new account has no channel yet, so the kit wizard is the only useful next step.
  if (!channel) redirect("/onboarding");

  const data = await loadHome(viewer, channel);
  const kit = parseKit(channel.kit);
  const palette = kit?.skin.palette;
  const quotaTotal = ent.allowance + ent.rollover;

  return (
    <>
      <PageHeader
        title={channel.name}
        description={kit?.promise ?? `A ${nicheName(channel.niche)} channel.`}
        meta={
          <>
            <Badge variant="outline">{nicheName(channel.niche)}</Badge>
            {channel.status === "PAUSED" && <Badge variant="warning">Paused</Badge>}
          </>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/app/radar">
                <Radar /> Open radar
              </Link>
            </Button>
          </>
        }
      />

      <Grid cols="stats">
        <StatTile label="Videos left" value={ent.videosRemaining} hint={`of ${quotaTotal} this period`} />
        <StatTile label="Scheduled posts" value={data.scheduled} />
        <StatTile label="Published 7d" value={data.published7d} />
        <StatTile label="Avg outlier" value={data.avgOutlier == null ? "–" : `${data.avgOutlier.toFixed(1)}×`} hint="vs your account median, 30 days" />
      </Grid>

      <Section
        title="This week"
        description="Top suggestions from the radar for your niche. Approve to queue, or make one now."
        action={
          <Button asChild size="sm" variant="link">
            <Link href="/app/ideas">
              All ideas <ArrowRight />
            </Link>
          </Button>
        }
      >
        {data.ideas.length === 0 ? (
          <EmptyState
            size="compact"
            icon={Lightbulb}
            title="No suggested ideas yet"
            description="Ideas come from this week’s breakout videos in your niche. Open the radar and generate a batch."
            action={
              <Button asChild variant="outline">
                <Link href="/app/radar">Open radar</Link>
              </Button>
            }
          />
        ) : (
          <Grid cols={3}>
            {data.ideas.map((idea) => (
              <Card key={idea.id} interactive>
                <CardHeader>
                  <CardTitle className="line-clamp-2">{idea.hook}</CardTitle>
                  <CardDescription className="line-clamp-1">{idea.title}</CardDescription>
                </CardHeader>
                <CardFooter className="justify-between">
                  <Inline gap={2}>
                    <FormatBadge format={idea.format} />
                    <span className="mono-tick tabular-nums">{idea.score.toFixed(1)}</span>
                  </Inline>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/app/new?ideaId=${idea.id}`}>Make video</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </Grid>
        )}
      </Section>

      <Section title="In production" description="Videos the engine is working on. Each step updates live on the video page.">
        {data.queue.length === 0 ? (
          <EmptyState
            size="compact"
            icon={Clapperboard}
            title="Nothing rendering right now"
            description="Start a video from an idea, a prompt or your own footage and it will appear here while it’s made."
            action={
              <Button asChild>
                <Link href="/app/new">
                  <Plus /> New video
                </Link>
              </Button>
            }
          />
        ) : (
          <QueueList videos={data.queue} />
        )}
      </Section>

      <Section
        title="Recent videos"
        action={
          <Button asChild size="sm" variant="link">
            <Link href="/app/videos">
              All videos <ArrowRight />
            </Link>
          </Button>
        }
      >
        {data.recent.length === 0 ? (
          <EmptyState size="compact" icon={Clapperboard} title="Your finished videos will line up here" description="Each one keeps your channel’s look, voice and persona." />
        ) : (
          <Grid cols="tiles">
            {data.recent.map((v) => (
              <VideoThumb key={v.id} video={{ ...v, bg: palette?.bg, accent: palette?.accent, ink: palette?.ink }} />
            ))}
          </Grid>
        )}
      </Section>
    </>
  );
}
