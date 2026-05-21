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

export function ProgressBar({ target = 1, durationFrames = 60, color = "#7c3aed", bgColor = "rgba(255,255,255,0.1)", label, x = "50%", y = "50%", width = 800, height = 20, delay = 0 }: any) {
  const frame = useCurrentFrame();
  const local = Math.max(0, frame - delay);
  const t = Math.min(1, local / durationFrames);
  const eased = 1 - Math.pow(1 - t, 3);
  const fill = eased * target;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", width, color: "#fff", fontFamily: "Inter, sans-serif" }}>
        {label && <div style={{ fontSize: 24, marginBottom: 12, display: "flex", justifyContent: "space-between" }}><span>{label}</span><span>{Math.round(fill * 100)}%</span></div>}
        <div style={{ width: "100%", height, backgroundColor: bgColor, borderRadius: height / 2, overflow: "hidden" }}>
          <div style={{ width: `${fill * 100}%`, height: "100%", backgroundColor: color, borderRadius: height / 2 }} />
        </div>
      </div>
    </AbsoluteFill>
  );
}
