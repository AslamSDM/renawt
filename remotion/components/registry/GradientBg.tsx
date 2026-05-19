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

export function GradientBg({ from = "#0f172a", to = "#1e293b", angle = 135 }: any) {
  return <AbsoluteFill style={{ background: `linear-gradient(${angle}deg, ${from}, ${to})` }} />;
}
