import Link from "next/link";
import { Lightbulb, Radar } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui";
import { type IdeaCardData } from "@/components/app/idea-card";
import { IdeaBoard } from "@/components/app/idea-board";
import { NoChannel } from "@/components/app/no-channel";
import { GenerateIdeasButton } from "@/components/app/radar-actions";
import { prisma } from "@/lib/db/prisma";
import { getActiveChannel } from "@/lib/queries/channels";
import { parseEvidence, parseRisk } from "@/lib/queries/shapes";
import { getViewer } from "@/lib/queries/viewer";

export const metadata = { title: "Ideas" };

const COLUMNS = [
  { status: "SUGGESTED", title: "Suggested", empty: "Generate ideas from the radar to fill this column." },
  { status: "APPROVED", title: "Approved", empty: "Approve suggestions you want made. Series pull from here." },
  { status: "QUEUED", title: "Queued", empty: "Ideas move here when a video starts." },
  { status: "PRODUCED", title: "Produced", empty: "Finished ideas land here with a link to the video." },
] as const;

export default async function IdeasPage() {
  const viewer = await getViewer("/app/ideas");
  const channel = await getActiveChannel(viewer);
  const header = (
    <PageHeader
      title="Ideas"
      description="Ranked ideas for your channel. Approve the ones worth making, edit the hook, or make a video right away."
      actions={
        channel ? (
          <>
            <Button asChild variant="outline">
              <Link href="/app/radar">
                <Radar /> Radar
              </Link>
            </Button>
            <GenerateIdeasButton channelId={channel.id} />
          </>
        ) : undefined
      }
    />
  );
  if (!channel) {
    return (
      <>
        {header}
        <NoChannel what="ideas" />
      </>
    );
  }

  const ideas = viewer.bypass
    ? []
    : await prisma.idea.findMany({
        where: { channelId: channel.id, status: { in: ["SUGGESTED", "APPROVED", "QUEUED", "PRODUCED"] } },
        orderBy: [{ score: "desc" }, { createdAt: "desc" }],
        take: 200,
        include: { videos: { select: { id: true }, orderBy: { createdAt: "desc" }, take: 1 } },
      });

  const cards: IdeaCardData[] = ideas.map((i) => ({
    id: i.id,
    hook: i.hook,
    title: i.title,
    angle: i.angle,
    format: i.format,
    score: i.score,
    status: i.status,
    risk: parseRisk(i.risk),
    evidence: parseEvidence(i.evidence),
    videoId: i.videos[0]?.id ?? null,
  }));

  if (cards.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={Lightbulb}
          title="No ideas yet"
          description="Ideas are generated from this week’s trend cards for your niche, scored for your channel, and checked for policy risk."
          action={<GenerateIdeasButton channelId={channel.id} />}
        />
      </>
    );
  }

  return (
    <>
      {header}
      <IdeaBoard columns={COLUMNS} cards={cards} />
    </>
  );
}
