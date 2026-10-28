"use client";

import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { FORMATS } from "@remawt/shared";
import { cn } from "@/lib/utils";
import { Grid, Stack } from "@/components/layout";
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
  IconButton,
  Input,
  Label,
  RadioCard,
  RadioGroup,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  toast,
} from "@/components/ui";
import { deleteSeries, setSeriesActive, upsertSeries } from "@/lib/actions/series";

const PLATFORMS = [
  { id: "TIKTOK", label: "TikTok" },
  { id: "YOUTUBE", label: "YouTube Shorts" },
  { id: "INSTAGRAM", label: "Instagram Reels" },
  { id: "FACEBOOK", label: "Facebook Reels" },
] as const;
type PlatformId = (typeof PLATFORMS)[number]["id"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface SeriesFormValue {
  id?: string;
  name: string;
  perWeek: number;
  days: number[];
  hourLocal: number;
  platforms: string[];
  mode: "APPROVE" | "AUTO";
  formats: string[];
  active: boolean;
}

const EMPTY: SeriesFormValue = { name: "", perWeek: 5, days: [1, 2, 3, 4, 5], hourLocal: 18, platforms: ["YOUTUBE", "TIKTOK"], mode: "APPROVE", formats: [], active: true };

export function SeriesDialog({ channelId, initial, timezone }: { channelId: string; initial?: SeriesFormValue; timezone: string }) {
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState<SeriesFormValue>(initial ?? EMPTY);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, start] = React.useTransition();
  const set = (p: Partial<SeriesFormValue>) => setV((x) => ({ ...x, ...p }));
  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  const hasTikTok = v.platforms.includes("TIKTOK");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setV(initial ?? EMPTY);
          setErrors({});
        }
      }}
    >
      <DialogTrigger asChild>
        {initial ? (
          <IconButton size="sm" aria-label={`Edit ${initial.name}`}>
            <Pencil />
          </IconButton>
        ) : (
          <Button>
            <Plus /> New series
          </Button>
        )}
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit series" : "New series"}</DialogTitle>
          <DialogDescription>A series pulls approved ideas into production on a cadence and schedules the posts. Times are in {timezone}.</DialogDescription>
        </DialogHeader>
        <form
          id="series-form"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await upsertSeries({ ...v, channelId, platforms: v.platforms as PlatformId[] });
              if (!res.ok) {
                setErrors(res.fieldErrors ?? {});
                return void toast.error(res.error);
              }
              toast.success(initial ? "Series updated." : "Series created.");
              setOpen(false);
            });
          }}
        >
          <Stack gap={6}>
            <Grid cols={2}>
              <FormField label="Name" required error={errors.name}>
                <Input value={v.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} placeholder="Weekday explainers" />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Videos / week" error={errors.perWeek}>
                  <Input type="number" min={1} max={21} value={v.perWeek} onChange={(e) => set({ perWeek: Math.max(1, Math.min(21, Number(e.target.value) || 1)) })} />
                </FormField>
                <FormField label="Post at">
                  <Select value={String(v.hourLocal)} onValueChange={(h) => set({ hourLocal: Number(h) })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, h) => (
                        <SelectItem key={h} value={String(h)}>
                          {String(h).padStart(2, "0")}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            </Grid>
            <FormField label="Days" error={errors.days}>
              <div role="group" className="flex flex-wrap gap-1">
                {DAYS.map((d, i) => {
                  const on = v.days.includes(i + 1);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set({ days: toggle(v.days, i + 1).sort() })}
                      className={cn(
                        "type-small h-8 w-12 rounded-[2px] border transition-colors duration-120",
                        on ? "border-accent bg-accent-soft text-ink" : "border-rule-strong text-muted hover:border-ink/40 hover:text-ink",
                      )}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </FormField>
            <FormField label="Platforms" error={errors.platforms}>
              <div role="group" className="flex flex-wrap gap-x-6 gap-y-3">
                {PLATFORMS.map((p) => (
                  <span key={p.id} className="flex items-center gap-2">
                    <Checkbox id={`sp-${p.id}`} checked={v.platforms.includes(p.id)} onCheckedChange={() => set({ platforms: toggle(v.platforms, p.id) })} />
                    <Label htmlFor={`sp-${p.id}`}>{p.label}</Label>
                  </span>
                ))}
              </div>
            </FormField>
            <FormField label="Mode" error={errors.mode}>
              <RadioGroup value={v.mode} onValueChange={(m) => set({ mode: m as SeriesFormValue["mode"] })} className="grid-cols-1 sm:grid-cols-2">
                <RadioCard value="APPROVE">
                  <span className="type-subheading text-ink">Approve each batch</span>
                  <span className="type-small text-muted">Videos are made automatically; posts wait on the Schedule page for your OK.</span>
                </RadioCard>
                <RadioCard value="AUTO" disabled={hasTikTok}>
                  <span className="type-subheading text-ink">Full autopilot</span>
                  <span className="type-small text-muted">{hasTikTok ? "Not available with TikTok: TikTok posts always need your approval." : "Posts go out on schedule without asking."}</span>
                </RadioCard>
              </RadioGroup>
            </FormField>
            <FormField label="Formats" aside="Optional" hint="Leave empty to let the radar pick what’s working.">
              <div role="group" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {FORMATS.map((f) => (
                  <span key={f.id} className="flex items-center gap-2">
                    <Checkbox id={`sf-${f.id}`} checked={v.formats.includes(f.id)} onCheckedChange={() => set({ formats: toggle(v.formats, f.id) })} />
                    <Label htmlFor={`sf-${f.id}`}>{f.name}</Label>
                  </span>
                ))}
              </div>
            </FormField>
          </Stack>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="series-form" loading={pending}>
            {initial ? "Save series" : "Create series"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SeriesActiveSwitch({ id, active, name }: { id: string; active: boolean; name: string }) {
  const [on, setOn] = React.useState(active);
  const [pending, start] = React.useTransition();
  return (
    <Switch
      checked={on}
      disabled={pending}
      aria-label={`${name} active`}
      onCheckedChange={(v) => {
        setOn(v);
        start(async () => {
          const res = await setSeriesActive(id, v);
          if (!res.ok) {
            setOn(!v);
            return void toast.error(res.error);
          }
          toast.success(v ? `${name} is running.` : `${name} is paused.`);
        });
      }}
    />
  );
}

export function DeleteSeriesButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <IconButton size="sm" aria-label={`Delete ${name}`}>
          <Trash2 />
        </IconButton>
      </DialogTrigger>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Delete {name}?</DialogTitle>
          <DialogDescription>Videos it already made stay in your library. Scheduled posts are not cancelled.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Keep series
          </Button>
          <Button
            variant="destructive"
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await deleteSeries(id);
                if (!res.ok) return void toast.error(res.error);
                toast.success("Series deleted.");
                setOpen(false);
              })
            }
          >
            Delete series
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

