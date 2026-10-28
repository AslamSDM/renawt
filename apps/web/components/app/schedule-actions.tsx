"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import { Stack } from "@/components/layout";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FormField,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Avatar,
  toast,
} from "@/components/ui";
import { approvePublication, cancelPublication } from "@/lib/actions/publish";

export function CancelPublicationButton({ id }: { id: string }) {
  const [pending, start] = React.useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await cancelPublication(id);
          if (!res.ok) return void toast.error(res.error);
          toast.success("Post cancelled.");
        })
      }
    >
      <X /> Cancel
    </Button>
  );
}

/** Series posts in APPROVE mode wait here. TikTok approval asks for privacy and consent each time (audit rule). */
export function ApprovePublicationButton({ id, platform, handle, avatarUrl, title }: { id: string; platform: string; handle: string | null; avatarUrl: string | null; title: string }) {
  const [open, setOpen] = React.useState(false);
  const [privacy, setPrivacy] = React.useState<string | undefined>(undefined);
  const [consent, setConsent] = React.useState(false);
  const [pending, start] = React.useTransition();
  const tiktok = platform === "TIKTOK";

  const approve = () =>
    start(async () => {
      const res = await approvePublication({ publicationId: id, privacy, consent });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Approved. It posts at the scheduled time.");
      setOpen(false);
    });

  if (!tiktok) {
    return (
      <Button size="sm" variant="outline" loading={pending} onClick={approve}>
        <Check /> Approve
      </Button>
    );
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Check /> Approve
        </Button>
      </DialogTrigger>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Approve TikTok post</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <Stack gap={4}>
          <div className="flex items-center gap-3">
            <Avatar src={avatarUrl} name={handle ?? "TikTok"} size="md" />
            <span className="type-small font-medium text-ink">{handle ? `@${handle.replace(/^@/, "")}` : "TikTok account"}</span>
          </div>
          <FormField label="Who can view this video" required>
            <Select value={privacy} onValueChange={setPrivacy}>
              <SelectTrigger>
                <SelectValue placeholder="Choose who can view" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Everyone</SelectItem>
                <SelectItem value="friends">Friends</SelectItem>
                <SelectItem value="followers">Followers</SelectItem>
                <SelectItem value="private">Only me</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <span className="flex items-start gap-2">
            <Checkbox id={`consent-${id}`} checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
            <Label htmlFor={`consent-${id}`} className="type-small font-normal text-muted">
              By posting, you agree to TikTok’s Music Usage Confirmation.
            </Label>
          </span>
        </Stack>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Not now
          </Button>
          <Button onClick={approve} loading={pending} disabled={!privacy || !consent}>
            Approve post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
