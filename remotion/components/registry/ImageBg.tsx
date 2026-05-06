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

export function ImageBg({ src, fit = "cover", overlayColor = "rgba(0,0,0,0.35)" }: any) {
  return (
    <AbsoluteFill>
      <img src={src} style={{ width: "100%", height: "100%", objectFit: fit }} />
      <AbsoluteFill style={{ backgroundColor: overlayColor }} />
    </AbsoluteFill>
  );
}
