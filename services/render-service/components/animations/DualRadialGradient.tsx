import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill,
  Easing,
} from "remotion";

interface DualRadialGradientProps {
  color1: string;
  color2: string;
  speed?: number;
  baseColor?: string;
}

export const DualRadialGradient: React.FC<DualRadialGradientProps> = ({
  color1,
  color2,
  speed = 1,
  baseColor = "#050510",
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Gradient 1: drifts from top-left to center-right
  const g1X = interpolate(
    frame,
    [0, durationInFrames],
    [25, 55],
    { extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) },
  ) + Math.sin(frame * 0.015 * speed) * 10;

  const g1Y = interpolate(
    frame,
    [0, durationInFrames],
    [30, 50],
    { extrapolateRight: "clamp" },
  ) + Math.cos(frame * 0.012 * speed) * 12;

  // Gradient 1 size evolves
  const g1Size = interpolate(
    frame,
    [0, durationInFrames],
    [40, 55],
    { extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) },
  );

  // Gradient 2: drifts from bottom-right to center-left
  const g2X = interpolate(
    frame,
    [0, durationInFrames],
    [70, 45],
    { extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) },
  ) + Math.sin(frame * 0.018 * speed + 2) * 10;

  const g2Y = interpolate(
    frame,
    [0, durationInFrames],
    [65, 50],
    { extrapolateRight: "clamp" },
  ) + Math.cos(frame * 0.014 * speed + 1.5) * 12;

  // Gradient 2 size evolves
  const g2Size = interpolate(
    frame,
    [0, durationInFrames],
    [35, 50],
    { extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) },
  );

  // Subtle opacity pulse
  const opacityPulse1 = 0.45 + Math.sin(frame * 0.02 * speed) * 0.08;
  const opacityPulse2 = 0.4 + Math.cos(frame * 0.025 * speed) * 0.08;

  return (
    <AbsoluteFill style={{ background: baseColor, overflow: "hidden" }}>
      {/* Gradient 1 */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse ${g1Size}% ${g1Size}% at ${g1X}% ${g1Y}%, ${color1}, transparent)`,
          opacity: opacityPulse1,
          filter: "blur(60px)",
          transform: "scale(1.4)",
        }}
      />
      {/* Gradient 2 */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse ${g2Size}% ${g2Size}% at ${g2X}% ${g2Y}%, ${color2}, transparent)`,
          opacity: opacityPulse2,
          filter: "blur(60px)",
          transform: "scale(1.4)",
        }}
      />
    </AbsoluteFill>
  );
};

export default DualRadialGradient;
