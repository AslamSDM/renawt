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

export function AnimatedGradient({ colors = ["#0f172a", "#7c3aed", "#06b6d4"], speed = 0.5 }: any) {
  const frame = useCurrentFrame();
  const angle = (frame * speed) % 360;
  return <AbsoluteFill style={{ background: `linear-gradient(${angle}deg, ${colors.join(", ")})` }} />;
}
