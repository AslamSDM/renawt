"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { IdentityKitSchema, NICHES, type IdentityKit } from "@remawt/shared";
import { Section, Stack } from "@/components/layout";
import {
  Button,
  Checkbox,
  FormField,
  Input,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Separator,
  Slider,
  Textarea,
  toast,
} from "@/components/ui";
import { updateChannel } from "@/lib/actions/channel";
import { ChipInput } from "../chip-input";
import { MascotEditor } from "../kit/mascot-editor";
import { PersonaEditor } from "../kit/persona-editor";
import { SkinPicker } from "../kit/skin-picker";
import { VoicePicker } from "../kit/voice-picker";
import { nicheCopy, type VoiceOption } from "../kit/defaults";

const GROUPS = [...new Set(NICHES.map((n) => n.group))];
const TARGETS = [
  { id: "TIKTOK", label: "TikTok" },
  { id: "YOUTUBE", label: "YouTube Shorts" },
  { id: "INSTAGRAM", label: "Instagram Reels" },
] as const;

function timezones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
}

export interface KitFormProps {
  channel: { id: string; name: string; handle: string | null; niche: string; timezone: string };
  kit: IdentityKit;
  voices: VoiceOption[];
}

/** Channel settings → Kit tab. Every field uses the horizontal FormField layout (DESIGN.md §5). */
export function KitForm({ channel, kit: initialKit, voices }: KitFormProps) {
  const router = useRouter();
  const [name, setName] = React.useState(channel.name);
  const [handle, setHandle] = React.useState(channel.handle ?? "");
  const [niche, setNiche] = React.useState(channel.niche);
  const [timezone, setTimezone] = React.useState(channel.timezone);
  const [kit, setKit] = React.useState<IdentityKit>(initialKit);
  const [dirty, setDirty] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, start] = React.useTransition();
  const tzs = React.useMemo(() => timezones(), []);
  const copy = nicheCopy(niche);

  const patch = <K extends keyof IdentityKit>(k: K, v: IdentityKit[K]) => {
    setKit((x) => ({ ...x, [k]: v }));
    setDirty(true);
  };
  const voiceOptions = voices.some((v) => v.voiceId === kit.voice.voiceId)
    ? voices
    : [{ voiceId: kit.voice.voiceId, name: kit.voice.name, provider: kit.voice.provider, tags: ["current"] }, ...voices];

  function save() {
    const parsed = IdentityKitSchema.safeParse(kit);
    if (!parsed.success) return void toast.error(parsed.error.issues[0]?.message ?? "Some kit fields are invalid.");
    start(async () => {
      const res = await updateChannel({ channelId: channel.id, name, handle: handle || null, niche, timezone, kit: parsed.data });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      setDirty(false);
      toast.success("Kit saved. New videos use it from now on.");
      router.refresh();
    });
  }

  return (
    <Stack gap={8}>
      <Section title="Channel">
        <Stack gap={4}>
          <FormField label="Name" layout="horizontal" required error={errors.name}>
            <Input value={name} onChange={(e) => (setName(e.target.value), setDirty(true))} maxLength={60} />
          </FormField>
          <FormField label="Handle" layout="horizontal" aside="Optional" hint="Shown on previews before an account is connected.">
            <Input value={handle} onChange={(e) => (setHandle(e.target.value.replace(/[^a-z0-9._]/gi, "").toLowerCase()), setDirty(true))} maxLength={40} leading={<span className="type-body">@</span>} />
          </FormField>
          <FormField label="Niche" layout="horizontal" hint="Changing it re-targets the radar from next scan.">
            <Select value={niche} onValueChange={(v) => (setNiche(v), setDirty(true))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUPS.map((g) => (
                  <SelectGroup key={g}>
                    <SelectLabel>{g}</SelectLabel>
                    {NICHES.filter((n) => n.group === g).map((n) => (
                      <SelectItem key={n.slug} value={n.slug}>
                        {n.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Time zone" layout="horizontal" hint="Schedules and series run on this clock.">
            <Select value={timezone} onValueChange={(v) => (setTimezone(v), setDirty(true))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tzs.map((z) => (
                  <SelectItem key={z} value={z}>
                    {z.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </Stack>
      </Section>
      <Separator />
      <Section title="Audience and promise">
        <Stack gap={4}>
          <FormField label="Audience" layout="horizontal" required>
            <Input value={kit.audience} onChange={(e) => patch("audience", e.target.value)} maxLength={160} placeholder={copy.audience} />
          </FormField>
          <FormField label="Promise" layout="horizontal" required>
            <Textarea value={kit.promise} onChange={(e) => patch("promise", e.target.value)} maxLength={240} rows={2} placeholder={copy.promise} />
          </FormField>
          <FormField label="Off-limits topics" layout="horizontal" hint="The writer never picks ideas about these.">
            <ChipInput value={kit.forbiddenTopics} onChange={(v) => patch("forbiddenTopics", v)} placeholder="politics" />
          </FormField>
          <FormField label="Default length" layout="horizontal" aside={<span className="tabular-nums">{kit.defaultDurationSec}s</span>}>
            <Slider min={20} max={90} step={5} value={[kit.defaultDurationSec]} onValueChange={([v]) => patch("defaultDurationSec", v)} aria-label="Default length" />
          </FormField>
          <FormField label="Made for" layout="horizontal">
            <div role="group" className="flex min-h-10 flex-wrap items-center gap-x-6 gap-y-2">
              {TARGETS.map((t) => (
                <span key={t.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`tgt-${t.id}`}
                    checked={kit.platformsTarget.includes(t.id)}
                    onCheckedChange={(v) => patch("platformsTarget", v === true ? [...kit.platformsTarget, t.id] : kit.platformsTarget.filter((x) => x !== t.id))}
                  />
                  <Label htmlFor={`tgt-${t.id}`}>{t.label}</Label>
                </span>
              ))}
            </div>
          </FormField>
        </Stack>
      </Section>
      <Separator />
      <Section title="Look">
        <SkinPicker value={kit.skin} onChange={(s) => patch("skin", s)} headline={copy.headline} stat={copy.stat} handle={`@${handle || "yourchannel"}`} />
      </Section>
      <Separator />
      <Section title="Voice">
        <VoicePicker voices={voiceOptions} value={kit.voice} onChange={(v) => patch("voice", v)} sampleText={`${copy.headline}. Here’s why.`} />
      </Section>
      <Separator />
      <Section title="Persona">
        <PersonaEditor value={kit.persona} onChange={(p) => patch("persona", p)} layout="horizontal" />
      </Section>
      <Separator />
      <Section title="Mascot">
        <MascotEditor value={kit.mascot} onChange={(m) => patch("mascot", m)} layout="horizontal" />
      </Section>

      <div className="glass sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t border-rule px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <span className="type-small text-muted">{dirty ? "Unsaved changes" : "All changes saved"}</span>
        <Button onClick={save} loading={pending} disabled={!dirty}>
          Save kit
        </Button>
      </div>
    </Stack>
  );
}
