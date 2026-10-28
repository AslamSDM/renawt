"use client";

import * as React from "react";
import Link from "next/link";
import { Info, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState, Inline, Stack } from "@/components/layout";
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  FormField,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Switch,
  Textarea,
  toast,
} from "@/components/ui";
import { schedulePublication } from "@/lib/actions/publish";
import { platformLabel } from "@/lib/queries/format";
import { ChipInput } from "../chip-input";
import { zonedNow, zonedToUtc } from "@/lib/queries/tz";

export interface PublishAccount {
  id: string;
  platform: string;
  handle: string | null;
  avatarUrl: string | null;
}

type Privacy = "public" | "friends" | "followers" | "private";
const PRIVACY: { value: Privacy; label: string }[] = [
  { value: "public", label: "Everyone" },
  { value: "friends", label: "Friends" },
  { value: "followers", label: "Followers" },
  { value: "private", label: "Only me" },
];

const CAPTION_MAX: Record<string, number> = { TIKTOK: 2200, YOUTUBE: 5000, INSTAGRAM: 2200, FACEBOOK: 2200, THREADS: 500, LINKEDIN: 3000, X: 280, PINTEREST: 500 };
const TAGS_MAX: Record<string, number> = { TIKTOK: 5, INSTAGRAM: 30, THREADS: 1, YOUTUBE: 15 };

interface Target {
  enabled: boolean;
  title: string;
  caption: string;
  hashtags: string[];
  madeForKids: boolean;
  privacy: Privacy | null;
  allowComment: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  promotes: boolean;
  yourBrand: boolean;
  branded: boolean;
  consent: boolean;
}

