"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Check, MoreHorizontal, Pencil, Undo2, X } from "lucide-react";
import { FORMATS } from "@remawt/shared";
import { Inline, Stack } from "@/components/layout";
import {
  Button,
  Card,
  CardAction,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  FormField,
  IconButton,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from "@/components/ui";
import { editIdea, setIdeaStatus } from "@/lib/actions/ideas";
import { FormatBadge, RiskBadge } from "./badges";

export interface IdeaCardData {
  id: string;
  hook: string;
  title: string;
  angle: string | null;
  format: string;
  score: number;
  status: string;
  risk: { level: string; flags: string[] } | null;
  evidence: { url: string; title: string }[];
  videoId?: string | null;
}

function EditIdeaDialog({ idea, open, onOpenChange }: { idea: IdeaCardData; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [hook, setHook] = React.useState(idea.hook);
  const [title, setTitle] = React.useState(idea.title);
  const [angle, setAngle] = React.useState(idea.angle ?? "");
  const [format, setFormat] = React.useState(FORMATS.some((f) => f.id === idea.format) ? idea.format : FORMATS[0].id);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, start] = React.useTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Edit idea</DialogTitle>
          <DialogDescription>Change the hook or angle before it goes to the scriptwriter.</DialogDescription>
        </DialogHeader>
        <form
          id={`edit-${idea.id}`}
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await editIdea({ ideaId: idea.id, hook, title, angle, format });
              if (!res.ok) {
                setErrors(res.fieldErrors ?? {});
                return void toast.error(res.error);
              }
              toast.success("Idea updated.");
              onOpenChange(false);
            });
          }}
        >
          <Stack gap={4}>
            <FormField label="Hook" required error={errors.hook} hint="The first line on screen, under 2 seconds.">
              <Input value={hook} onChange={(e) => setHook(e.target.value)} maxLength={200} />
            </FormField>
            <FormField label="Title" required error={errors.title}>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
            </FormField>
            <FormField label="Angle" aside="Optional" error={errors.angle}>
              <Textarea value={angle} onChange={(e) => setAngle(e.target.value)} rows={3} maxLength={500} />
            </FormField>
            <FormField label="Format" error={errors.format}>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </Stack>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={`edit-${idea.id}`} loading={pending}>
            Save idea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Kanban card on /app/ideas. Actions depend on the column. */
export function IdeaCard({ idea }: { idea: IdeaCardData }) {
  const [editing, setEditing] = React.useState(false);
  const [pending, start] = React.useTransition();
  const act = (status: "APPROVED" | "DISMISSED" | "SUGGESTED", msg: string) =>
    start(async () => {
      const res = await setIdeaStatus(idea.id, status);
      if (!res.ok) return void toast.error(res.error);
      toast.success(msg);
    });
  const editable = idea.status === "SUGGESTED" || idea.status === "APPROVED";

  return (
    <Card aria-busy={pending || undefined} className={pending ? "opacity-60" : undefined}>
      <CardHeader>
        <CardTitle>{idea.hook}</CardTitle>
        <CardDescription>{idea.title}</CardDescription>
        {editable && (
          <CardAction>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton size="sm" aria-label="Idea actions">
                  <MoreHorizontal />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditing(true)}>
                  <Pencil /> Edit
                </DropdownMenuItem>
                {idea.status === "APPROVED" && (
                  <DropdownMenuItem onSelect={() => act("SUGGESTED", "Moved back to suggested.")}>
                    <Undo2 /> Move to suggested
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem destructive onSelect={() => act("DISMISSED", "Idea dismissed.")}>
                  <X /> Dismiss
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        )}
      </CardHeader>
      <Inline gap={2}>
        <FormatBadge format={idea.format} />
        <RiskBadge level={idea.risk?.level} />
        <span className="mono-tick tabular-nums">Score {idea.score.toFixed(1)}</span>
      </Inline>
      {idea.risk && idea.risk.flags.length > 0 && <p className="type-caption text-warning">{idea.risk.flags.join(" · ")}</p>}
      {idea.evidence.length > 0 && (
        <ul className="flex flex-col gap-1">
          {idea.evidence.slice(0, 3).map((e) => (
            <li key={e.url}>
              <a href={e.url} target="_blank" rel="noreferrer noopener" className="type-caption inline-flex max-w-full items-center gap-1 text-muted transition-colors hover:text-ink">
                <span className="truncate">{e.title || new URL(e.url).hostname}</span>
                <ArrowUpRight className="size-3 shrink-0" aria-label="Opens in a new tab" />
              </a>
            </li>
          ))}
        </ul>
      )}
      <CardFooter>
        {idea.status === "SUGGESTED" && (
          <>
            <Button size="sm" variant="outline" onClick={() => act("APPROVED", "Approved. It’s queued for your next video.")} disabled={pending}>
              <Check /> Approve
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href={`/app/new?ideaId=${idea.id}`}>Make video</Link>
            </Button>
          </>
        )}
        {idea.status === "APPROVED" && (
          <Button asChild size="sm">
            <Link href={`/app/new?ideaId=${idea.id}`}>Make video</Link>
          </Button>
        )}
        {(idea.status === "QUEUED" || idea.status === "PRODUCED") &&
          (idea.videoId ? (
            <Button asChild size="sm" variant="ghost">
              <Link href={`/app/videos/${idea.videoId}`}>Open video</Link>
            </Button>
          ) : (
            <span className="type-small text-muted">{idea.status === "QUEUED" ? "In production" : "Produced"}</span>
          ))}
      </CardFooter>
      {editable && <EditIdeaDialog idea={idea} open={editing} onOpenChange={setEditing} />}
    </Card>
  );
}
