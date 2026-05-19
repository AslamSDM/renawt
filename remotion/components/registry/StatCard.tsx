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

export function StatCard({ value, label, delta, deltaPositive = true, accentColor = "#10b981", delay = 0, x = "50%", y = "50%" }: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const a = applyAnim("slide-up", local, fps);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) ${a.transform}`, textAlign: "center", color: "#fff", fontFamily: "Inter, sans-serif", opacity: a.opacity }}>
        <div style={{ fontSize: 200, fontWeight: 900, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 32, color: "rgba(255,255,255,0.7)", marginTop: 16 }}>{label}</div>
        {delta && <div style={{ display: "inline-block", marginTop: 24, padding: "8px 20px", borderRadius: 999, backgroundColor: `${deltaPositive ? accentColor : "#ef4444"}30`, color: deltaPositive ? accentColor : "#ef4444", fontSize: 22, fontWeight: 700 }}>{delta}</div>}
      </div>
    </AbsoluteFill>
  );
}
