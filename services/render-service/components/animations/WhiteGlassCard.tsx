import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

// ============================================
// WHITE GLASS CARD
// White opaque glass morphism card with entry animations
// ============================================
interface WhiteGlassCardProps {
  children: React.ReactNode;
  maxWidth?: number;
  delay?: number;
  entryAnimation?: "slide-up" | "perspective" | "scale";
  padding?: number;
}

export const WhiteGlassCard: React.FC<WhiteGlassCardProps> = ({
  children,
  maxWidth = 800,
  delay = 0,
  entryAnimation = "slide-up",
  padding = 48,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);

  const opacity = interpolate(f, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  let transform = "";

  if (entryAnimation === "slide-up") {
    const translateY = interpolate(f, [0, 25], [60, 0], {
      extrapolateRight: "clamp",
    });
    const scale = spring({
      frame: f,
      fps,
      from: 0.95,
      to: 1,
      config: { damping: 15, stiffness: 100 },
    });
    transform = `translateY(${translateY}px) scale(${scale})`;
  } else if (entryAnimation === "perspective") {
    const rotateX = interpolate(f, [0, 30], [-20, 0], {
      extrapolateRight: "clamp",
    });
    const translateY = interpolate(f, [0, 30], [100, 0], {
      extrapolateRight: "clamp",
    });
    transform = `perspective(1000px) rotateX(${rotateX}deg) translateY(${translateY}px)`;
  } else {
    // scale
    const scale = spring({
      frame: f,
      fps,
      from: 0.8,
      to: 1,
      config: { damping: 12, stiffness: 100 },
    });
    transform = `scale(${scale})`;
  }

  return (
    <div
      style={{
        maxWidth,
        width: "100%",
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderRadius: 24,
        boxShadow: "0 25px 50px rgba(0, 0, 0, 0.25)",
        padding,
        opacity,
        transform,
        transformOrigin: "center bottom",
      }}
    >
      {children}
    </div>
  );
};
