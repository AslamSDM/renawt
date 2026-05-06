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

export function WordStagger({ text, color = "#fff", size = 80, weight = 700, font = "Inter, sans-serif", stagger = 6, delay = 0, x = "50%", y = "50%" }: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", maxWidth: "85%" }}>
        {words.map((w, i) => {
          const local = Math.max(0, frame - delay - i * stagger);
          const a = applyAnim("slide-up", local, fps);
          return <span key={i} style={{ color, fontSize: size, fontWeight: weight, fontFamily: font, opacity: a.opacity, transform: a.transform, lineHeight: 1.1 }}>{w}</span>;
        })}
      </div>
    </AbsoluteFill>
  );
}
