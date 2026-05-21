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

export function Box({ x = "0", y = "0", width = "100px", height = "100px", color = "#7c3aed", borderRadius = 0, opacity = 1, animation = "none", delay = 0 }: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = Math.max(0, frame - delay);
  const a = applyAnim(animation, localFrame, fps);
  return (
    <div style={{ position: "absolute", left: x, top: y, width, height, backgroundColor: color, borderRadius, opacity: a.opacity * opacity, transform: a.transform, filter: a.filter }} />
  );
}
