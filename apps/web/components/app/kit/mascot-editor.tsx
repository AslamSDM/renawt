"use client";

import * as React from "react";
import type { Mascot } from "@remawt/shared";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Stack } from "@/components/layout";

export function MascotEditor({ value, onChange, layout = "vertical" }: { value: Mascot; onChange: (m: Mascot) => void; layout?: "vertical" | "horizontal" }) {
  return (
    <Stack gap={6}>
      <div className="flex items-start gap-3">
        <Switch id="mascot-on" checked={value.enabled} onCheckedChange={(enabled) => onChange({ ...value, enabled })} />
        <Stack gap={1}>
          <Label htmlFor="mascot-on">Use a mascot</Label>
          <p className="type-small max-w-[56ch] text-muted">
            A recurring vector character drawn once with a fixed style, then reused in reactions and transitions. Channels without one work fine.
          </p>
        </Stack>
      </div>
      {value.enabled && (
        <Stack gap={4}>
          <FormField label="Mascot name" layout={layout} aside="Optional">
            <Input value={value.name ?? ""} onChange={(e) => onChange({ ...value, name: e.target.value || undefined })} maxLength={40} placeholder="Ollie" />
          </FormField>
          <FormField label="Description" layout={layout} required hint="Shape, colour and one distinctive detail. Keep it simple enough to draw the same way every time.">
            <Textarea
              value={value.description ?? ""}
              onChange={(e) => onChange({ ...value, description: e.target.value || undefined })}
              maxLength={300}
              rows={3}
              placeholder="A round blue owl with a monocle and a tiny notebook"
            />
          </FormField>
        </Stack>
      )}
    </Stack>
  );
}