function SwitchRow({ id, label, hint, checked, onChange, disabled }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <Stack gap={1}>
        <Label htmlFor={id}>{label}</Label>
        {hint && <span className="type-caption text-muted">{hint}</span>}
      </Stack>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

function TikTokBlock({ acc, t, set }: { acc: PublishAccount; t: Target; set: (p: Partial<Target>) => void }) {
  const brandedNotice = t.branded ? "Your video will be labeled “Paid partnership”." : t.yourBrand ? "Your video will be labeled “Promotional content”." : null;
  return (
    <Stack gap={4}>
      <FormField label="Who can view this video" required hint="TikTok requires you to choose each time. There is no default.">
        <Select value={t.privacy ?? undefined} onValueChange={(v) => set({ privacy: v as Privacy })}>
          <SelectTrigger aria-label="TikTok privacy">
            <SelectValue placeholder="Choose who can view" />
          </SelectTrigger>
          <SelectContent>
            {PRIVACY.map((p) => (
              <SelectItem key={p.value} value={p.value} disabled={p.value === "private" && t.branded}>
                {p.label}
                {p.value === "private" && t.branded ? " · not allowed for branded content" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <Stack gap={3}>
        <span className="mono-tick">Let viewers</span>
        <Inline gap={6}>
          {(
            [
              ["allowComment", "Comment"],
              ["allowDuet", "Duet"],
              ["allowStitch", "Stitch"],
            ] as const
          ).map(([k, label]) => (
            <span key={k} className="flex items-center gap-2">
              <Checkbox id={`${acc.id}-${k}`} checked={t[k]} onCheckedChange={(v) => set({ [k]: v === true })} />
              <Label htmlFor={`${acc.id}-${k}`}>{label}</Label>
            </span>
          ))}
        </Inline>
      </Stack>
      <Separator />
      <SwitchRow
        id={`${acc.id}-promotes`}
        label="Disclose commercial content"
        hint="Turn on if this video promotes yourself, a brand, a product or a service."
        checked={t.promotes}
        onChange={(v) => set({ promotes: v, ...(v ? {} : { yourBrand: false, branded: false }) })}
      />
      {t.promotes && (
        <Stack gap={3}>
          <span className="flex items-start gap-2">
            <Checkbox id={`${acc.id}-brand`} checked={t.yourBrand} onCheckedChange={(v) => set({ yourBrand: v === true })} />
            <Stack gap={1}>
              <Label htmlFor={`${acc.id}-brand`}>Your brand</Label>
              <span className="type-caption text-muted">You’re promoting yourself or your own business.</span>
            </Stack>
          </span>
          <span className="flex items-start gap-2">
            <Checkbox
              id={`${acc.id}-branded`}
              checked={t.branded}
              onCheckedChange={(v) => set({ branded: v === true, ...(v === true && t.privacy === "private" ? { privacy: null } : {}) })}
            />
            <Stack gap={1}>
              <Label htmlFor={`${acc.id}-branded`}>Branded content</Label>
              <span className="type-caption text-muted">You’re promoting another brand or a third party.</span>
            </Stack>
          </span>
          {brandedNotice ? (
            <p className="type-caption flex items-center gap-1.5 text-ink">
              <Info className="size-3.5 text-accent" aria-hidden /> {brandedNotice}
            </p>
          ) : (
            <p className="type-caption text-warning">Pick at least one option to post with a disclosure.</p>
          )}
        </Stack>
      )}
      <span className="flex items-start gap-2">
        <Checkbox id={`${acc.id}-consent`} checked={t.consent} onCheckedChange={(v) => set({ consent: v === true })} aria-required />
        <Label htmlFor={`${acc.id}-consent`} className="type-small font-normal text-muted">
          By posting, you agree to TikTok’s{" "}
          <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noreferrer noopener" className="text-ink underline decoration-rule-strong underline-offset-4">
            Music Usage Confirmation
          </a>
          {t.branded && (
            <>
              {" "}and{" "}
              <a href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noreferrer noopener" className="text-ink underline decoration-rule-strong underline-offset-4">
                Branded Content Policy
              </a>
            </>
          )}
          .
        </Label>
      </span>
    </Stack>
  );
}

/** Publish / schedule drawer. Implements the TikTok audit checklist from packages/publisher/README.md. */
export function PublishSheet({
  videoId,
  accounts,
  timezone,
  defaults,
  aiLabelDefault,
  canPublish,
  ready,
}: {
  videoId: string;
  accounts: PublishAccount[];
  timezone: string;
  defaults: { title: string; caption: string; hashtags: string[] };
  aiLabelDefault: boolean;
  canPublish: boolean;
  ready: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const initial = React.useMemo(() => zonedNow(timezone), [timezone]);
  const [date, setDate] = React.useState(initial.date);
  const [time, setTime] = React.useState(initial.time);
  const [now, setNow] = React.useState(false);
  const [aiLabel, setAiLabel] = React.useState(aiLabelDefault);
  const [pending, start] = React.useTransition();
  const [targets, setTargets] = React.useState<Record<string, Target>>(() =>
    Object.fromEntries(
      accounts.map((a) => [
        a.id,
        {
          enabled: accounts.length === 1,
          title: defaults.title.slice(0, 100),
          caption: defaults.caption,
          hashtags: defaults.hashtags.slice(0, TAGS_MAX[a.platform] ?? 10),
          madeForKids: false,
          privacy: null,
          allowComment: false,
          allowDuet: false,
          allowStitch: false,
          promotes: false,
          yourBrand: false,
          branded: false,
          consent: false,
        } satisfies Target,
      ]),
    ),
  );
  const set = (id: string, p: Partial<Target>) => setTargets((t) => ({ ...t, [id]: { ...t[id], ...p } }));
  const selected = accounts.filter((a) => targets[a.id]?.enabled);

  function submit() {
    if (selected.length === 0) return void toast.error("Pick at least one account.");
    const when = now ? new Date(Date.now() + 60_000) : zonedToUtc(date, time, timezone);
    if (!now && when.getTime() < Date.now()) return void toast.error("Pick a time in the future.");
    for (const a of selected) {
      const t = targets[a.id];
      if (a.platform === "TIKTOK") {
        if (!t.privacy) return void toast.error(`Choose who can view the post on ${a.handle ?? "TikTok"}.`);
        if (t.promotes && !t.yourBrand && !t.branded) return void toast.error("Pick what the TikTok post promotes, or turn the disclosure off.");
        if (!t.consent) return void toast.error("Confirm TikTok’s Music Usage Confirmation.");
      }
      if (a.platform === "YOUTUBE" && !t.title.trim()) return void toast.error("YouTube needs a title.");
    }
    start(async () => {
      const res = await schedulePublication({
        videoId,
        targets: selected.map((a) => {
          const t = targets[a.id];
          const tt = a.platform === "TIKTOK";
          return {
            socialAccountId: a.id,
            scheduledAt: when.toISOString(),
            title: a.platform === "YOUTUBE" ? t.title.trim() : undefined,
            caption: t.caption,
            hashtags: t.hashtags,
            aiLabel,
            madeForKids: t.madeForKids,
            ...(tt
              ? {
                  privacy: t.privacy ?? undefined,
                  allowComment: t.allowComment,
                  allowDuet: t.allowDuet,
                  allowStitch: t.allowStitch,
                  commercial: t.promotes && t.yourBrand,
                  brandedContent: t.promotes && t.branded,
                  consent: t.consent,
                }
              : {}),
          };
        }),
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(now ? "Posting now. It can take a few minutes to appear on each platform." : `Scheduled ${res.data.count} post${res.data.count === 1 ? "" : "s"}.`);
      setOpen(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button disabled={!ready}>
          <Send /> Publish
        </Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Publish</SheetTitle>
          <SheetDescription>Post now or schedule in your channel’s time zone ({timezone}).</SheetDescription>
        </SheetHeader>
        <SheetBody>
          {!canPublish ? (
            <EmptyState
              size="compact"
              title="Posting needs a paid plan"
              description="Free videos can be downloaded and posted by hand. Starter and up post to your accounts on schedule."
              action={
                <Button asChild>
                  <Link href="/app/settings/billing">See plans</Link>
                </Button>
              }
            />
          ) : accounts.length === 0 ? (
            <EmptyState
              size="compact"
              title="No accounts connected"
              description="Connect TikTok, YouTube or Instagram in channel settings, then come back to post."
              action={
                <Button asChild>
                  <Link href="/app/settings?tab=accounts">Connect accounts</Link>
                </Button>
              }
            />
          ) : (
            <Stack gap={7}>
              <Stack gap={4}>
                <SwitchRow id="pub-now" label="Post now" checked={now} onChange={setNow} />
                {!now && (
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Date">
                      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={zonedNow(timezone, 0).date} />
                    </FormField>
                    <FormField label="Time" aside={timezone.split("/").pop()?.replace(/_/g, " ")}>
                      <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} step={900} />
                    </FormField>
                  </div>
                )}
                <SwitchRow
                  id="pub-ai"
                  label="Label as AI-generated"
                  hint="Sets the platform’s AI / synthetic media flag. On by default for every Remawt video."
                  checked={aiLabel}
                  onChange={setAiLabel}
                />
              </Stack>

              {accounts.map((a) => {
                const t = targets[a.id];
                const max = CAPTION_MAX[a.platform] ?? 2200;
                return (
                  <section key={a.id} className={cn("flex flex-col gap-4 rounded-[2px] border p-5 transition-colors", t.enabled ? "border-rule-strong bg-paper" : "border-rule bg-transparent")}>
                    <div className="flex items-center gap-3">
                      <Checkbox id={`${a.id}-on`} checked={t.enabled} onCheckedChange={(v) => set(a.id, { enabled: v === true })} aria-label={`Post to ${a.handle ?? platformLabel(a.platform)}`} />
                      <Avatar src={a.avatarUrl} name={a.handle ?? a.platform} size="md" />
                      <label htmlFor={`${a.id}-on`} className="flex min-w-0 flex-1 cursor-pointer flex-col">
                        <span className="type-small truncate font-medium text-ink">{a.handle ? `@${a.handle.replace(/^@/, "")}` : "Connected account"}</span>
                        <span className="mono-tick">{platformLabel(a.platform)}</span>
                      </label>
                      {a.platform === "TIKTOK" && <Badge variant="outline">Needs your OK</Badge>}
                    </div>
                    {t.enabled && (
                      <Stack gap={4}>
                        {a.platform === "YOUTUBE" && (
                          <FormField label="Title" required aside={<span className="tabular-nums">{t.title.length}/100</span>}>
                            <Input value={t.title} onChange={(e) => set(a.id, { title: e.target.value.replace(/[<>]/g, "") })} maxLength={100} />
                          </FormField>
                        )}
                        <FormField label={a.platform === "YOUTUBE" ? "Description" : "Caption"} aside={<span className="tabular-nums">{t.caption.length}/{max}</span>}>
                          <Textarea value={t.caption} onChange={(e) => set(a.id, { caption: e.target.value })} maxLength={max} rows={3} />
                        </FormField>
                        <FormField label="Hashtags" aside={TAGS_MAX[a.platform] ? `${t.hashtags.length}/${TAGS_MAX[a.platform]}` : undefined}>
                          <ChipInput value={t.hashtags} onChange={(v) => set(a.id, { hashtags: v.map((x) => x.replace(/^#/, "")) })} max={TAGS_MAX[a.platform]} placeholder="Add a hashtag" />
                        </FormField>
                        {a.platform === "YOUTUBE" && (
                          <SwitchRow id={`${a.id}-kids`} label="Made for kids" hint="Required by YouTube. Leave off unless the video is aimed at children." checked={t.madeForKids} onChange={(v) => set(a.id, { madeForKids: v })} />
                        )}
                        {a.platform === "TIKTOK" && <TikTokBlock acc={a} t={t} set={(p) => set(a.id, p)} />}
                      </Stack>
                    )}
                  </section>
                );
              })}
              <p className="type-caption text-muted">Posts can take a few minutes to appear after they go out. Status updates on the Schedule page.</p>
            </Stack>
          )}
        </SheetBody>
        {canPublish && accounts.length > 0 && (
          <SheetFooter className="justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} loading={pending} disabled={selected.length === 0}>
              {now ? "Post now" : `Schedule ${selected.length || ""}`.trim()}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
