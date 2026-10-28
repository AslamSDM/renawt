import { PageHeader } from "@/components/layout";
import { NoChannel } from "@/components/app/no-channel";
import { NewVideoForm } from "@/components/app/new-video/new-video-form";
import { prisma } from "@/lib/db/prisma";
import { getActiveChannel } from "@/lib/queries/channels";
import { loadEntitlements } from "@/lib/queries/billing";
import { parseKit } from "@/lib/queries/shapes";
import { getViewer } from "@/lib/queries/viewer";

export const metadata = { title: "New video" };

export default async function NewVideoPage({ searchParams }: { searchParams: Promise<{ ideaId?: string; tab?: string }> }) {
  const { ideaId, tab } = await searchParams;
  const viewer = await getViewer("/app/new");
  const [channel, ent] = await Promise.all([getActiveChannel(viewer), loadEntitlements(viewer)]);

  const header = (
    <PageHeader
      title="New video"
      description="Start from an idea, your own footage, or a voice recording. Every video uses your channel’s look, voice and persona."
    />
  );
  if (!channel) {
    return (
      <>
        {header}
        <NoChannel what="new videos" />
      </>
    );
  }

  const idea =
    ideaId && !viewer.bypass
      ? await prisma.idea.findFirst({
          where: { id: ideaId, channelId: channel.id, status: { in: ["SUGGESTED", "APPROVED"] } },
          select: { id: true, title: true, hook: true, format: true, angle: true },
        })
      : null;
  const kit = parseKit(channel.kit);
  const initialTab = tab === "video" || tab === "audio" ? tab : "prompt";

  return (
    <>
      {header}
      <NewVideoForm
        channelId={channel.id}
        plan={{ id: ent.plan.id, name: ent.plan.name, maxDurationSec: ent.plan.maxDurationSec, quality: ent.plan.quality }}
        videosRemaining={ent.videosRemaining}
        defaultDuration={kit?.defaultDurationSec ?? 45}
        idea={idea}
        initialTab={initialTab}
      />
    </>
  );
}
