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

export function CTABanner({ headline, buttonText = "Get started", url, accentColor = "#7c3aed", delay = 0 }: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = Math.max(0, frame - delay);
  const aH = applyAnim("slide-up", localFrame, fps);
  const aB = applyAnim("scale", Math.max(0, localFrame - 10), fps);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 36 }}>
      <div style={{ color: "#fff", fontSize: 88, fontWeight: 800, fontFamily: "Inter, sans-serif", textAlign: "center", maxWidth: "80%", opacity: aH.opacity, transform: aH.transform }}>{headline}</div>
      <div style={{ padding: "20px 48px", borderRadius: 999, backgroundColor: accentColor, color: "#fff", fontSize: 32, fontWeight: 700, fontFamily: "Inter, sans-serif", opacity: aB.opacity, transform: aB.transform }}>{buttonText}{url ? `  →` : ""}</div>
    </AbsoluteFill>
  );
}
