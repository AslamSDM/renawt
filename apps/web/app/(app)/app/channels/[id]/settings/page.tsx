import Link from "next/link";
import { notFound } from "next/navigation";
import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/layout";
import { Badge, Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { FALLBACK_VOICES, type VoiceOption } from "@/components/app/kit/defaults";
import { DangerZone } from "@/components/app/settings/danger-zone";
import { KitForm } from "@/components/app/settings/kit-form";
import { SocialAccounts } from "@/components/app/settings/social-accounts";
import { skinFontVars } from "@/app/_landing/fonts";
import { prisma } from "@/lib/db/prisma";
import { engine } from "@/lib/engine";
import { loadEntitlements } from "@/lib/queries/billing";
import { getOwnedChannel } from "@/lib/queries/channels";
import { nicheName } from "@/lib/queries/format";
import { parseKit } from "@/lib/queries/shapes";
import { getViewer } from "@/lib/queries/viewer";
import { ErrorState } from "@/components/layout";

export const metadata = { title: "Channel settings" };

export default async function ChannelSettingsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; connected?: string }> }) {
  const [{ id }, { tab, connected }] = await Promise.all([params, searchParams]);
  const viewer = await getViewer(`/app/channels/${id}/settings`);
  const channel = await getOwnedChannel(viewer, id);
  if (!channel) notFound();

  const [accounts, ent, voicesRes] = await Promise.all([
    viewer.bypass ? [] : prisma.socialAccount.findMany({ where: { channelId: channel.id }, orderBy: [{ platform: "asc" }, { createdAt: "asc" }] }),
    loadEntitlements(viewer),
    engine.voices(viewer.userId),
  ]);
  const kit = parseKit(channel.kit);
  const voices: VoiceOption[] =
    voicesRes.ok && voicesRes.data.length ? voicesRes.data.map((v) => ({ voiceId: v.voiceId, name: v.name, provider: v.provider, previewUrl: v.previewUrl, tags: v.tags })) : FALLBACK_VOICES;
  const initialTab = tab === "accounts" || tab === "danger" ? tab : "kit";

  return (
    <div className={`contents ${skinFontVars}`}>
      <Tabs defaultValue={initialTab} className="gap-8">
        <PageHeader
          title="Channel settings"
          description={`${channel.name} · ${nicheName(channel.niche)}`}
          meta={channel.status === "PAUSED" ? <Badge variant="warning">Paused</Badge> : undefined}
          actions={
            <Button asChild variant="outline">
              <Link href="/app/settings/billing">
                <CreditCard /> Billing
              </Link>
            </Button>
          }
          tabs={
            <TabsList aria-label="Settings sections">
              <TabsTrigger value="kit">Kit</TabsTrigger>
              <TabsTrigger value="accounts">Social accounts</TabsTrigger>
              <TabsTrigger value="danger">Danger zone</TabsTrigger>
            </TabsList>
          }
        />
        <TabsContent value="kit">
          {kit ? (
            <KitForm channel={{ id: channel.id, name: channel.name, handle: channel.handle, niche: channel.niche, timezone: channel.timezone }} kit={kit} voices={voices} />
          ) : (
            <ErrorState title="This channel’s kit couldn’t be read." description="It was saved in an older format. Create a new channel or contact support to repair it." />
          )}
        </TabsContent>
        <TabsContent value="accounts">
          {connected && <p className="type-small sr-only" role="status">{connected} connected. Sync if it doesn’t appear.</p>}
          <SocialAccounts
            channelId={channel.id}
            canPublish={ent.canPublish}
            accounts={accounts.map((a) => ({ id: a.id, platform: a.platform, handle: a.handle, avatarUrl: a.avatarUrl, status: a.status, provider: a.provider, connectedAt: a.createdAt.toISOString() }))}
          />
        </TabsContent>
        <TabsContent value="danger">
          <DangerZone channelId={channel.id} name={channel.name} status={channel.status} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
