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

export function BrowserMockup({ src, kind = "image", url = "yoursite.com", x = "50%", y = "50%", width = 1500, delay = 0 }: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const a = applyAnim("scale", local, fps);
  const h = width * 0.6;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) ${a.transform}`, width, height: h + 44, borderRadius: 12, overflow: "hidden", backgroundColor: "#1f2937", boxShadow: "0 30px 80px rgba(0,0,0,0.5)", opacity: a.opacity }}>
        <div style={{ height: 44, display: "flex", alignItems: "center", padding: "0 16px", gap: 8 }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: ["#ef4444","#f59e0b","#10b981"][i] }} />)}
          <div style={{ marginLeft: 16, padding: "6px 16px", borderRadius: 8, backgroundColor: "#111827", color: "#9ca3af", fontSize: 14, fontFamily: "ui-monospace, monospace" }}>{url}</div>
        </div>
        <div style={{ width: "100%", height: h, backgroundColor: "#000" }}>
          {kind === "video" ? <Video src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        </div>
      </div>
    </AbsoluteFill>
  );
}
