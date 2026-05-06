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

export function NotificationToast({ title, message, icon = "🔔", x = "70%", y = "15%", width = 440, delay = 0 }: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const a = applyAnim("slide-down", local, fps);
  return (
    <div style={{ position: "absolute", left: x, top: y, width, padding: 20, borderRadius: 18, backgroundColor: "rgba(40,40,50,0.85)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontFamily: "Inter, sans-serif", display: "flex", gap: 16, alignItems: "flex-start", opacity: a.opacity, transform: a.transform, boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}>
      <div style={{ fontSize: 36 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", lineHeight: 1.3 }}>{message}</div>
      </div>
    </div>
  );
}
