"use client";

import React, { useEffect, useRef, useState } from "react";
import type { PlayerRef } from "@remotion/player";
import { Type, Image as ImageIcon, Square, Box, Component } from "lucide-react";
import type { JitterDoc, LayerPath, AnyLayerLite } from "./types";

interface Props {
  doc: JitterDoc;
  fps: number;
  durationInFrames: number;
  playerRef: React.RefObject<PlayerRef | null>;
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

function fmt(frame: number, fps: number): string {
  const s = frame / fps;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function Timeline({
  doc,
  fps,
  durationInFrames,
  playerRef,
  selected,
  onSelect,
}: Props) {
  const [frame, setFrame] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  // Sync playhead with the Remotion Player.
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    player.addEventListener("frameupdate", onFrame);
    return () => player.removeEventListener("frameupdate", onFrame);
  }, [playerRef]);

  const framesPerMs = fps / 1000;

  // Precompute artboard start/length in frames.
  let acc = 0;
  const segments = doc.conf.artboards.map((art, ai) => {
    const startFrame = acc;
    const lenFrames = Math.max(1, Math.round((art.duration ?? 0) * framesPerMs));
    acc += lenFrames;
    return { art, ai, startFrame, lenFrames };
  });

  const seekToClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const f = Math.round(pct * durationInFrames);
    playerRef.current?.seekTo(f);
    setFrame(f);
  };

  const pct = (f: number) => `${(f / durationInFrames) * 100}%`;

  return (
    <div className="flex flex-col h-full text-xs">
      {/* Ruler + playhead */}
      <div
        ref={trackRef}
        className="relative h-7 border-b border-rule cursor-pointer select-none shrink-0"
        onMouseDown={(e) => {
          seekToClientX(e.clientX);
          const move = (ev: MouseEvent) => seekToClientX(ev.clientX);
          const up = () => {
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", up);
          };
          window.addEventListener("mousemove", move);
          window.addEventListener("mouseup", up);
        }}
      >
        {segments.map(({ ai, startFrame }) => (
          <div
            key={ai}
            className="absolute top-0 bottom-0 border-l border-rule/60 pl-1 text-[10px] text-muted"
            style={{ left: pct(startFrame) }}
          >
            {fmt(startFrame, fps)}
          </div>
        ))}
        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-px bg-red-500 z-10 pointer-events-none"
          style={{ left: pct(frame) }}
        >
          <div className="absolute -top-px -left-1 w-2 h-2 rotate-45 bg-red-500" />
        </div>
      </div>

      {/* Tracks */}
      <div className="relative flex-1 overflow-y-auto">
        {/* Playhead overlay across tracks */}
        <div
          className="absolute top-0 bottom-0 w-px bg-red-500/70 z-10 pointer-events-none"
          style={{ left: pct(frame) }}
        />
        {segments.map(({ art, ai, startFrame, lenFrames }) => (
          <div key={art.id ?? ai} className="relative">
            <div className="sticky left-0 px-2 py-1 text-[10px] uppercase tracking-wider text-muted bg-paper/60">
              {art.name || `Artboard ${ai + 1}`} · {((art.duration ?? 0) / 1000).toFixed(1)}s
            </div>
            {(art.layers as AnyLayerLite[]).map((layer, i) => {
              const path: LayerPath = { artboardIndex: ai, layerIndices: [i] };
              const isSel = pathEq(selected, path);
              const Icon = ICONS[layer.type] ?? Square;
              const label =
                layer.name ||
                (layer.type === "text" ? layer.text?.slice(0, 24) : layer.id) ||
                layer.type;
              return (
                <div key={layer.id ?? i} className="relative h-6 border-b border-rule/40">
                  <button
                    onClick={() => onSelect(path)}
                    className={`absolute top-0.5 bottom-0.5 flex items-center gap-1.5 px-2 rounded text-[11px] truncate transition-colors ${
                      isSel
                        ? "bg-ink/20 text-ink ring-1 ring-ink/40"
                        : "bg-paper-2 text-ink/70 hover:bg-paper-3"
                    }`}
                    style={{
                      left: pct(startFrame),
                      width: `calc(${pct(lenFrames)} - 2px)`,
                    }}
                    title={label}
                  >
                    <Icon className="w-3 h-3 shrink-0 opacity-70" />
                    <span className="truncate">{label}</span>
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
