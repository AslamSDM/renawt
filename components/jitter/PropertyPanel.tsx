"use client";

import React from "react";
import type { AnyLayerLite } from "./types";

interface Props {
  layer: AnyLayerLite | null;
  onPatch: (patch: Partial<AnyLayerLite>) => void;
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted shrink-0 w-20">{label}</span>
      <input
        type="number"
        value={value ?? 0}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 min-w-0 px-2 py-1 bg-paper-2 border border-rule rounded text-ink"
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted">{label}</span>
      {multiline ? (
        <textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full px-2 py-1 bg-paper-2 border border-rule rounded text-ink resize-none"
        />
      ) : (
        <input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2 py-1 bg-paper-2 border border-rule rounded text-ink"
        />
      )}
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted shrink-0 w-20">{label}</span>
      <div className="flex items-center gap-2 flex-1">
        <input
          type="color"
          value={value ?? "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-7 bg-transparent border border-rule rounded cursor-pointer"
        />
        <input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 px-2 py-1 bg-paper-2 border border-rule rounded text-ink font-mono"
        />
      </div>
    </label>
  );
}

export function PropertyPanel({ layer, onPatch }: Props) {
  if (!layer) {
    return (
      <div className="text-xs text-muted px-2 py-6 text-center">
        Select a layer to edit its properties.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-[10px] uppercase tracking-wider text-muted px-1">
        {layer.type} · {layer.id}
      </div>

      <TextField
        label="Name"
        value={layer.name}
        onChange={(v) => onPatch({ name: v })}
      />

      {layer.type === "text" ? (
        <>
          <TextField
            label="Text"
            value={layer.text}
            multiline
            onChange={(v) => onPatch({ text: v })}
          />
          <ColorField
            label="Color"
            value={layer.color}
            onChange={(v) => onPatch({ color: v })}
          />
          <NumberField
            label="Font size"
            value={layer.fontSize}
            onChange={(v) => onPatch({ fontSize: v })}
          />
        </>
      ) : null}

      {layer.type === "image" ? (
        <TextField
          label="URL"
          value={layer.url}
          onChange={(v) => onPatch({ url: v })}
        />
      ) : null}

      {layer.type === "rect" || layer.type === "layerGrp" ? (
        <ColorField
          label="Fill"
          value={layer.fillColor}
          onChange={(v) => onPatch({ fillColor: v })}
        />
      ) : null}

      {layer.type === "custom" ? (
        <TextField
          label="props (JSON)"
          value={JSON.stringify(layer.props ?? {}, null, 2)}
          multiline
          onChange={(v) => {
            try {
              onPatch({ props: JSON.parse(v) });
            } catch {
              // ignore invalid JSON until user finishes typing
            }
          }}
        />
      ) : null}

      <div className="pt-3 border-t border-rule space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="X" value={layer.x} onChange={(v) => onPatch({ x: v })} />
          <NumberField label="Y" value={layer.y} onChange={(v) => onPatch({ y: v })} />
          <NumberField label="W" value={layer.width} onChange={(v) => onPatch({ width: v })} />
          <NumberField label="H" value={layer.height} onChange={(v) => onPatch({ height: v })} />
        </div>
        <NumberField
          label="Opacity"
          value={layer.opacity}
          onChange={(v) => onPatch({ opacity: v })}
        />
        <NumberField
          label="Rotation"
          value={layer.angle}
          onChange={(v) => onPatch({ angle: v })}
        />
        <NumberField
          label="Scale"
          value={layer.scale}
          step={0.01}
          onChange={(v) => onPatch({ scale: v })}
        />
        <NumberField
          label="Radius"
          value={layer.cornerRadius}
          onChange={(v) => onPatch({ cornerRadius: v })}
        />
      </div>
    </div>
  );
}
