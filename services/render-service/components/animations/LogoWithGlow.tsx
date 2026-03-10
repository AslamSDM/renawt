import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

// ============================================
// LOGO WITH GLOW
// White text + gradient suffix + blurred glow behind
// ============================================
interface LogoWithGlowProps {
  brandName: string;
  accentSuffix?: string;
  fontSize?: number;
  fontFamily?: string;
  delay?: number;
}

export const LogoWithGlow: React.FC<LogoWithGlowProps> = ({
  brandName,
  accentSuffix,
  fontSize = 96,
  fontFamily = "system-ui, sans-serif",
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);

  const textOpacity = interpolate(f, [0, 25], [0, 1], {
    extrapolateRight: "clamp",
  });

  const textScale = spring({
    frame: f,
    fps,
    from: 0.8,
    to: 1,
    config: { damping: 15, stiffness: 100 },
  });

  // Glow animates from small/dim to large/bright
  const glowScale = interpolate(f, [0, 40], [0.5, 1.5], {
    extrapolateRight: "clamp",
  });

  const glowOpacity = interpolate(f, [0, 20, 40], [0, 0.6, 0.4], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Glow behind text */}
      <div
        style={{
          position: "absolute",
          width: "120%",
          height: "200%",
          background:
            "linear-gradient(135deg, rgba(168, 85, 247, 0.6), rgba(236, 72, 153, 0.6))",
          filter: "blur(40px)",
          borderRadius: "50%",
          opacity: glowOpacity,
          transform: `scale(${glowScale})`,
          pointerEvents: "none",
        }}
      />

      {/* Text */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "baseline",
          gap: "0.15em",
          opacity: textOpacity,
          transform: `scale(${textScale})`,
        }}
      >
        <span
          style={{
            fontSize,
            fontFamily,
            fontWeight: 700,
            color: "#ffffff",
          }}
        >
          {brandName}
        </span>
        {accentSuffix && (
          <span
            style={{
              fontSize,
              fontFamily,
              fontWeight: 700,
              background: "linear-gradient(135deg, #a855f7, #ec4899)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {accentSuffix}
          </span>
        )}
      </div>
    </div>
  );
};
