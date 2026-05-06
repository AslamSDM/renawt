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

export function TypewriterText({ text, color = "#fff", size = 64, font = "ui-monospace, monospace", cps = 20, delay = 0, x = "50%", y = "50%", cursor = true }: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const charsShown = Math.min(text.length, Math.floor((local / fps) * cps));
  const blink = Math.floor(local / (fps / 2)) % 2 === 0;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", color, fontSize: size, fontFamily: font, whiteSpace: "pre", textAlign: "center" }}>
        {text.slice(0, charsShown)}{cursor && <span style={{ opacity: blink ? 1 : 0 }}>▌</span>}
      </div>
    </AbsoluteFill>
  );
}
