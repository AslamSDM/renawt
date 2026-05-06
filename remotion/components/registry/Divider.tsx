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

export function Divider({ x = "50%", y = "50%", width = 400, thickness = 2, color = "#fff", animateIn = true, durationFrames = 20, delay = 0 }: any) {
  const frame = useCurrentFrame();
  const local = Math.max(0, frame - delay);
  const t = animateIn ? Math.min(1, local / durationFrames) : 1;
  const eased = 1 - Math.pow(1 - t, 3);
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", width, height: thickness, backgroundColor: color, transformOrigin: "left center", scale: `${eased} 1` }} />
  );
}
