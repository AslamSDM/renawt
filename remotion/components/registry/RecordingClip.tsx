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

export function RecordingClip({ src, trimStart = 0, mockup = "none", x = "50%", y = "50%", width = 1600, height = 900 }: any) {
  const padding = mockup === "browser" ? 40 : mockup === "macbook" ? 30 : 0;
  const chrome = mockup === "browser"
    ? <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 36, background: "#1f2937", borderRadius: "16px 16px 0 0", display: "flex", alignItems: "center", padding: "0 16px", gap: 8 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: ["#ef4444","#f59e0b","#10b981"][i] }} />)}
      </div>
    : null;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", width, height, borderRadius: 16, overflow: "hidden", backgroundColor: "#000", boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}>
        {chrome}
        <div style={{ position: "absolute", inset: padding, top: mockup === "browser" ? 36 + padding : padding, overflow: "hidden", borderRadius: 8 }}>
          <Video src={src} startFrom={trimStart} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      </div>
    </AbsoluteFill>
  );
}
