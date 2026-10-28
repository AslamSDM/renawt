"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Trash2 } from "lucide-react";
import { Stack } from "@/components/layout";
import { Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, FormField, Input, toast } from "@/components/ui";
import { deleteChannel, setChannelStatus } from "@/lib/actions/channel";

export function DangerZone({ channelId, name, status }: { channelId: string; name: string; status: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [pausing, startPause] = React.useTransition();
  const [deleting, startDelete] = React.useTransition();
  const paused = status === "PAUSED";

  return (
    <Stack gap={4}>
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Stack gap={1}>
            <p className="type-subheading text-ink">{paused ? "Resume channel" : "Pause channel"}</p>
            <p className="type-small max-w-[56ch] text-muted">
              {paused ? "Series and new videos start again. Series stay off until you turn them back on." : "Stops every series and blocks new videos. Scheduled posts still go out unless you cancel them."}
            </p>
          </Stack>
          <Button
            variant="outline"
            loading={pausing}
            onClick={() =>
              startPause(async () => {
                const res = await setChannelStatus(channelId, paused ? "ACTIVE" : "PAUSED");
                if (!res.ok) return void toast.error(res.error);
                toast.success(paused ? "Channel resumed." : "Channel paused.");
                router.refresh();
              })
            }
          >
            {paused ? <Play /> : <Pause />} {paused ? "Resume" : "Pause"}
          </Button>
        </div>
      </Card>
      <Card tone="outline" className="border-danger/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Stack gap={1}>
            <p className="type-subheading text-ink">Delete channel</p>
            <p className="type-small max-w-[56ch] text-muted">Removes the kit, ideas, videos, series and connected accounts for this channel. This can’t be undone.</p>
          </Stack>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 /> Delete
              </Button>
            </DialogTrigger>
            <DialogContent size="sm">
              <DialogHeader>
                <DialogTitle>Delete {name}?</DialogTitle>
                <DialogDescription>Everything on this channel goes, including rendered videos. Posts already on platforms stay there.</DialogDescription>
              </DialogHeader>
              <FormField label={`Type “${name}” to confirm`}>
                <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
              </FormField>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Keep channel
                </Button>
                <Button
                  variant="destructive"
                  loading={deleting}
                  disabled={confirm.trim() !== name}
                  onClick={() =>
                    startDelete(async () => {
                      const res = await deleteChannel(channelId, confirm);
                      if (!res.ok) return void toast.error(res.error);
                      toast.success(`${name} deleted.`);
                      router.push("/app");
                      router.refresh();
                    })
                  }
                >
                  Delete channel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Card>
    </Stack>
  );
}
