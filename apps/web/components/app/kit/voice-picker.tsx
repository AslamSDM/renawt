"use client";

import * as React from "react";
import { RadioGroup as RG } from "radix-ui";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { FormField } from "@/components/ui/form-field";
import { Grid, Stack } from "@/components/layout";
import { toast } from "@/components/ui/toast";
import { voiceSample } from "@/lib/actions/kit";
import type { Voice } from "@remawt/shared";
import type { VoiceOption } from "./defaults";

/** Voice list with play-sample buttons. Samples come from the engine; falls back to the provider preview URL. */
export function VoicePicker({ voices, value, onChange, sampleText }: { voices: VoiceOption[]; value: Voice; onChange: (v: Voice) => void; sampleText: string }) {
  const audio = React.useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState<string | null>(null);
  const cache = React.useRef(new Map<string, string>());

  React.useEffect(() => () => audio.current?.pause(), []);

  async function play(v: VoiceOption) {
    if (playing === v.voiceId) {
      audio.current?.pause();
      setPlaying(null);
      return;
    }
    audio.current?.pause();
    let url = cache.current.get(v.voiceId) ?? null;
    if (!url) {
      setLoading(v.voiceId);
      const res = await voiceSample({ voiceId: v.voiceId, provider: v.provider, text: sampleText });
      setLoading(null);
      url = res.ok ? res.data.audioUrl : (v.previewUrl ?? null);
      if (!url) {
        toast.error(res.ok ? "No sample for this voice." : `Couldn’t play a sample. ${res.error}`);
        return;
      }
      cache.current.set(v.voiceId, url);
    }
    const a = new Audio(url);
    audio.current = a;
    a.onended = () => setPlaying(null);
    a.play().then(
      () => setPlaying(v.voiceId),
      () => toast.error("Your browser blocked audio playback."),
    );
  }

  return (
    <Stack gap={7}>
      <RG.Root
        value={value.voiceId}
        onValueChange={(id) => {
          const v = voices.find((x) => x.voiceId === id);
          if (v) onChange({ ...value, voiceId: v.voiceId, name: v.name, provider: v.provider, isClone: false });
        }}
        aria-label="Narrator voice"
      >
        <Grid cols={2} gap={2}>
          {voices.map((v) => (
            <div
              key={v.voiceId}
              className={cn(
                "flex min-h-14 items-center gap-3 rounded-[2px] border border-rule bg-paper pl-2 pr-4 transition-[border-color,background-color] duration-200",
                value.voiceId === v.voiceId ? "border-accent bg-accent-soft" : "hover:border-rule-strong hover:bg-paper-2",
              )}
            >
              <IconButton
                aria-label={playing === v.voiceId ? `Pause ${v.name}` : `Play ${v.name} sample`}
                variant="outline"
                size="sm"
                loading={loading === v.voiceId}
                onClick={() => play(v)}
              >
                {loading === v.voiceId ? null : playing === v.voiceId ? <Pause /> : <Play />}
              </IconButton>
              <RG.Item value={v.voiceId} className="flex min-w-0 flex-1 items-center justify-between gap-3 self-stretch text-left outline-offset-0">
                <span className="flex min-w-0 flex-col">
                  <span className="type-small font-medium text-ink">{v.name}</span>
                  {v.tags && v.tags.length > 0 && <span className="type-caption truncate text-muted">{v.tags.slice(0, 3).join(" · ")}</span>}
                </span>
                {value.voiceId === v.voiceId && <Badge variant="accent">Selected</Badge>}
              </RG.Item>
            </div>
          ))}
        </Grid>
      </RG.Root>
      <Grid cols={2}>
        <FormField label="Speed" aside={<span className="tabular-nums">{value.speed.toFixed(2)}×</span>}>
          <Slider min={0.8} max={1.2} step={0.05} value={[value.speed]} onValueChange={([s]) => onChange({ ...value, speed: s })} aria-label="Speed" />
        </FormField>
        <FormField label="Stability" aside={<span className="tabular-nums">{Math.round(value.stability * 100)}%</span>} hint="Lower sounds more expressive, higher more even.">
          <Slider min={0} max={1} step={0.05} value={[value.stability]} onValueChange={([s]) => onChange({ ...value, stability: s })} aria-label="Stability" />
        </FormField>
      </Grid>
    </Stack>
  );
}
