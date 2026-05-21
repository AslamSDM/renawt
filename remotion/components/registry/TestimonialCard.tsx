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

export function TestimonialCard({ quote, author, role, avatarUrl, accentColor = "#a78bfa", delay = 0, width = 820 }: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const a = applyAnim("scale", local, fps);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ width, padding: 48, borderRadius: 24, background: "rgba(255,255,255,0.06)", border: `1px solid ${accentColor}40`, backdropFilter: "blur(20px)", color: "#fff", fontFamily: "Inter, sans-serif", opacity: a.opacity, transform: a.transform }}>
        <div style={{ fontSize: 32, lineHeight: 1.4, marginBottom: 32 }}>"{quote}"</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {avatarUrl && <img src={avatarUrl} style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover" }} />}
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{author}</div>
            {role && <div style={{ fontSize: 18, color: "rgba(255,255,255,0.6)" }}>{role}</div>}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
