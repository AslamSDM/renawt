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

export function Logo({ src, width = 280, animation = "scale", delay = 0, x = "50%", y = "50%" }: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = Math.max(0, frame - delay);
  const a = applyAnim(animation, localFrame, fps);
  return (
    <AbsoluteFill>
      <img src={src} style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) ${a.transform}`, width, opacity: a.opacity, filter: a.filter }} />
    </AbsoluteFill>
  );
}
