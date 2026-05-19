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

export function FeatureCard({ title, description, icon = "✨", accentColor = "#a78bfa", x = "50%", y = "50%", width = 640, delay = 0 }: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = Math.max(0, frame - delay);
  const a = applyAnim("scale", localFrame, fps);
  return (
    <AbsoluteFill>
      <div style={{
        position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) ${a.transform}`,
        width, padding: 36, borderRadius: 24,
        background: "rgba(255,255,255,0.06)", border: `1px solid ${accentColor}40`,
        backdropFilter: "blur(20px)", color: "#fff", fontFamily: "Inter, sans-serif",
        opacity: a.opacity,
      }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>{icon}</div>
        <div style={{ fontSize: 40, fontWeight: 700, marginBottom: 12 }}>{title}</div>
        <div style={{ fontSize: 24, color: "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>{description}</div>
      </div>
    </AbsoluteFill>
  );
}
