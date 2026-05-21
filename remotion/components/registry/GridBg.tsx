// AUTO-GENERATED — do not edit by hand. See scripts/generate-registry.mjs.
import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Audio,
  Video,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  staticFile,
} from "remotion";
import { applyAnim } from "./_helpers";

export function GridBg({ bgColor = "#0a0a0f", lineColor = "rgba(255,255,255,0.08)", cellSize = 80 }: any) {
  return <AbsoluteFill style={{ backgroundColor: bgColor, backgroundImage: `linear-gradient(${lineColor} 1px, transparent 1px), linear-gradient(90deg, ${lineColor} 1px, transparent 1px)`, backgroundSize: `${cellSize}px ${cellSize}px` }} />;
}
