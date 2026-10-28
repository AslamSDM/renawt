"use client";

import * as React from "react";
import { Link2, RefreshCw, Unplug } from "lucide-react";
import { EmptyState, Inline, Section, Stack } from "@/components/layout";
import { Avatar, Badge, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, toast } from "@/components/ui";
import { connectSocial, disconnectSocial, syncSocial } from "@/lib/actions/social";
import { platformLabel } from "@/lib/queries/format";

export interface SocialRow {
  id: string;
  platform: string;
  handle: string | null;
  avatarUrl: string | null;
  status: string;
  provider: string;
  connectedAt: string;
}

const CONNECTABLE = ["TIKTOK", "YOUTUBE", "INSTAGRAM", "FACEBOOK"] as const;
const STATUS: Record<string, { label: string; variant: "success" | "warning" | "danger" | "neutral" }> = {
  connected: { label: "Connected", variant: "success" },
  expired: { label: "Expired", variant: "warning" },
  revoked: { label: "Disconnected", variant: "neutral" },
  error: { label: "Error", variant: "danger" },
};

export function SocialAccounts({ channelId, accounts, canPublish }: { channelId: string; accounts: SocialRow[]; canPublish: boolean }) {
  const [connecting, setConnecting] = React.useState<string | null>(null);
  const [syncing, startSync] = React.useTransition();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function connect(platform: (typeof CONNECTABLE)[number]) {
    setConnecting(platform);
    const res = await connectSocial({ channelId, platform });
    if (!res.ok) {
      setConnecting(null);
      return void toast.error(res.error);
    }
    window.location.assign(res.data.url);
  }

  return (
    <Stack gap={8}>
      <Section
        title="Connected accounts"
        description="Remawt posts through these. Connecting opens the platform’s own sign-in."
        action={
          <Button
            size="sm"
            variant="ghost"
            loading={syncing}
            onClick={() =>
              startSync(async () => {
                const res = await syncSocial(channelId);
                if (!res.ok) return void toast.error(res.error);
                toast.success("Accounts synced.");
              })
            }
          >
            <RefreshCw /> Sync
          </Button>
        }
      >
        {accounts.length === 0 ? (
          <EmptyState size="compact" icon={Link2} title="No accounts connected" description="Connect at least one account to post or schedule videos from Remawt." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead numeric className="hidden sm:table-cell">
                  Connected
                </TableHead>
                <TableHead numeric>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => {
                const st = STATUS[a.status] ?? { label: a.status, variant: "neutral" as const };
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar src={a.avatarUrl} name={a.handle ?? a.platform} size="sm" />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate">{a.handle ? `@${a.handle.replace(/^@/, "")}` : "Account"}</span>
                          <span className="mono-tick">{platformLabel(a.platform)}</span>
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </TableCell>
                    <TableCell numeric className="hidden whitespace-nowrap text-muted sm:table-cell">
                      {new Date(a.connectedAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
                    </TableCell>
                    <TableCell numeric>
                      {a.status === "connected" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={busyId === a.id}
                          onClick={async () => {
                            setBusyId(a.id);
                            const res = await disconnectSocial(a.id);
                            setBusyId(null);
                            if (!res.ok) return void toast.error(res.error);
                            toast.success("Account disconnected.");
                          }}
                        >
                          <Unplug /> Disconnect
                        </Button>
                      ) : (
                        a.platform !== "X" &&
                        (CONNECTABLE as readonly string[]).includes(a.platform) && (
                          <Button size="sm" variant="outline" loading={connecting === a.platform} onClick={() => connect(a.platform as (typeof CONNECTABLE)[number])}>
                            Reconnect
                          </Button>
                        )
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Section>
      <Section title="Connect a platform" description={canPublish ? "One account per platform per channel." : "You can connect now; posting starts on a paid plan."}>
        <Inline gap={2}>
          {CONNECTABLE.map((p) => (
            <Button key={p} variant="outline" loading={connecting === p} disabled={!!connecting && connecting !== p} onClick={() => connect(p)}>
              <Link2 /> {platformLabel(p)}
            </Button>
          ))}
        </Inline>
      </Section>
    </Stack>
  );
}
