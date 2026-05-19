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

export function Spotlight({ color = "rgba(0,0,0,0.85)", x = "50%", y = "50%", radius = "40%" }: any) {
  return <AbsoluteFill style={{ background: `radial-gradient(circle at ${x} ${y}, transparent 0, transparent ${radius}, ${color} 100%)` }} />;
}
