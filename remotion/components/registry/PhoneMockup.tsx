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

export function PhoneMockup({ src, kind = "image", x = "50%", y = "50%", height = 900, delay = 0 }: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const a = applyAnim("slide-up", local, fps);
  const w = height * 0.5;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) ${a.transform}`, width: w, height, backgroundColor: "#000", borderRadius: 60, padding: 16, boxShadow: "0 30px 80px rgba(0,0,0,0.6)", border: "2px solid #2a2a2a", opacity: a.opacity }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 44, overflow: "hidden", position: "relative", backgroundColor: "#111" }}>
          <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", width: 100, height: 28, backgroundColor: "#000", borderRadius: 999, zIndex: 2 }} />
          {kind === "video" ? <Video src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        </div>
      </div>
    </AbsoluteFill>
  );
}
