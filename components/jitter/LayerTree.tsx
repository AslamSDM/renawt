"use client";

import React from "react";
import { ChevronRight, Type, Image as ImageIcon, Square, Box, Component } from "lucide-react";
import type { JitterDoc, LayerPath, AnyLayerLite } from "./types";

interface Props {
  doc: JitterDoc;
  selected: LayerPath | null;
  onSelect: (path: LayerPath) => void;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  text: Type,
  image: ImageIcon,
  rect: Square,
  layerGrp: Box,
  custom: Component,
};

function pathEq(a: LayerPath | null, b: LayerPath): boolean {
  if (!a) return false;
  if (a.artboardIndex !== b.artboardIndex) return false;
  if (a.layerIndices.length !== b.layerIndices.length) return false;
  return a.layerIndices.every((v, i) => v === b.layerIndices[i]);
}

function LayerRow({
  layer,
  path,
  selected,
  onSelect,
  depth,
}: {
  layer: AnyLayerLite;
  path: LayerPath;
  selected: LayerPath | null;
  onSelect: (p: LayerPath) => void;
  depth: number;
}) {
  const [open, setOpen] = React.useState(true);
  const Icon = ICONS[layer.type] ?? Square;
  const isSelected = pathEq(selected, path);
  const isGroup = layer.type === "layerGrp" && Array.isArray(layer.layers);
  const label =
    layer.name ||
    (layer.type === "text" ? layer.text?.slice(0, 24) : layer.id) ||
    layer.type;

  return (
    <div>
      <div
        onClick={() => onSelect(path)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-xs ${
          isSelected ? "bg-ink/15 text-ink" : "hover:bg-paper-2 text-ink/80"
        }`}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        {isGroup ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            className="flex items-center"
          >
            <ChevronRight
              className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`}
            />
          </button>
        ) : (
          <span className="w-3" />
        )}
        <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" />
        <span className="truncate">{label}</span>
      </div>
      {isGroup && open
        ? layer.layers!.map((child, i) => (
            <LayerRow
              key={child.id ?? i}
              layer={child as AnyLayerLite}
              path={{
                artboardIndex: path.artboardIndex,
                layerIndices: [...path.layerIndices, i],
              }}
              selected={selected}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))
        : null}
    </div>
  );
}

export function LayerTree({ doc, selected, onSelect }: Props) {
  return (
    <div className="space-y-3">
      {doc.conf.artboards.map((art, ai) => (
        <div key={art.id ?? ai}>
          <div className="text-[10px] uppercase tracking-wider text-muted px-2 mb-1">
            {art.name || `Artboard ${ai + 1}`} · {((art.duration ?? 0) / 1000).toFixed(1)}s
          </div>
          {(art.layers as AnyLayerLite[]).map((layer, i) => (
            <LayerRow
              key={layer.id ?? i}
              layer={layer}
              path={{ artboardIndex: ai, layerIndices: [i] }}
              selected={selected}
              onSelect={onSelect}
              depth={0}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
