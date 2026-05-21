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

export function Quote({ text, attribution, color = "#fff", size = 56, font = "Georgia, serif", delay = 0 }: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const a = applyAnim("fade", local, fps);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", padding: "0 10%" }}>
      <div style={{ color, fontSize: size, fontFamily: font, fontStyle: "italic", textAlign: "center", lineHeight: 1.3, opacity: a.opacity, transform: a.transform }}>
        <span style={{ fontSize: size * 1.5, opacity: 0.4 }}>“</span>{text}<span style={{ fontSize: size * 1.5, opacity: 0.4 }}>”</span>
      </div>
      {attribution && <div style={{ marginTop: 32, color: "rgba(255,255,255,0.6)", fontSize: 28, fontFamily: "Inter, sans-serif", opacity: a.opacity }}>— {attribution}</div>}
    </AbsoluteFill>
  );
}
