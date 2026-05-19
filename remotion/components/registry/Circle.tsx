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

export function Circle({ x = "50%", y = "50%", size = 200, color = "#7c3aed", opacity = 1, pulse = false, animation = "none", delay = 0 }: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const a = applyAnim(animation, local, fps);
  const pulseScale = pulse ? 1 + 0.06 * Math.sin((local / fps) * Math.PI * 2) : 1;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${pulseScale}) ${a.transform}`, width: size, height: size, borderRadius: "50%", backgroundColor: color, opacity: a.opacity * opacity, filter: a.filter }} />
  );
}
