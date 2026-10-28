"use client";

import * as React from "react";
import { RadioGroup as RG } from "radix-ui";
import { Check } from "lucide-react";
import { SKIN_PRESETS, type VisualSkin } from "@remawt/shared";
import { Grid, Inline, Stack } from "@/components/layout";
import { Separator } from "@/components/ui/separator";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SkinPreview } from "../skin-preview";
import { DISPLAY_FONTS } from "./defaults";

const HEX = /^#[0-9a-f]{6}$/i;

/** Six preset skins as 9:16 cards, plus accent / display font / caption tweaks on the chosen one. */
export function SkinPicker({
  value,
  onChange,
  headline,
  stat,
  handle,
  posters,
}: {
  value: VisualSkin;
  onChange: (skin: VisualSkin) => void;
  headline: string;
  stat?: string;
  handle: string;
  posters?: Record<string, string>;
}) {
  // Typed text while it isn't a valid hex yet; null = show the kit value.
  const [draft, setDraft] = React.useState<string | null>(null);
  const accentDraft = draft ?? value.palette.accent;

  function pick(id: string) {
    const preset = SKIN_PRESETS.find((s) => s.id === id);
    if (preset) {
      setDraft(null);
      onChange(structuredClone(preset));
    }
  }

  return (
    <Stack gap={7}>
      <RG.Root value={value.id === "custom" ? "" : value.id} onValueChange={pick} aria-label="Visual skin">
        <Grid cols={6} gap={3}>
          {SKIN_PRESETS.map((s) => {
            const shown = value.id === s.id ? value : s;
            return (
              <RG.Item key={s.id} value={s.id} className="group flex min-w-0 flex-col gap-2 text-left">
                <div className="relative rounded-[12px] ring-0 ring-accent ring-offset-2 ring-offset-surface transition-shadow duration-200 group-data-[state=checked]:ring-2">
                  <SkinPreview skin={shown} headline={headline} stat={stat} handle={handle} posterUrl={posters?.[s.id]} className="w-full" />
                  <span className="absolute right-2 top-2 hidden size-5 place-items-center rounded-full bg-accent text-ink-inverse group-data-[state=checked]:grid">
                    <Check className="size-3" aria-hidden />
                  </span>
                </div>
                <span className="flex items-baseline justify-between gap-2">
                  <span className="type-small font-medium text-ink">{s.name}</span>
                  <span className="mono-tick">{s.motion}</span>
                </span>
              </RG.Item>
            );
          })}
        </Grid>
      </RG.Root>

      <Separator />
      <Grid cols={3}>
        <FormField label="Accent" hint="Used for highlights, bars and the caption pop.">
          <Input
            value={accentDraft}
            onChange={(e) => {
              if (HEX.test(e.target.value)) {
                setDraft(null);
                onChange({ ...value, palette: { ...value.palette, accent: e.target.value } });
              } else setDraft(e.target.value);
            }}
            maxLength={7}
            spellCheck={false}
            leading={<span className="size-4 rounded-[2px] border border-rule-strong" style={{ background: HEX.test(accentDraft) ? accentDraft : value.palette.accent }} />}
            trailing={
              <input
                type="color"
                aria-label="Pick accent colour"
                value={value.palette.accent}
                onChange={(e) => {
                  setDraft(null);
                  onChange({ ...value, palette: { ...value.palette, accent: e.target.value } });
                }}
                className="size-6 cursor-pointer appearance-none rounded-[2px] border-0 bg-transparent p-0"
              />
            }
          />
        </FormField>
        <FormField label="Headline font">
          <Select value={value.type.display} onValueChange={(f) => onChange({ ...value, type: { ...value.type, display: f } })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DISPLAY_FONTS.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Captions">
          <Select
            value={value.captionStyle}
            onValueChange={(c) => onChange({ ...value, captionStyle: c as VisualSkin["captionStyle"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bottom">Bottom</SelectItem>
              <SelectItem value="centered">Centered</SelectItem>
              <SelectItem value="karaoke">Karaoke (word pop)</SelectItem>
              <SelectItem value="minimal">Minimal</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </Grid>
      <Inline gap={6}>
        <span className="flex items-center gap-3">
          <Switch id="skin-intro" checked={value.intro.enabled} onCheckedChange={(v) => onChange({ ...value, intro: { ...value.intro, enabled: v } })} />
          <Label htmlFor="skin-intro">Intro sting</Label>
        </span>
        <span className="flex items-center gap-3">
          <Switch id="skin-outro" checked={value.outro.enabled} onCheckedChange={(v) => onChange({ ...value, outro: { ...value.outro, enabled: v } })} />
          <Label htmlFor="skin-outro">Outro card</Label>
        </span>
        <span className="flex items-center gap-3">
          <Switch id="skin-grain" checked={value.grain} onCheckedChange={(v) => onChange({ ...value, grain: v })} />
          <Label htmlFor="skin-grain">Film grain</Label>
        </span>
      </Inline>
    </Stack>
  );
}
