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

export function NumberCounter({ target, prefix = "", suffix = "", decimals = 0, durationFrames = 45, color = "#fff", size = 160, weight = 900, font = "Inter, sans-serif", x = "50%", y = "50%", delay = 0 }: any) {
  const frame = useCurrentFrame();
  const local = Math.max(0, frame - delay);
  const t = Math.min(1, local / durationFrames);
  const eased = 1 - Math.pow(1 - t, 3);
  const value = (eased * target).toFixed(decimals);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", color, fontSize: size, fontWeight: weight, fontFamily: font, fontVariantNumeric: "tabular-nums" }}>
        {prefix}{value}{suffix}
      </div>
    </AbsoluteFill>
  );
}
