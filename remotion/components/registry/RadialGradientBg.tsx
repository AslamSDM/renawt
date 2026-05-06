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

export function RadialGradientBg({ from = "#7c3aed", to = "#000", x = "50%", y = "50%" }: any) {
  return <AbsoluteFill style={{ background: `radial-gradient(circle at ${x} ${y}, ${from}, ${to})` }} />;
}
