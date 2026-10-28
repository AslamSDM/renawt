"use client";

import * as React from "react";
import type { Persona } from "@remawt/shared";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Grid, Stack } from "@/components/layout";
import { ChipInput } from "../chip-input";

const TONES: { key: keyof Persona["tone"]; label: string; low: string; high: string }[] = [
  { key: "formal", label: "Formality", low: "Casual", high: "Formal" },
  { key: "energy", label: "Energy", low: "Calm", high: "Hyped" },
  { key: "humor", label: "Humor", low: "Straight", high: "Playful" },
  { key: "density", label: "Fact density", low: "Breathing room", high: "Rapid fire" },
];

/** Tone sliders, POV and phrase lists. Used in onboarding and channel settings. */
export function PersonaEditor({ value, onChange, layout = "vertical" }: { value: Persona; onChange: (p: Persona) => void; layout?: "vertical" | "horizontal" }) {
  const set = <K extends keyof Persona>(k: K, v: Persona[K]) => onChange({ ...value, [k]: v });
  return (
    <Stack gap={7}>
      <Grid cols={2} gap={6}>
        {TONES.map((t) => (
          <Stack key={t.key} gap={2}>
            <FormField label={t.label} aside={<span className="tabular-nums">{Math.round(value.tone[t.key] * 100)}</span>}>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[value.tone[t.key]]}
                onValueChange={([n]) => onChange({ ...value, tone: { ...value.tone, [t.key]: n } })}
                aria-label={t.label}
              />
            </FormField>
            <div className="flex justify-between">
              <span className="mono-tick">{t.low}</span>
              <span className="mono-tick">{t.high}</span>
            </div>
          </Stack>
        ))}
      </Grid>
      <Stack gap={4}>
        <FormField label="Point of view" layout={layout} hint="“You’ve been lied to about…” is second person.">
          <Tabs value={value.pov} onValueChange={(v) => set("pov", v as Persona["pov"])}>
            <TabsList variant="segmented" aria-label="Point of view" className="self-start">
              <TabsTrigger value="first">I / we</TabsTrigger>
              <TabsTrigger value="second">You</TabsTrigger>
              <TabsTrigger value="third">They</TabsTrigger>
            </TabsList>
          </Tabs>
        </FormField>
        <FormField label="Narrator name" layout={layout} aside="Optional" hint="A recurring on-screen name, like “The Ledger”.">
          <Input value={value.name ?? ""} onChange={(e) => set("name", e.target.value || undefined)} maxLength={40} placeholder="The Ledger" />
        </FormField>
        <FormField label="Signature phrases" layout={layout} aside={`${value.signaturePhrases.length}/5`} hint="Press Enter after each. Used sparingly, never every video.">
          <ChipInput value={value.signaturePhrases} onChange={(v) => set("signaturePhrases", v)} max={5} placeholder="Here’s the twist…" />
        </FormField>
        <FormField label="Never say" layout={layout} hint="Words, claims or topics the writer must avoid.">
          <ChipInput value={value.avoid} onChange={(v) => set("avoid", v)} placeholder="guaranteed returns" />
        </FormField>
      </Stack>
    </Stack>
  );
}
