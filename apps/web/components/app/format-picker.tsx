"use client";

import * as React from "react";
import { Wand2 } from "lucide-react";
import { FORMATS } from "@remawt/shared";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Grid } from "@/components/layout/grid";
import { BeatBar } from "./beat-bar";

/** Six launch formats as radio cards with a proportional beat preview. "auto" lets the scriptwriter choose. */
export function FormatPicker({ value, onChange, seconds, allowAuto = true }: { value: string; onChange: (v: string) => void; seconds?: number; allowAuto?: boolean }) {
  return (
    <RadioGroup value={value} onValueChange={onChange} aria-label="Format">
      <Grid cols={3} gap={3}>
        {allowAuto && (
          <RadioCard value="auto">
            <span className="flex w-full items-center justify-between gap-2">
              <span className="type-subheading text-ink">Auto</span>
              <Wand2 className="size-4 text-subtle" aria-hidden />
            </span>
            <span className="type-small text-muted">The scriptwriter picks the format that fits your topic best.</span>
            <span className="mono-tick mt-auto">Default</span>
          </RadioCard>
        )}
        {FORMATS.map((f) => (
          <RadioCard key={f.id} value={f.id}>
            <span className="flex w-full items-center justify-between gap-2">
              <span className="type-subheading text-ink">{f.name}</span>
              {f.risk !== "low" && <Badge variant="warning">{f.risk} risk</Badge>}
            </span>
            <span className="type-small text-muted">{f.tagline}</span>
            <BeatBar beats={f.beats} showLabels={false} className="pt-2" />
            <span className="mono-tick tabular-nums">
              {f.beats.length} beats{seconds ? ` · ${seconds}s` : ""}
            </span>
          </RadioCard>
        ))}
      </Grid>
    </RadioGroup>
  );
}
