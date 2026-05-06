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

export function CodeBlock({ code, language = "ts", x = "50%", y = "50%", width = 1100, fontSize = 28, delay = 0 }: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const a = applyAnim("scale", local, fps);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) ${a.transform}`, width, borderRadius: 16, overflow: "hidden", backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", opacity: a.opacity }}>
        <div style={{ padding: "10px 16px", backgroundColor: "#161b22", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#7d8590", fontSize: 14, fontFamily: "ui-monospace, monospace" }}>{language}</div>
        <pre style={{ margin: 0, padding: 24, color: "#e6edf3", fontSize, fontFamily: "ui-monospace, monospace", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{code}</pre>
      </div>
    </AbsoluteFill>
  );
}
