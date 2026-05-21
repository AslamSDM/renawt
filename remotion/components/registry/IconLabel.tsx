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

export function IconLabel({ icon = "✨", label, color = "#fff", iconSize = 72, labelSize = 24, x = "50%", y = "50%", delay = 0 }: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const a = applyAnim("scale", local, fps);
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) ${a.transform}`, textAlign: "center", color, fontFamily: "Inter, sans-serif", opacity: a.opacity }}>
      <div style={{ fontSize: iconSize, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: labelSize, fontWeight: 600 }}>{label}</div>
    </div>
  );
}
