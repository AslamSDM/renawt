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

export function GradientText({ text, from = "#a78bfa", to = "#06b6d4", angle = 135, size = 120, weight = 900, font = "Inter, sans-serif", animation = "slide-up", delay = 0, x = "50%", y = "50%" }: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const a = applyAnim(animation, local, fps);
  return (
    <AbsoluteFill>
      <div style={{
        position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) ${a.transform}`,
        fontSize: size, fontWeight: weight, fontFamily: font, lineHeight: 1.05,
        backgroundImage: `linear-gradient(${angle}deg, ${from}, ${to})`,
        WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
        opacity: a.opacity, filter: a.filter, textAlign: "center",
      }}>{text}</div>
    </AbsoluteFill>
  );
}
