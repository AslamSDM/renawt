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

export function Subtitle({ text, color = "rgba(255,255,255,0.75)", size = 36, weight = 500, font = "Inter, sans-serif", animation = "fade", delay = 8, x = "50%", y = "60%", maxWidth = "70%" }: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = Math.max(0, frame - delay);
  const a = applyAnim(animation, localFrame, fps);
  return (
    <AbsoluteFill>
      <div style={{
        position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) ${a.transform}`,
        color, fontSize: size, fontWeight: weight, fontFamily: font, textAlign: "center",
        opacity: a.opacity, filter: a.filter, maxWidth, lineHeight: 1.3,
      }}>{text}</div>
    </AbsoluteFill>
  );
}
